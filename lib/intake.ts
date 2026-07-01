import { DeviceCategory, DeviceCondition, DeviceStatus, StockCategory, StockItemType, type AppRole, type Prisma, type StockMovementType } from "@prisma/client";
import { z } from "zod";
import { ClientInputError } from "@/lib/api";
import { calculateDepreciation, defaultUsefulLifeMonths } from "@/lib/depreciation";
import { stockItemSchema } from "@/lib/validation";

export const BULK_INTAKE_MAX_COUNT = 500;

export const CATEGORY_TAG_PREFIXES: Partial<Record<DeviceCategory, string>> = {
  LAPTOP: "GHT-LP",
  PHONE: "GHT-PH",
  IPOD: "GHT-IPO",
  IPHONE: "GHT-IPH",
  IPAD: "GHT-IPA",
  THERMAL_PRINTER: "GHT-PRN",
  MFP_PRINTER: "GHT-PRN",
  OTHER_PRINTER: "GHT-PRN",
  SCANNER: "GHT-SCN",
  SLED: "GHT-SLD",
  SCALE: "GHT-SCL",
  MONITOR: "GHT-MON",
  ACCESS_POINT: "GHT-AP",
  OTHER: "GHT-OTH",
};

export async function suggestAssetTag(
  prisma: { device: { findMany: (args: { where: { assetTag: { startsWith: string } }; select: { assetTag: boolean }; orderBy: { assetTag: "desc" } }) => Promise<Array<{ assetTag: string | null }>> } },
  category: DeviceCategory,
): Promise<string | null> {
  const prefix = CATEGORY_TAG_PREFIXES[category];
  if (!prefix) return null;
  const existing = await prisma.device.findMany({
    where: { assetTag: { startsWith: prefix } },
    select: { assetTag: true },
    orderBy: { assetTag: "desc" },
  });
  let maxNum = 0;
  for (const { assetTag } of existing) {
    if (!assetTag) continue;
    const suffix = assetTag.slice(prefix.length).replace(/^[-_]/, "");
    const n = parseInt(suffix, 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }
  const next = maxNum + 1;
  const padding = 3;
  return `${prefix}-${String(next).padStart(padding, "0")}`;
}

const optionalText = z.string().trim().optional().nullable().transform((value) => value || null);
const optionalDate = z.string().optional().nullable().transform((value) => (value ? new Date(value) : null));
const optionalNumber = z.preprocess((value) => (value === "" || value == null ? null : value), z.coerce.number().nullable());
const optionalInt = z.preprocess((value) => (value === "" || value == null ? null : value), z.coerce.number().int().nullable());

export const intakeSingleAssetSchema = z.object({
  assetTag: z.string().trim().min(1, "Asset tag is required."),
  name: z.string().trim().min(1, "Asset name or model is required."),
  category: z.nativeEnum(DeviceCategory),
  serialNumber: optionalText,
  status: z.nativeEnum(DeviceStatus).default("ACTIVE"),
  condition: z.nativeEnum(DeviceCondition).default("GOOD"),
  location: optionalText,
  areaDepartment: optionalText,
  brand: optionalText,
  model: optionalText,
  assignedTo: optionalText,
  purchaseDate: optionalDate,
  warrantyExpiresAt: optionalDate,
  facturaId: optionalText,
  purchaseValue: optionalNumber.refine((value) => value == null || value > 0, "Purchase value must be greater than zero."),
  valueCurrency: optionalText.transform((value) => value || "MXN"),
  usefulLifeMonths: optionalInt.refine((value) => value == null || value >= 1, "Useful life must be at least 1 month."),
  residualPercent: optionalNumber.refine((value) => value == null || (value >= 0 && value <= 100), "Residual percent must be between 0 and 100."),
  notes: optionalText,
  chargerIncluded: z.boolean().nullable().optional(),
});

export const intakeBulkAssetSchema = z.object({
  prefix: z.string().trim().min(1, "Asset tag prefix is required."),
  start: z.coerce.number().int().min(0, "Start number must be zero or higher."),
  end: z.coerce.number().int().min(0, "End number must be zero or higher."),
  padding: z.coerce.number().int().min(0).max(12).default(3),
  separator: z.string().max(4).default("-"),
  category: z.nativeEnum(DeviceCategory),
  nameTemplate: z.string().trim().min(1, "Name template is required.").default("{tag}"),
  status: z.nativeEnum(DeviceStatus).default("ACTIVE"),
  condition: z.nativeEnum(DeviceCondition).default("GOOD"),
  location: optionalText,
  areaDepartment: optionalText,
  brand: optionalText,
  model: optionalText,
  assignedTo: optionalText,
  purchaseDate: optionalDate,
  purchaseValue: optionalNumber.refine((value) => value == null || value > 0, "Purchase value must be greater than zero."),
  valueCurrency: optionalText.transform((value) => value || "MXN"),
  usefulLifeMonths: optionalInt.refine((value) => value == null || value >= 1, "Useful life must be at least 1 month."),
  residualPercent: optionalNumber.refine((value) => value == null || (value >= 0 && value <= 100), "Residual percent must be between 0 and 100."),
  notes: optionalText,
  serialsText: z.string().optional().nullable().transform((value) => value || ""),
}).superRefine((value, context) => {
  if (value.end < value.start) {
    context.addIssue({ code: "custom", path: ["end"], message: "End number must be greater than or equal to start number." });
  }
  const count = value.end - value.start + 1;
  if (count > BULK_INTAKE_MAX_COUNT) {
    context.addIssue({ code: "custom", path: ["end"], message: `Bulk intake is limited to ${BULK_INTAKE_MAX_COUNT} assets at a time.` });
  }
});

export const intakeStockSchema = z.object({
  mode: z.enum(["new", "existing"]).default("new"),
  stockItemId: optionalText,
  receivedQuantity: z.coerce.number().int().min(1, "Quantity received must be at least 1."),
  itemName: z.string().trim().optional().nullable(),
  sku: optionalText,
  barcodeValue: optionalText,
  category: z.nativeEnum(StockCategory).default("OTHER"),
  itemType: z.nativeEnum(StockItemType).default("CONSUMABLE"),
  unit: optionalText,
  storageLocation: optionalText,
  condition: optionalText,
  vendorName: optionalText,
  facturaId: optionalText,
  minimumQuantity: z.coerce.number().int().min(0).default(0),
  notes: optionalText,
}).superRefine((value, context) => {
  if (value.mode === "existing" && !value.stockItemId) {
    context.addIssue({ code: "custom", path: ["stockItemId"], message: "Select an existing stock item." });
  }
  if (value.mode === "new" && !String(value.itemName || "").trim()) {
    context.addIssue({ code: "custom", path: ["itemName"], message: "Item name is required for new stock intake." });
  }
});

export type IntakeSingleAssetInput = z.infer<typeof intakeSingleAssetSchema>;
export type IntakeBulkAssetInput = z.infer<typeof intakeBulkAssetSchema>;
export type IntakeStockInput = z.infer<typeof intakeStockSchema>;

export type GeneratedBulkAsset = {
  assetTag: string;
  name: string;
  serialNumber: string | null;
  number: number;
  valuePreview?: {
    purchaseValue: number;
    currency: string;
    currentEstimatedValue: number | null;
    usefulLifeMonths: number;
  } | null;
};

export function formatIntakeTag(prefix: string, number: number, padding: number, separator = "-") {
  const cleanPrefix = prefix.trim();
  const cleanSeparator = separator;
  const numeric = padding > 0 ? String(number).padStart(padding, "0") : String(number);
  if (!cleanSeparator || cleanPrefix.endsWith(cleanSeparator)) return `${cleanPrefix}${numeric}`;
  return `${cleanPrefix}${cleanSeparator}${numeric}`;
}

export function parseSerialList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function generateBulkAssetPreview(input: IntakeBulkAssetInput): GeneratedBulkAsset[] {
  const serials = parseSerialList(input.serialsText);
  const valuePreview = input.purchaseValue
    ? {
        purchaseValue: input.purchaseValue,
        currency: input.valueCurrency,
        currentEstimatedValue: calculateDepreciation({
          purchaseValue: input.purchaseValue,
          purchaseDate: input.purchaseDate,
          usefulLifeMonths: input.usefulLifeMonths,
          residualPercent: input.residualPercent,
          category: input.category,
        }).currentEstimatedValue,
        usefulLifeMonths: input.usefulLifeMonths ?? defaultUsefulLifeMonths(input.category),
      }
    : null;
  return Array.from({ length: input.end - input.start + 1 }, (_, index) => {
    const number = input.start + index;
    const assetTag = formatIntakeTag(input.prefix, number, input.padding, input.separator);
    const name = input.nameTemplate
      .replaceAll("{tag}", assetTag)
      .replaceAll("{num}", String(number))
      .replaceAll("{padded}", input.padding > 0 ? String(number).padStart(input.padding, "0") : String(number));
    return { assetTag, name, serialNumber: serials[index] || null, number, valuePreview };
  });
}

export function manualLabelsHref(tags: string[]) {
  const manual = tags.join("\n");
  return `/labels?mode=manual&manual=${encodeURIComponent(manual)}`;
}

export function missingPhotosHref() {
  return "/inventory/missing-photos";
}

type IntakePrisma = Prisma.TransactionClient & {
  $transaction?: <T>(callback: (tx: IntakePrisma) => Promise<T>) => Promise<T>;
};

type ActivityActor = {
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: AppRole | null;
};

export type MappingRow = {
  rowNum: number;
  assetTag: string;
  serialNumber: string | null;
  pairedTag: string | null;
  area: string | null;
  location: string | null;
  reference: string | null;
  notes: string | null;
  brand: string | null;
  model: string | null;
};

export type MappingRowStatus = "ready" | "duplicate" | "existing_asset" | "existing_serial" | "paired_missing" | "error" | "needs_review";

export type ValidatedMappingRow = MappingRow & {
  status: MappingRowStatus;
  warnings: string[];
};

export function parseMappingCsv(text: string): MappingRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect if first line is a header row
  const firstLower = lines[0].toLowerCase();
  const hasHeader = firstLower.includes("asset") || firstLower.includes("serial") || firstLower.includes("tag");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Normalize header for column mapping (use first line if header, otherwise use positional)
  const headerCols = hasHeader
    ? lines[0].split(/[,\t]/).map((c) => c.trim().toLowerCase())
    : ["asset tag", "serial number", "paired tag", "area", "location", "reference", "notes", "brand", "model"];

  const col = (name: string) => {
    const idx = headerCols.findIndex((h) => h.includes(name));
    return idx;
  };

  const colAssetTag = Math.max(col("asset"), col("tag"), 0);
  const colSerial = Math.max(col("serial"), 1);
  const colPaired = col("paired");
  const colArea = col("area");
  const colLocation = col("location");
  const colRef = col("ref");
  const colNotes = col("notes");
  const colBrand = col("brand");
  const colModel = col("model");

  const getCol = (parts: string[], idx: number) => (idx >= 0 && idx < parts.length ? parts[idx].trim() || null : null);

  return dataLines.map((line, i) => {
    const parts = line.split(/[,\t]/);
    return {
      rowNum: i + (hasHeader ? 2 : 1),
      assetTag: getCol(parts, colAssetTag) ?? "",
      serialNumber: getCol(parts, colSerial),
      pairedTag: colPaired >= 0 ? getCol(parts, colPaired) : null,
      area: colArea >= 0 ? getCol(parts, colArea) : null,
      location: colLocation >= 0 ? getCol(parts, colLocation) : null,
      reference: colRef >= 0 ? getCol(parts, colRef) : null,
      notes: colNotes >= 0 ? getCol(parts, colNotes) : null,
      brand: colBrand >= 0 ? getCol(parts, colBrand) : null,
      model: colModel >= 0 ? getCol(parts, colModel) : null,
    };
  });
}

