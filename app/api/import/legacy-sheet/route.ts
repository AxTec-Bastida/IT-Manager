import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { buildLegacyPreview, orderLegacyRowsForCommit, sanitizeLegacyRawForAudit, type ExistingLegacyRecords, type LegacyPreviewRow } from "@/lib/legacy-import";

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const formData = await request.formData();
    const file = formData.get("file");
    const commit = formData.get("commit") === "true";
    const backupConfirmed = formData.get("backupConfirmed") === "true";
    const selectedSheets = parseSelectedSheets(formData.get("selectedSheets"));

    if (!(file instanceof File)) return jsonError("Upload an .xlsx workbook first.", 400);
    if (!file.name.toLowerCase().endsWith(".xlsx")) return jsonError("Legacy import expects an .xlsx workbook.", 400);
    if (commit && !backupConfirmed) return jsonError("Confirm the backup warning before final import.", 400);

    const existing = await loadExistingRecords();
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = buildLegacyPreview(buffer, file.name, { selectedSheets, existing });

    if (!commit) return NextResponse.json(preview);

    const result = await commitValidRows(preview.rows, file.name);
    return NextResponse.json({ ...preview, importRunId: result.importRunId, imported: result.imported, updated: result.updated });
  } catch (error) {
    return handleApiError(error);
  }
}

async function loadExistingRecords(): Promise<ExistingLegacyRecords> {
  const [devices, stockItems, facturas] = await Promise.all([
    prisma.device.findMany({ select: { id: true, name: true, assetTag: true, serialNumber: true, macAddress: true, ipAddress: true } }),
    prisma.stockItem.findMany({ select: { id: true, name: true, sku: true, category: true } }),
    prisma.factura.findMany({ select: { id: true, facturaNumber: true } }),
  ]);
  return { devices, stockItems, facturas };
}

