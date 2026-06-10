import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { findInstallConflicts, InstallInputError, normalizeInstallInput, suggestInstallRange, suggestNextIpForRange } from "@/lib/equipment-install";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action ?? "install");
    const [device, devices, ranges] = await Promise.all([
      prisma.device.findUnique({ where: { id } }),
      prisma.device.findMany({
        select: { id: true, name: true, category: true, status: true, ipAddress: true, macAddress: true, usesStaticIp: true, isFixedAsset: true },
      }),
      prisma.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    ]);
    if (!device) return jsonError("Device not found.", 404);

    const input = normalizeInstallInput(body);
    const selectedRange = input.ipRangeId ? ranges.find((range) => range.id === input.ipRangeId) : suggestInstallRange(device, ranges, input.areaDepartment || input.location);
    const suggestion = suggestNextIpForRange(selectedRange, devices, device.id);
    const conflicts = findInstallConflicts(device, { ipAddress: input.ipAddress, macAddress: input.macAddress, ipRangeId: input.ipRangeId || selectedRange?.id }, devices, ranges);

    if (action === "check") {
      return NextResponse.json({ ok: true, conflicts, suggestion, range: selectedRange });
    }

    const blocking = conflicts.filter((conflict) => conflict.severity === "blocking");
    if (blocking.length && !input.overrideConflict) {
      return NextResponse.json({ error: "Resolve install conflicts before confirming, or explicitly override after review.", conflicts, suggestion }, { status: 422 });
    }

    const previous = {
      status: device.status,
      location: device.location,
      areaDepartment: device.areaDepartment,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      vlan: device.vlan,
      usesStaticIp: device.usesStaticIp,
      isFixedAsset: device.isFixedAsset,
      ipRangeId: device.ipRangeId,
    };

    const updated = await prisma.device.update({
      where: { id },
      data: {
        status: "ACTIVE",
        location: input.location,
        areaDepartment: input.areaDepartment,
        ipAddress: input.ipAddress,
        macAddress: input.macAddress,
        vlan: input.vlan ?? selectedRange?.vlan ?? device.vlan,
        usesStaticIp: input.usesStaticIp || Boolean(input.ipAddress),
        isFixedAsset: input.isFixedAsset || Boolean(input.ipAddress || input.macAddress),
        ipRangeId: input.ipRangeId || selectedRange?.id || device.ipRangeId,
      },
    });

    await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "device.installed",
        entity: "device",
        entityId: id,
        message: `${updated.name} was installed/commissioned.`,
        metadata: JSON.stringify({
          previous,
          next: {
            status: updated.status,
            location: updated.location,
            areaDepartment: updated.areaDepartment,
            ipAddress: updated.ipAddress,
            macAddress: updated.macAddress,
            vlan: updated.vlan,
            usesStaticIp: updated.usesStaticIp,
            isFixedAsset: updated.isFixedAsset,
            ipRangeId: updated.ipRangeId,
          },
          macAddressSource: input.macAddressSource,
          macAddressConfidence: input.macAddressConfidence,
          macAddressLastVerifiedAt: input.macAddress ? new Date().toISOString() : null,
          notes: input.notes,
          overrideConflict: input.overrideConflict,
          conflicts,
        }),
      },
    });

    return NextResponse.json({ ok: true, device: updated, conflicts, suggestion });
  } catch (error) {
    if (error instanceof InstallInputError) return handleApiError(new ClientInputError(error.message, 422));
    return handleApiError(error);
  }
}
