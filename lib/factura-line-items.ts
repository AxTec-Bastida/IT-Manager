import type { AppRole, DeviceCategory, Prisma } from "@prisma/client";
import { ClientInputError } from "@/lib/api";
import { calculateDepreciation, defaultUsefulLifeMonths } from "@/lib/depreciation";

export function calculateLineItemTotal(quantity: number, unitCost: number) {
  return Math.round(quantity * unitCost * 100) / 100;
}

export function unlinkedQuantity(lineItem: { quantity: number; assetLinks?: unknown[] }) {
  return Math.max(0, lineItem.quantity - (lineItem.assetLinks?.length ?? 0));
}

export function assertCanLinkAssets(lineItem: { quantity: number; assetLinks: Array<{ deviceId: string }> }, assetIds: string[]) {
  const uniqueIds = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) throw new ClientInputError("Select at least one asset to link.");
  const alreadyLinked = uniqueIds.filter((id) => lineItem.assetLinks.some((link) => link.deviceId === id));
  if (alreadyLinked.length) throw new ClientInputError(`Already linked to this line item: ${alreadyLinked.join(", ")}.`);
  if (lineItem.assetLinks.length + uniqueIds.length > lineItem.quantity) {
    throw new ClientInputError(`Cannot link ${uniqueIds.length} asset(s). This line item has ${unlinkedQuantity(lineItem)} unlinked quantity remaining.`);
  }
  return uniqueIds;
}

export function lineItemValueSourceLabel(source?: {
  sourceType?: string | null;
  sourceFacturaLineItemAsset?: {
    lineItem?: {
      description: string;
      unitCost: number;
      currency: string;
      factura?: { id: string; facturaNumber: string; vendorName: string; purchaseDate: Date | null } | null;
    } | null;
  } | null;
}) {
  const link = source?.sourceFacturaLineItemAsset;
  const lineItem = link?.lineItem;
  const factura = lineItem?.factura;
  if (source?.sourceType === "FACTURA_LINE_ITEM" && lineItem && factura) {
    return {
      label: "Factura line item",
      facturaNumber: factura.facturaNumber,
      vendorName: factura.vendorName,
      purchaseDate: factura.purchaseDate,
      lineItemDescription: lineItem.description,
      unitCost: lineItem.unitCost,
      currency: lineItem.currency,
      facturaId: factura.id,
    };
  }
  return null;
}

type ApplyActor = {
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: AppRole | null;
};

type ApplyPrisma = Prisma.TransactionClient;

export async function applyLineItemValues(
  tx: ApplyPrisma,
  lineItem: {
    id: string;
    description: string;
    unitCost: number;
    currency: string;
    factura: { id: string; facturaNumber: string; vendorName: string; purchaseDate: Date | null };
    assetLinks: Array<{
      id: string;
      allocatedUnitCost: number | null;
      currency: string;
      device: { id: string; assetTag: string | null; name: string; category: DeviceCategory; purchaseDate: Date | null; valueProfile?: { id: string; purchaseValue: number | null } | null };
    }>;
  },
  options: { overwriteExisting: boolean; actor?: ApplyActor } = { overwriteExisting: false },
) {
  const result = { created: 0, updated: 0, skippedExisting: 0 };
  for (const link of lineItem.assetLinks) {
    if (link.device.valueProfile && !options.overwriteExisting) {
      result.skippedExisting += 1;
      continue;
    }
    const purchaseValue = link.allocatedUnitCost ?? lineItem.unitCost;
    const purchaseDate = lineItem.factura.purchaseDate ?? link.device.purchaseDate;
    const usefulLifeMonths = defaultUsefulLifeMonths(link.device.category);
    const calculation = calculateDepreciation({
      purchaseValue,
      purchaseDate,
      usefulLifeMonths,
      residualPercent: 30,
      category: link.device.category,
    });
    const data = {
      purchaseValue,
      currency: link.currency || lineItem.currency,
      purchaseDate,
      usefulLifeMonths,
      residualPercent: 30,
      residualValue: calculation.residualValue,
      currentEstimatedValue: calculation.currentEstimatedValue,
      lastCalculatedAt: calculation.lastCalculatedAt,
      sourceType: "FACTURA_LINE_ITEM",
      sourceFacturaLineItemAssetId: link.id,
      notes: `Value sourced from factura ${lineItem.factura.facturaNumber}, line item: ${lineItem.description}.`,
    };

    if (link.device.valueProfile) {
      await tx.assetValueProfile.update({ where: { deviceId: link.device.id }, data });
      result.updated += 1;
    } else {
      await tx.assetValueProfile.create({ data: { deviceId: link.device.id, ...data } });
      result.created += 1;
    }

    await tx.activityLog.create({
      data: {
        ...(options.actor ?? {}),
        action: "device.value_from_factura_line_item",
        entity: "device",
        entityId: link.device.id,
        message: `Asset value for ${link.device.assetTag || link.device.name} was applied from factura ${lineItem.factura.facturaNumber}.`,
        metadata: JSON.stringify({ facturaId: lineItem.factura.id, facturaLineItemId: lineItem.id, facturaLineItemAssetId: link.id, purchaseValue, currency: data.currency, overwriteExisting: options.overwriteExisting }),
      },
    });
  }
  return result;
}
