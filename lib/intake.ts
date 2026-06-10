import { DeviceCategory, DeviceCondition, DeviceStatus, StockCategory, StockItemType, type AppRole, type Prisma, type StockMovementType } from "@prisma/client";
import { z } from "zod";
import { ClientInputError } from "@/lib/api";
import { stockItemSchema } from "@/lib/validation";

export const BULK_INTAKE_MAX_COUNT = 500;

const optionalText = z.string().trim().optional().nullable().transform((value) => value || null);
const optionalDate = z.string().optional().nullable().transform((value) => (value ? new Date(value) : null));

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
  notes: optionalText,
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
  return Array.from({ length: input.end - input.start + 1 }, (_, index) => {
    const number = input.start + index;
    const assetTag = formatIntakeTag(input.prefix, number, input.padding, input.separator);
    const name = input.nameTemplate
      .replaceAll("{tag}", assetTag)
      .replaceAll("{num}", String(number))
      .replaceAll("{padded}", input.padding > 0 ? String(number).padStart(input.padding, "0") : String(number));
    return { assetTag, name, serialNumber: serials[index] || null, number };
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
    },
  });
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
        notes: appendIntakeNote(input.notes, "Created through bulk asset intake. Photos pending review."),
      })),
    });
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
