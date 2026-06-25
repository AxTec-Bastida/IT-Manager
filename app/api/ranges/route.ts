import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ipRangeSchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { ipToNumber } from "@/lib/ip";

export async function validateActiveRangeNoOverlap(startIp: string, endIp: string, currentId?: string) {
  const startNum = ipToNumber(startIp);
  const endNum = ipToNumber(endIp);

  const activeRanges = await prisma.ipRange.findMany({
    where: {
      active: true,
      id: currentId ? { not: currentId } : undefined,
    },
  });

  for (const r of activeRanges) {
    const rStart = ipToNumber(r.startIp);
    const rEnd = ipToNumber(r.endIp);
    if (startNum <= rEnd && endNum >= rStart) {
      return {
        ok: false,
        message: `Overlaps with existing active range "${r.name}" (${r.startIp} - ${r.endIp}).`,
      };
    }
  }
  return { ok: true };
}

export async function GET() {
  try {
    await requirePermission("inventory.read");
    const ranges = await prisma.ipRange.findMany({
      include: { _count: { select: { devices: true } } },
      orderBy: [{ active: "desc" }, { vlan: "asc" }, { startIp: "asc" }],
    });

    return NextResponse.json({ ranges });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const data = ipRangeSchema.parse(await request.json());

    if (data.active) {
      const overlapCheck = await validateActiveRangeNoOverlap(data.startIp, data.endIp);
      if (!overlapCheck.ok) {
        return jsonError(overlapCheck.message ?? "IP range overlap detected", 400);
      }
    }

    const range = await prisma.ipRange.create({ data });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "range.created",
        entity: "range",
        entityId: range.id,
        message: `${range.name} was created for VLAN ${range.vlan}.`,
      },
    });

    return NextResponse.json({ range }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
