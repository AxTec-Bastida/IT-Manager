import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { parseList } from "@/lib/conflicts";
import { jsonError } from "@/lib/api";
import { assetFacturaExportFields } from "@/lib/facturas";

type Context = { params: Promise<{ type: string }> };

export async function GET(_request: Request, context: Context) {
  const { type } = await context.params;
  let rows: Record<string, unknown>[] = [];

  if (type === "devices") {
    const devices = await prisma.device.findMany({ orderBy: { name: "asc" }, include: { factura: true, photos: true } });
    rows = devices.map((device) => ({ ...device, ...assetFacturaExportFields(device) }));
  } else if (type === "ranges") {
    rows = await prisma.ipRange.findMany({ orderBy: { name: "asc" } });
  } else if (type === "conflicts") {
    const conflicts = await prisma.conflict.findMany({ where: { resolved: false }, orderBy: { createdAt: "desc" } });
    rows = conflicts.map((conflict) => ({
      ...conflict,
      affectedDeviceIds: parseList(conflict.affectedDeviceIds).join("|"),
      affectedIps: parseList(conflict.affectedIps).join("|"),
    }));
  } else if (type === "scan-results") {
    rows = await prisma.scanResult.findMany({ orderBy: { seenAt: "desc" }, take: 1000 });
  } else if (type === "stock-items") {
    const stockItems = await prisma.stockItem.findMany({ orderBy: { name: "asc" }, include: { factura: true } });
    rows = stockItems.map((item) => ({
      ...item,
      facturaNumber: item.factura?.facturaNumber ?? "",
      facturaVendor: item.factura?.vendorName ?? "",
      facturaPurchaseDate: item.factura?.purchaseDate?.toISOString().slice(0, 10) ?? "",
    }));
  } else if (type === "stock-movements") {
    const movements = await prisma.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 2000, include: { factura: true } });
    rows = movements.map((movement) => ({ ...movement, facturaNumber: movement.factura?.facturaNumber ?? "", facturaVendor: movement.factura?.vendorName ?? "" }));
  } else if (type === "facturas") {
    rows = await prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }] });
  } else if (type === "maintenance-records") {
    rows = await prisma.maintenanceRecord.findMany({ orderBy: { performedAt: "desc" }, take: 2000 });
  } else {
    return jsonError("Export type must be devices, ranges, conflicts, scan-results, stock-items, stock-movements, maintenance-records, or facturas.", 400);
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
