import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceSchema } from "@/lib/validation";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { replacePhoneSledPairing } from "@/lib/device-pairing";

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

    const pairingProvided = Object.prototype.hasOwnProperty.call(payload, "pairedDeviceId");
    const chargerStatusProvided = Object.prototype.hasOwnProperty.call(payload, "chargerStatus");
    const chargerNotesProvided = Object.prototype.hasOwnProperty.call(payload, "chargerNotes");
    const { pairedDeviceId, chargerStatus, chargerNotes, ...deviceData } = data;

    const device = await prisma.$transaction(async (tx) => {
      const existing = await tx.device.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new ClientInputError("Device not found.", 404);

      const updated = await tx.device.update({
        where: { id },
        data: {
          ...deviceData,
          ...(chargerStatusProvided ? { chargerStatus: chargerStatus ?? "HEALTHY" } : {}),
          ...(chargerNotesProvided ? { chargerNotes } : {}),
        },
      });

      if (pairingProvided) {
        await replacePhoneSledPairing(tx, updated, pairedDeviceId, "Paired via device edit form");
      }

      await tx.activityLog.create({
        data: {
          action: "device.updated",
          entity: "device",
          entityId: id,
          message: `${updated.name} was updated.`,
        },
      });

      return updated;
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