function parseSelectedSheets(value: FormDataEntryValue | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

async function commitValidRows(rows: LegacyPreviewRow[], fileName: string) {
  const validRows = rows.filter((row) => row.ok && row.action !== "skip");
  let imported = 0;
  let updated = 0;

  const importRun = await prisma.importRun.create({
    data: {
      fileName,
      sourceType: "LEGACY_XLSX",
      status: "FAILED",
      summaryJson: JSON.stringify(importSummary(rows)),
    },
  });

  try {
    for (const row of orderLegacyRowsForCommit(validRows)) {
      if (row.target === "device") {
        const saved = await saveDeviceRow(row);
        if (saved === "updated") updated += 1;
        else imported += 1;
      } else if (row.target === "stockItem") {
        const saved = await saveStockRow(row);
        if (saved === "updated") updated += 1;
        else imported += 1;
      } else if (row.target === "factura") {
        const saved = await saveFacturaRow(row);
        if (saved === "updated") updated += 1;
        else imported += 1;
      } else if (row.target === "activity") {
        await prisma.activityLog.create({ data: row.data as Prisma.ActivityLogCreateInput });
        imported += 1;
      }
    }

    await saveRowAudit(importRun.id, rows);
    const status = rows.some((row) => row.errors.length > 0) || rows.some((row) => row.action === "skip") ? "PARTIAL" : "SUCCESS";
    await prisma.importRun.update({
      where: { id: importRun.id },
      data: {
        status,
        finishedAt: new Date(),
        summaryJson: JSON.stringify({ ...importSummary(rows), imported, updated }),
      },
    });
    await prisma.activityLog.create({
      data: {
        action: "legacy-import.completed",
        entity: "ImportRun",
        entityId: importRun.id,
        message: `Legacy workbook import completed from ${fileName}: ${imported} created, ${updated} updated.`,
      },
    });
    return { importRunId: importRun.id, imported, updated };
  } catch (error) {
    await prisma.importRun.update({
      where: { id: importRun.id },
      data: { status: "FAILED", finishedAt: new Date(), summaryJson: JSON.stringify({ ...importSummary(rows), imported, updated, error: error instanceof Error ? error.message : "Unknown error" }) },
    });
    throw error;
  }
}

async function saveDeviceRow(row: LegacyPreviewRow) {
  const invoiceNumber = stringValue(row.data.invoiceNumber);
  const factura = invoiceNumber ? await findOrCreateFactura(invoiceNumber, stringValue(row.data.vendorName) || "Legacy import") : null;
  const data = compact({
    assetTag: nullableString(row.data.assetTag),
    name: stringValue(row.data.name) || `Legacy asset ${row.sheetName} ${row.rowNumber}`,
    category: row.data.category,
    brand: nullableString(row.data.brand),
    model: nullableString(row.data.model),
    serialNumber: nullableString(row.data.serialNumber),
    ipAddress: nullableString(row.data.ipAddress),
    macAddress: nullableString(row.data.macAddress),
    location: nullableString(row.data.location),
    areaDepartment: nullableString(row.data.areaDepartment),
    assignedTo: nullableString(row.data.assignedTo),
    status: row.data.status,
    condition: row.data.condition,
    purchaseDate: row.data.purchaseDate,
    warrantyExpiresAt: row.data.warrantyExpiresAt,
    notes: nullableString(row.data.notes),
    maintenanceNotes: nullableString(row.data.maintenanceNotes),
    isFixedAsset: row.data.isFixedAsset,
    usesStaticIp: row.data.usesStaticIp,
    movementAlertsEnabled: row.data.movementAlertsEnabled,
    facturaId: factura?.id,
  }) as Prisma.DeviceCreateInput;

  if (row.action === "update" && row.duplicate?.id && !row.duplicate.warningOnly) {
    const updateData = compact(data) as Prisma.DeviceUpdateInput;
    delete (updateData as Record<string, unknown>).assetTag;
    await prisma.device.update({ where: { id: row.duplicate.id }, data: updateData });
    await saveLegacyDeviceMetadata(row.duplicate.id, row);
    return "updated" as const;
  }

  const created = await prisma.device.create({ data });
  await saveLegacyDeviceMetadata(created.id, row);
  return "created" as const;
}

async function saveLegacyDeviceMetadata(deviceId: string, row: LegacyPreviewRow) {
  const aliases = Array.isArray(row.data.legacyAliases) ? row.data.legacyAliases : [];
  for (const alias of aliases as Array<Record<string, unknown>>) {
    const value = nullableString(alias.value);
    const aliasType = stringValue(alias.aliasType);
    if (!value || !aliasType) continue;
    await prisma.deviceAlias.upsert({
      where: { deviceId_aliasType_value: { deviceId, aliasType: aliasType as never, value } },
      update: {
        sourceSheet: nullableString(alias.sourceSheet),
        sourceColumn: nullableString(alias.sourceColumn),
        sourceRow: alias.sourceRow == null ? null : Number(alias.sourceRow),
      },
      create: {
        deviceId,
        aliasType: aliasType as never,
        value,
        sourceSheet: nullableString(alias.sourceSheet),
        sourceColumn: nullableString(alias.sourceColumn),
        sourceRow: alias.sourceRow == null ? null : Number(alias.sourceRow),
      },
    });
  }

  const relationshipCandidates = Array.isArray(row.data.relationshipCandidates) ? row.data.relationshipCandidates : [];
  for (const candidate of relationshipCandidates as Array<Record<string, unknown>>) {
    const targetReference = nullableString(candidate.targetReference);
    const relationshipType = stringValue(candidate.relationshipType);
    if (!targetReference || !relationshipType) continue;
    const target = await findDeviceByLegacyReference(targetReference);
    if (!target || target.id === deviceId) continue;
    await prisma.deviceRelationship.upsert({
      where: { sourceDeviceId_targetDeviceId_relationshipType: { sourceDeviceId: deviceId, targetDeviceId: target.id, relationshipType: relationshipType as never } },
      update: {
        sourceReference: targetReference,
        confidence: Number(candidate.confidence ?? 0.8),
        notes: "Created from legacy workbook mobile/sled pairing reference.",
      },
      create: {
        sourceDeviceId: deviceId,
        targetDeviceId: target.id,
        relationshipType: relationshipType as never,
        status: "ACTIVE",
        sourceReference: targetReference,
        confidence: Number(candidate.confidence ?? 0.8),
        notes: "Created from legacy workbook mobile/sled pairing reference.",
      },
    });
  }
}

async function findDeviceByLegacyReference(reference: string) {
  const normalized = reference.trim();
  return prisma.device.findFirst({
    where: {
      OR: [
        { assetTag: normalized },
        { aliases: { some: { value: normalized } } },
        { notes: { contains: `Legacy A/N: ${normalized}` } },
      ],
    },
    select: { id: true },
  });
}

async function saveStockRow(row: LegacyPreviewRow) {
  const data = compact({
    name: stringValue(row.data.name) || `Legacy stock ${row.sheetName} ${row.rowNumber}`,
    sku: nullableString(row.data.sku),
    category: row.data.category,
    itemType: row.data.itemType,
    quantityOnHand: Number(row.data.quantityOnHand ?? 0),
    minimumQuantity: Number(row.data.minimumQuantity ?? 0),
    vendorName: nullableString(row.data.vendorName),
    storageLocation: nullableString(row.data.storageLocation),
    notes: nullableString(row.data.notes),
  }) as Prisma.StockItemCreateInput;

  if (row.action === "update" && row.duplicate?.id) {
    const updateData = compact(data) as Prisma.StockItemUpdateInput;
    delete (updateData as Record<string, unknown>).sku;
    await prisma.stockItem.update({ where: { id: row.duplicate.id }, data: updateData });
    return "updated" as const;
  }

  await prisma.stockItem.create({ data });
  return "created" as const;
}

async function saveFacturaRow(row: LegacyPreviewRow) {
  const factura = await findOrCreateFactura(stringValue(row.data.facturaNumber), stringValue(row.data.vendorName) || "Legacy import", row.data.receivedDate as Date | null, nullableString(row.data.notes));
  const serialNumber = nullableString(row.data.serialNumber);
  if (serialNumber) {
    await prisma.device.updateMany({ where: { serialNumber, facturaId: null }, data: { facturaId: factura.id } });
  }
  return factura.created ? "created" as const : "updated" as const;
}

async function findOrCreateFactura(facturaNumber: string, vendorName: string, receivedDate?: Date | null, notes?: string | null) {
  const existing = await prisma.factura.findFirst({ where: { facturaNumber } });
  if (existing) {
    await prisma.factura.update({
      where: { id: existing.id },
      data: compact({ vendorName: existing.vendorName || vendorName, receivedDate, notes }),
    });
    return { id: existing.id, created: false };
  }
  const created = await prisma.factura.create({
    data: {
      facturaNumber,
      vendorName,
      receivedDate: receivedDate ?? null,
      notes: notes ?? null,
    },
  });
  return { id: created.id, created: true };
}

async function saveRowAudit(importRunId: string, rows: LegacyPreviewRow[]) {
  const auditRows = rows.flatMap((row) => [
    ...row.errors.map((message) => ({ importRunId, sheetName: row.sheetName, rowNumber: row.rowNumber, errorType: "ERROR", message, rawJson: JSON.stringify(sanitizeLegacyRawForAudit(row.raw)) })),
    ...row.warnings.map((message) => ({ importRunId, sheetName: row.sheetName, rowNumber: row.rowNumber, errorType: "WARNING", message, rawJson: JSON.stringify(sanitizeLegacyRawForAudit(row.raw)) })),
  ]);
  if (auditRows.length) await prisma.importRowError.createMany({ data: auditRows });
}

function importSummary(rows: LegacyPreviewRow[]) {
  return {
    rowsDetected: rows.length,
    validRows: rows.filter((row) => row.ok).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    warningRows: rows.filter((row) => row.warnings.length > 0).length,
    rowsToCreate: rows.filter((row) => row.ok && row.action === "create").length,
    rowsToUpdate: rows.filter((row) => row.ok && row.action === "update").length,
    rowsSkipped: rows.filter((row) => row.action === "skip" || !row.ok).length,
    skippedCommentLikeStockRows: rows.filter((row) => row.warnings.some((warning) => warning.toLowerCase().includes("comment-like stock row"))).length,
  };
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")) as Partial<T>;
}
