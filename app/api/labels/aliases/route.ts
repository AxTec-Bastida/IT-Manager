import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { aliasTypeForPrisma, buildAliasAssignmentPreview, normalizePhysicalLabelCode } from "@/lib/label-aliases";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requirePermission("labels.manage");
    const formData = await request.formData();
    const deviceIds = formData.getAll("deviceId").map(String).filter(Boolean);
    if (!deviceIds.length) return jsonError("Select at least one asset before applying physical label aliases.", 422);

    const [assets, existingAliases] = await Promise.all([
      prisma.device.findMany({
        where: { id: { in: deviceIds } },
        select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true } } },
        orderBy: [{ name: "asc" }],
      }),
      prisma.deviceAlias.findMany({ select: { deviceId: true, aliasType: true, value: true } }),
    ]);

    const orderedAssets = deviceIds.flatMap((id) => assets.find((asset) => asset.id === id) ?? []);
    const preview = buildAliasAssignmentPreview(
      orderedAssets,
      {
        prefix: String(formData.get("prefix") ?? ""),
        start: Number(formData.get("start") ?? "1"),
        end: Number(formData.get("end") ?? "1"),
        padding: Number(formData.get("padding") ?? "0"),
        aliasType: String(formData.get("aliasType") ?? "PHYSICAL_LABEL"),
      },
      existingAliases,
    );

    if (!preview.ok) return NextResponse.json(preview, { status: 422 });

    let created = 0;
    let updated = 0;
    for (const row of preview.rows) {
      const value = normalizePhysicalLabelCode(row.code);
      const aliasType = aliasTypeForPrisma(row.aliasType);
      const existing = await prisma.deviceAlias.findUnique({
        where: { deviceId_aliasType_value: { deviceId: row.deviceId, aliasType, value } },
      });
      await prisma.deviceAlias.upsert({
        where: { deviceId_aliasType_value: { deviceId: row.deviceId, aliasType, value } },
        update: { notes: "Physical label code generated from /labels alias-linked mode." },
        create: {
          deviceId: row.deviceId,
          aliasType,
          value,
          sourceColumn: "Physical label",
          notes: "Physical label code generated from /labels alias-linked mode.",
        },
      });
      if (existing) updated += 1;
      else created += 1;
      await prisma.activityLog.create({
        data: {
          action: "device-alias.physical-label",
          entity: "Device",
          entityId: row.deviceId,
          message: `Physical label code ${value} linked to ${row.officialAssetTag || row.assetName}.`,
          metadata: JSON.stringify({ aliasType, value, officialAssetTag: row.officialAssetTag }),
        },
      });
    }

    return NextResponse.json({ ok: true, created, updated, rows: preview.rows });
  } catch (error) {
    return handleApiError(error);
  }
}