export function validateMappingRows(
  rows: MappingRow[],
  existingAssetTags: Set<string>,
  existingSerials: Set<string>,
  existingPairedTags: Set<string>,
): ValidatedMappingRow[] {
  const seenTags = new Set<string>();
  const seenSerials = new Set<string>();

  return rows.map((row) => {
    const warnings: string[] = [];
    let status: MappingRowStatus = "ready";

    if (!row.assetTag) {
      return { ...row, status: "error", warnings: ["Asset tag is required."] };
    }

    const tag = row.assetTag.trim();

    if (seenTags.has(tag)) {
      status = "duplicate";
      warnings.push(`Duplicate asset tag in this batch: ${tag}`);
    } else {
      seenTags.add(tag);
    }

    if (status === "ready" && existingAssetTags.has(tag)) {
      status = "existing_asset";
      warnings.push(`Asset tag already exists in inventory: ${tag}`);
    }

    if (row.serialNumber) {
      const sn = row.serialNumber.trim();
      if (seenSerials.has(sn)) {
        if (status === "ready") status = "needs_review";
        warnings.push(`Duplicate serial number in this batch: ${sn}`);
      } else {
        seenSerials.add(sn);
      }
      if (existingSerials.has(sn)) {
        if (status === "ready") status = "existing_serial";
        warnings.push(`Serial number already exists in inventory: ${sn}`);
      }
    }

    if (row.pairedTag && !existingPairedTags.has(row.pairedTag.trim())) {
      if (status === "ready") status = "paired_missing";
      warnings.push(`Paired device not found: ${row.pairedTag}`);
    }

    return { ...row, status, warnings };
  });
}

