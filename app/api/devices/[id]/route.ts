import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceSchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { id } = await context.params;
    const device = await prisma.device.findUnique({ where: { id }, include: { ipRange: true } });
    if (!device) return jsonError("Device not found.", 404);
    return NextResponse.json({ device });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const payload = await request.json();
    const data = deviceSchema.parse(payload);
    const device = await prisma.device.update({ where: { id }, data });

    await prisma.activityLog.create({
      data: {
        action: "device.updated",
        entity: "device",
        entityId: id,
        message: `${device.name} was updated.`,
      },
    });

    return NextResponse.json({ device });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const device = await prisma.device.update({ where: { id }, data: { status: "RETIRED" } });

    await prisma.activityLog.create({
      data: {
        action: "device.retired",
        entity: "device",
        entityId: id,
        message: `${device.name} was retired and kept in history.`,
      },
    });

    return NextResponse.json({ device });
  } catch (error) {
    return handleApiError(error);
  }
}
