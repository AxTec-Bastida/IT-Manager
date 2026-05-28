export function normalizeLinkedIds(values: unknown) {
  const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : [];
  return [...new Set(list.map((value) => String(value).trim()).filter(Boolean))];
}

export function facturaRelationId(value: unknown) {
  const id = String(value ?? "").trim();
  return id || null;
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