export async function createSingleIntakeAsset(prisma: IntakePrisma, input: IntakeSingleAssetInput, actor: ActivityActor = {}) {
  const existing = await prisma.device.findFirst({ where: { assetTag: input.assetTag } });
  if (existing) throw new ClientInputError(`Asset tag ${input.assetTag} already exists.`);
  const device = await prisma.device.create({
    data: {
      assetTag: input.assetTag,
      name: input.name,
      category: input.category,
      serialNumber: input.serialNumber,
      status: input.status,
      condition: input.condition,
      location: input.location,
      areaDepartment: input.areaDepartment,
      brand: input.brand,
      model: input.model,
      assignedTo: input.assignedTo,
      purchaseDate: input.purchaseDate,
      warrantyExpiresAt: input.warrantyExpiresAt,
      facturaId: input.facturaId,
      notes: appendIntakeNote(input.notes, "Created through single asset intake."),
      chargerIncluded: input.chargerIncluded ?? null,
    },
  });
  if (input.purchaseValue) {
    const calculation = calculateDepreciation({
      purchaseValue: input.purchaseValue,
      purchaseDate: input.purchaseDate,
      usefulLifeMonths: input.usefulLifeMonths,
      residualPercent: input.residualPercent,
      category: input.category,
    });
    await prisma.assetValueProfile.create({
      data: {
        deviceId: device.id,
        purchaseValue: input.purchaseValue,
        currency: input.valueCurrency,
        purchaseDate: input.purchaseDate,
        usefulLifeMonths: input.usefulLifeMonths ?? defaultUsefulLifeMonths(input.category),
        residualPercent: input.residualPercent ?? 30,
        residualValue: calculation.residualValue,
        currentEstimatedValue: calculation.currentEstimatedValue,
        lastCalculatedAt: calculation.lastCalculatedAt,
        notes: "Created through asset intake.",
      },
    });
  }
  const activityData: Prisma.ActivityLogUncheckedCreateInput = {
    ...actor,
    action: "intake.asset_created",
    entity: "device",
    entityId: device.id,
    message: `${device.assetTag || device.name} was created through single asset intake.`,
  };
  await prisma.activityLog.create({
    data: activityData,
  });
  return device;
}

