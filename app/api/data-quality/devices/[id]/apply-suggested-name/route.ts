import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectSuspiciousAssetNames } from "@/lib/data-quality";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  try {
    await requirePermission("dataQuality.cleanup");
    const { id } = await context.params;
    const device = await prisma.device.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        assetTag: true,
        serialNumber: true,
        category: true,
        status: true,
        condition: true,
        brand: true,
        model: true,
        location: true,
        areaDepartment: true,
        ipAddress: true,
        macAddress: true,
        usesStaticIp: true,
        isFixedAsset: true,
        movementAlertsEnabled: true,
        notes: true,
      },
    });
    if (!device) return jsonError("Asset not found.", 404);
    const flagged = detectSuspiciousAssetNames([device])[0];
    if (!flagged) return jsonError("This asset is not flagged for suspicious Access Point naming.", 422);
    if (!flagged.suggestedName || flagged.suggestedName === device.name) return jsonError("No safe suggested name is available.", 422);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.device.update({ where: { id }, data: { name: flagged.suggestedName } });
      await tx.activityLog.create({
        data: {
          action: "asset.name_corrected",
          entity: "device",
          entityId: id,
          message: `${device.name} was renamed to ${flagged.suggestedName}.`,
          metadata: JSON.stringify({ reason: flagged.reason, previousName: device.name, suggestedName: flagged.suggestedName }),
        },
      });
      return saved;
    });

    return NextResponse.json({ device: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
