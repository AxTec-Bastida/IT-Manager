import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ipRangeSchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { validateActiveRangeNoOverlap } from "../route";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const range = await prisma.ipRange.findUnique({ where: { id }, include: { devices: true } });
  if (!range) return jsonError("IP range not found.", 404);
  return NextResponse.json({ range });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const data = ipRangeSchema.parse(await request.json());

    if (data.active) {
      const overlapCheck = await validateActiveRangeNoOverlap(data.startIp, data.endIp, id);
      if (!overlapCheck.ok) {
        return jsonError(overlapCheck.message ?? "IP range overlap detected", 400);
      }
    }

    const range = await prisma.ipRange.update({ where: { id }, data });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "range.updated",
        entity: "range",
        entityId: id,
        message: `${range.name} was updated.`,
      },
    });

    return NextResponse.json({ range });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get("hard") === "true";

    const existing = await prisma.ipRange.findUnique({
      where: { id },
      include: { _count: { select: { devices: true } } },
    });
    if (!existing) return jsonError("IP range not found.", 404);

    if (hard) {
      if (existing._count.devices > 0) {
        return jsonError("This IP range is referenced by existing devices. Deactivate it instead.", 400);
      }
      await prisma.ipRange.delete({ where: { id } });

      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "range.deleted",
          entity: "range",
          entityId: id,
          message: `IP range ${existing.name} was permanently deleted.`,
        },
      });

      return NextResponse.json({ ok: true });
    } else {
      const range = await prisma.ipRange.update({ where: { id }, data: { active: false } });

      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "range.deactivated",
          entity: "range",
          entityId: id,
          message: `IP range ${range.name} was deactivated.`,
        },
      });

      return NextResponse.json({ range });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