export async function createBulkIntakeAssets(prisma: IntakePrisma, input: IntakeBulkAssetInput, actor: ActivityActor = {}) {
  const generated = generateBulkAssetPreview(input);
  const duplicateGenerated = findDuplicates(generated.map((asset) => asset.assetTag));
  if (duplicateGenerated.length) throw new ClientInputError(`Duplicate generated tags: ${duplicateGenerated.join(", ")}.`);
  const existing = await prisma.device.findMany({ where: { assetTag: { in: generated.map((asset) => asset.assetTag) } }, select: { assetTag: true } });
  const existingTags = existing.map((asset) => asset.assetTag).filter(Boolean) as string[];
  if (existingTags.length) throw new ClientInputError(`Existing asset tags found: ${existingTags.slice(0, 10).join(", ")}${existingTags.length > 10 ? "..." : ""}.`);

  return prisma.$transaction!(async (tx) => {
    const result = await tx.device.createMany({
      data: generated.map((asset) => ({
        assetTag: asset.assetTag,
        name: asset.name,
        category: input.category,
        serialNumber: asset.serialNumber,
        status: input.status,
        condition: input.condition,
        location: input.location,
        areaDepartment: input.areaDepartment,
        brand: input.brand,
        model: input.model,
        assignedTo: input.assignedTo,
        purchaseDate: input.purchaseDate,
        notes: appendIntakeNote(input.notes, "Created through bulk asset intake. Photos pending review."),
      })),
    });
    if (input.purchaseValue) {
      const createdDevices = await tx.device.findMany({ where: { assetTag: { in: generated.map((asset) => asset.assetTag) } }, select: { id: true, assetTag: true, category: true, purchaseDate: true } });
      const profiles = createdDevices.map((device) => {
        const calculation = calculateDepreciation({
          purchaseValue: input.purchaseValue,
          purchaseDate: input.purchaseDate ?? device.purchaseDate,
          usefulLifeMonths: input.usefulLifeMonths,
          residualPercent: input.residualPercent,
          category: device.category,
        });
        return {
          deviceId: device.id,
          purchaseValue: input.purchaseValue!,
          currency: input.valueCurrency,
          purchaseDate: input.purchaseDate,
          usefulLifeMonths: input.usefulLifeMonths ?? defaultUsefulLifeMonths(device.category),
          residualPercent: input.residualPercent ?? 30,
          residualValue: calculation.residualValue,
          currentEstimatedValue: calculation.currentEstimatedValue,
          lastCalculatedAt: calculation.lastCalculatedAt,
          notes: "Created through bulk asset intake.",
        };
      });
      if (profiles.length) await tx.assetValueProfile.createMany({ data: profiles });
    }
    const activityData: Prisma.ActivityLogUncheckedCreateInput = {
      ...actor,
      action: "intake.bulk_assets_created",
      entity: "device",
      entityId: "bulk-intake",
      message: `${result.count} assets were created through bulk intake.`,
      metadata: JSON.stringify({ count: result.count, firstTag: generated[0]?.assetTag, lastTag: generated.at(-1)?.assetTag }),
    };
    await tx.activityLog.create({ data: activityData });
    return { count: result.count, generated };
  });
}

