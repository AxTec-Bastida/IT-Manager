import type { FacturaStatus } from "@prisma/client";

export function normalizeLinkedIds(values: unknown) {
  const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : [];
  return [...new Set(list.map((value) => String(value).trim()).filter(Boolean))];
}

export function facturaRelationId(value: unknown) {
  const id = String(value ?? "").trim();
  return id || null;
}

export const facturaStatusLabels: Record<FacturaStatus, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  VOID: "Void",
  INVALID: "Invalid",
};

export function facturaStatusTone(status: FacturaStatus) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "ARCHIVED") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

export function activeFacturaWhere(showArchived = false) {
  return showArchived ? {} : { status: "ACTIVE" as FacturaStatus };
}

export type FacturaDeletionReview = {
  canHardDelete: boolean;
  blockers: string[];
};

export function reviewFacturaHardDeleteSafety(factura: {
  filePath?: string | null;
  xmlPath?: string | null;
  _count?: {
    assets?: number;
    stockItems?: number;
    stockMovements?: number;
    lineItems?: number;
    extractionAttempts?: number;
    tasks?: number;
    purchaseNotes?: number;
  };
}): FacturaDeletionReview {
  const blockers: string[] = [];
  const count = factura._count ?? {};
  if ((count.assets ?? 0) > 0) blockers.push(`${count.assets} linked asset(s)`);
  if ((count.stockItems ?? 0) > 0) blockers.push(`${count.stockItems} linked stock item(s)`);
  if ((count.stockMovements ?? 0) > 0) blockers.push(`${count.stockMovements} linked stock movement(s)`);
  if ((count.lineItems ?? 0) > 0) blockers.push(`${count.lineItems} line item(s)`);
  if ((count.extractionAttempts ?? 0) > 0) blockers.push(`${count.extractionAttempts} extraction attempt(s)`);
  if ((count.tasks ?? 0) > 0) blockers.push(`${count.tasks} related task(s)`);
  if ((count.purchaseNotes ?? 0) > 0) blockers.push(`${count.purchaseNotes} PO tracker note(s)`);
  if (factura.filePath) blockers.push("attached factura file");
  if (factura.xmlPath) blockers.push("attached XML file");
  return { canHardDelete: blockers.length === 0, blockers };
}

export function assetFacturaExportFields(asset: {
  factura?: {
    facturaNumber: string;
    vendorName: string;
    purchaseDate: Date | null;
    totalAmount: number | null;
    currency: string;
  } | null;
  photos?: unknown[];
}) {
  return {
    facturaNumber: asset.factura?.facturaNumber ?? "",
    facturaVendor: asset.factura?.vendorName ?? "",
    facturaPurchaseDate: asset.factura?.purchaseDate?.toISOString().slice(0, 10) ?? "",
    facturaCost: asset.factura?.totalAmount ?? "",
    facturaCurrency: asset.factura?.currency ?? "",
    photoCount: asset.photos?.length ?? 0,
  };
}
