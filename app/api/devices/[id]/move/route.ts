import { NextRequest, NextResponse } from "next/server";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMoveWarnings, moveRequiresConfirmation, MoveInputError, normalizeMoveInput } from "@/lib/equipment-move";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action ?? "move");
    const [device, devices, ranges] = await Promise.all([
      prisma.device.findUnique({ where: { id } }),
      prisma.device.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          status: true,
          ipAddress: true,
          macAddress: true,
          vlan: true,
          location: true,
          areaDepartment: true,
          usesStaticIp: true,
          isFixedAsset: true,
          ipRangeId: true,
        },
      }),
      prisma.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    ]);
    if (!device) return jsonError("Device not found.", 404);

    const input = normalizeMoveInput(body);
    const mapAnchor = input.mapAnchorId
      ? await prisma.accessPointMapLocation.findFirst({
          where: { id: input.mapAnchorId, active: true },
          select: { id: true, apName: true, locationLabel: true, displayPath: true },
        })
      : null;
    if (input.mapAnchorId && !mapAnchor) return jsonError("Location anchor not found or inactive.", 404);
    const { warnings, expectedRange, suggestion } = buildMoveWarnings(device, input, devices, ranges);

    if (action === "check") {
      return NextResponse.json({ ok: true, warnings, expectedRange, suggestion });
    }

    if (moveRequiresConfirmation(warnings) && !input.confirmWarnings) {
      return NextResponse.json({ error: "Confirm the relocation warnings before moving this asset.", warnings, expectedRange, suggestion }, { status: 422 });
    }

    const previous = {
      status: device.status,
      location: device.location,
      areaDepartment: device.areaDepartment,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      vlan: device.vlan,
      ipRangeId: device.ipRangeId,
      usesStaticIp: device.usesStaticIp,
      isFixedAsset: device.isFixedAsset,
      currentMapAnchorId: device.currentMapAnchorId,
    };

    const nextStatus = input.markActive && ["AVAILABLE", "RESERVED"].includes(device.status) ? "ACTIVE" : device.status;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.device.update({
        where: { id },
        data: {
          location: input.location,
          areaDepartment: input.areaDepartment,
          currentMapAnchorId: input.mapAnchorId,
          status: nextStatus,
        },
      });

      const activity = await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "device.moved",
          entity: "device",
          entityId: id,
          message: `${updated.name} was moved/relocated.`,
          metadata: JSON.stringify({
            previous,
            next: {
              status: updated.status,
              location: updated.location,
              areaDepartment: updated.areaDepartment,
              ipAddress: updated.ipAddress,
              macAddress: updated.macAddress,
              vlan: updated.vlan,
              ipRangeId: updated.ipRangeId,
              usesStaticIp: updated.usesStaticIp,
              isFixedAsset: updated.isFixedAsset,
              currentMapAnchorId: updated.currentMapAnchorId,
              mapAnchor: mapAnchor ? { id: mapAnchor.id, name: mapAnchor.apName, path: mapAnchor.displayPath ?? mapAnchor.locationLabel } : null,
            },
            requested: input,
            expectedRange: expectedRange ? { id: expectedRange.id, name: expectedRange.name, vlan: expectedRange.vlan, startIp: expectedRange.startIp, endIp: expectedRange.endIp } : null,
            suggestion,
            warnings,
          }),
        },
      });

      return { updated, activity };
    });

    return NextResponse.json({ ok: true, device: result.updated, activityLogId: result.activity.id, warnings, expectedRange, suggestion });
  } catch (error) {
    if (error instanceof MoveInputError) return handleApiError(new ClientInputError(error.message, 422));
    return handleApiError(error);
  }
}