export async function intakeStock(prisma: IntakePrisma, input: IntakeStockInput, actor: ActivityActor = {}) {
  return prisma.$transaction!(async (tx) => {
    let stockItem: { id: string; name: string; quantityOnHand: number };
    let previousQuantity = 0;
    if (input.mode === "existing") {
      const existing = await tx.stockItem.findUnique({ where: { id: input.stockItemId! } });
      if (!existing) throw new ClientInputError("Stock item not found.", 404);
      previousQuantity = existing.quantityOnHand;
      stockItem = await tx.stockItem.update({
        where: { id: existing.id },
        data: {
          quantityOnHand: existing.quantityOnHand + input.receivedQuantity,
          storageLocation: input.storageLocation ?? undefined,
          vendorName: input.vendorName ?? undefined,
          facturaId: input.facturaId ?? undefined,
          notes: input.notes ?? undefined,
        },
      });
    } else {
      const parsedStock = stockItemSchema.parse({
        name: input.itemName,
        sku: input.sku,
        barcodeValue: input.barcodeValue,
        category: input.category,
        itemType: input.itemType,
        quantityOnHand: input.receivedQuantity,
        minimumQuantity: input.minimumQuantity,
        vendorName: input.vendorName,
        storageLocation: input.storageLocation,
        notes: input.notes,
        facturaId: input.facturaId,
        active: true,
      });
      if (parsedStock.sku || parsedStock.barcodeValue) {
        const duplicate = await tx.stockItem.findFirst({
          where: { OR: [{ sku: parsedStock.sku }, { barcodeValue: parsedStock.barcodeValue }].filter((item) => Object.values(item)[0]) },
        });
        if (duplicate) throw new ClientInputError("A stock item with this SKU or scan code already exists.");
      }
      stockItem = await tx.stockItem.create({ data: parsedStock });
    }

    await tx.stockMovement.create({
      data: {
        stockItemId: stockItem.id,
        movementType: "ADD" satisfies StockMovementType,
        quantity: input.receivedQuantity,
        previousQuantity,
        newQuantity: previousQuantity + input.receivedQuantity,
        reason: "Inventory intake",
        notes: stockIntakeMovementNotes(input),
        performedBy: actor.actorName || null,
        facturaId: input.facturaId,
      },
    });
    const activityData: Prisma.ActivityLogUncheckedCreateInput = {
      ...actor,
      action: input.mode === "existing" ? "intake.stock_received" : "intake.stock_created",
      entity: "stock",
      entityId: stockItem.id,
      message: `${input.receivedQuantity} ${input.unit || "unit"}${input.receivedQuantity === 1 ? "" : "s"} received for ${stockItem.name}.`,
    };
    await tx.activityLog.create({ data: activityData });
    return stockItem;
  });
}

function appendIntakeNote(notes: string | null | undefined, suffix: string) {
  return [notes, suffix].filter(Boolean).join("\n");
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function stockIntakeMovementNotes(input: IntakeStockInput) {
  return [input.condition ? `Condition: ${input.condition}` : null, input.notes].filter(Boolean).join("\n") || null;
}
