import { NextRequest, NextResponse } from "next/server";
import { DeviceCategory, DeviceStatus, StockCategory, StockItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { deviceSchema, ipRangeSchema, stockItemSchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";

const categoryAliases = new Map<string, DeviceCategory>(
  Object.values(DeviceCategory).map((value) => [value.toLowerCase(), value]),
);
const statusAliases = new Map<string, DeviceStatus>(Object.values(DeviceStatus).map((value) => [value.toLowerCase(), value]));
const stockCategoryAliases = new Map<string, StockCategory>(Object.values(StockCategory).map((value) => [value.toLowerCase(), value]));
const stockItemTypeAliases = new Map<string, StockItemType>(Object.values(StockItemType).map((value) => [value.toLowerCase(), value]));

function enumValue<T>(aliases: Map<string, T>, value: string, fallback: T): T {
  return aliases.get(value.trim().replace(/\s+/g, "_").replace(/\//g, "_").toLowerCase()) ?? fallback;
}

function mapStockRow(row: Record<string, string>) {
  return {
    name: row.name,
    sku: row.sku || null,
    category: enumValue(stockCategoryAliases, row.category || "OTHER", "OTHER"),
    itemType: enumValue(stockItemTypeAliases, row.itemType || "CONSUMABLE", "CONSUMABLE"),
    compatibleModels: row.compatibleModels || null,
    quantityOnHand: row.quantityOnHand || row.quantity || 0,
    minimumQuantity: row.minimumQuantity || row.minimum || 0,
    reorderQuantity: row.reorderQuantity || null,
    unitCost: row.unitCost || null,
    currency: row.currency || "USD",
    vendorName: row.vendorName || row.vendor || null,
    storageLocation: row.storageLocation || row.location || null,
    notes: row.notes || null,
    active: row.active == null || row.active === "" ? true : row.active.toLowerCase() !== "false",
  };
}

function mapDeviceRow(row: Record<string, string>) {
  return {
    name: row.name || row.deviceName,
    category: enumValue(categoryAliases, row.category || "OTHER", "OTHER"),
    ipAddress: row.ipAddress || row.ip || row["IP Address"],
    macAddress: row.macAddress || row.mac || null,
    vlan: row.vlan,
    location: row.location || null,
    brand: row.brand || null,
    model: row.model || null,
    serialNumber: row.serialNumber || row.serial || null,
    status: enumValue(statusAliases, row.status || "ACTIVE", "ACTIVE"),
    assignedTo: row.assignedTo || row.department || null,
    notes: row.notes || null,
    lastSeenAt: row.lastSeenAt || null,
    ipRangeId: row.ipRangeId || null,
  };
}

function mapRangeRow(row: Record<string, string>) {
  return {
    name: row.name,
    category: enumValue(categoryAliases, row.category || "OTHER", "OTHER"),
    vlan: row.vlan,
    subnet: row.subnet || null,
    startIp: row.startIp || row.start,
    endIp: row.endIp || row.end,
    location: row.location || null,
    notes: row.notes || null,
    active: row.active == null || row.active === "" ? true : row.active.toLowerCase() !== "false",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = String(body.type ?? "devices");
    const commit = body.commit === true;
    const rows = parseCsv(String(body.csv ?? ""));

    if (!["devices", "ranges", "stock-items"].includes(type)) return jsonError("Import type must be devices, ranges, or stock-items.", 400);

    const preview: Array<{ row: number; data: Record<string, unknown>; ok: boolean; errors: string[] }> = rows.map((row, index) => {
      const mapped = type === "devices" ? mapDeviceRow(row) : type === "stock-items" ? mapStockRow(row) : mapRangeRow(row);
      const parsed = type === "devices" ? deviceSchema.safeParse(mapped) : type === "stock-items" ? stockItemSchema.safeParse(mapped) : ipRangeSchema.safeParse(mapped);
      return {
        row: index + 2,
        data: mapped,
        ok: parsed.success,
        errors: parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      };
    });

    if (type === "devices") {
      const seenIps = new Map<string, number>();
      for (const item of preview) {
        const ip = String(item.data.ipAddress ?? "");
        if (!ip) continue;
        if (seenIps.has(ip)) item.errors.push(`Duplicate IP in CSV. First seen on row ${seenIps.get(ip)}.`);
        seenIps.set(ip, item.row);
      }

      const existingIps = await prisma.device.findMany({
        where: { ipAddress: { in: preview.map((item) => String(item.data.ipAddress ?? "")).filter(Boolean) } },
        select: { ipAddress: true, name: true },
      });
      const existingByIp = new Map(existingIps.map((device) => [device.ipAddress, device.name]));
      for (const item of preview) {
        const existingName = existingByIp.get(String(item.data.ipAddress ?? ""));
        if (existingName) item.errors.push(`IP already exists in inventory on ${existingName}.`);
      }
    }

    if (type === "stock-items") {
      const seenSkus = new Map<string, number>();
      for (const item of preview) {
        const sku = String(item.data.sku ?? "");
        if (!sku) continue;
        if (seenSkus.has(sku)) item.errors.push(`Duplicate SKU in CSV. First seen on row ${seenSkus.get(sku)}.`);
        seenSkus.set(sku, item.row);
      }
      const existingSkus = await prisma.stockItem.findMany({
        where: { sku: { in: preview.map((item) => String(item.data.sku ?? "")).filter(Boolean) } },
        select: { sku: true, name: true },
      });
      const existingBySku = new Map(existingSkus.map((item) => [item.sku, item.name]));
      for (const item of preview) {
        const existingName = existingBySku.get(String(item.data.sku ?? ""));
        if (existingName) item.errors.push(`SKU already exists on ${existingName}.`);
      }
    }

    const validRows = preview.filter((item) => item.ok && item.errors.length === 0);

    if (!commit) {
      return NextResponse.json({ preview, validCount: validRows.length, errorCount: preview.length - validRows.length });
    }

    if (validRows.length !== preview.length) {
      return jsonError("Fix import errors before committing.", 422, preview);
    }

    if (type === "devices") {
      await prisma.device.createMany({ data: validRows.map((item) => deviceSchema.parse(item.data)) });
    } else if (type === "stock-items") {
      await prisma.stockItem.createMany({ data: validRows.map((item) => stockItemSchema.parse(item.data)) });
    } else {
      await prisma.ipRange.createMany({ data: validRows.map((item) => ipRangeSchema.parse(item.data)) });
    }

    await prisma.activityLog.create({
      data: {
        action: `${type}.imported`,
        entity: type,
        message: `Imported ${validRows.length} ${type} from CSV.`,
      },
    });

    return NextResponse.json({ imported: validRows.length });
  } catch (error) {
    return handleApiError(error);
  }
}
