import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { chargerStatusValues } from "@/lib/device-pairing";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const { status, notes } = await request.json();

    if (!chargerStatusValues.includes(status)) {
      throw new ClientInputError("Invalid charger status.");
    }

    const oldDevice = await prisma.device.findUnique({ where: { id } });
    if (!oldDevice) return jsonError("Device not found.", 404);

    const device = await prisma.device.update({
      where: { id },
      data: {
        chargerStatus: status,
        chargerNotes: notes || null,
      },
    });

    if (status === "REPLACED") {
      await prisma.maintenanceRecord.create({
        data: {
          assetId: id,
          maintenanceType: "POWER_SUPPLY_REPLACEMENT",
          result: "PASS",
          performedAt: new Date(),
          performedBy: "System (Charger Replaced)",
          notes: notes || "Charger replaced and status updated to Replaced.",
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        action: "device.updated",
        entity: "device",
        entityId: id,
        message: `${device.name} charger status was updated to ${status}.`,
      },
    });

    return NextResponse.json({ device });
  } catch (error) {
    return handleApiError(error);
  }
}
