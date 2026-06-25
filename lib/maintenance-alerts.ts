import type { AlertSeverity, AlertSource, AlertType, Device, StockItem } from "@prisma/client";
import { isMaintenanceExcluded } from "./maintenance";
import { isLowStock } from "./stock";

type AlertCandidate = {
  type: AlertType;
  source?: AlertSource;
  severity: AlertSeverity;
  title: string;
  message: string;
  assetId?: string;
  stockItemId?: string;
  metadata?: string;
  duplicateKey?: string;
};

type PrinterAsset = Pick<
  Device,
  | "id"
  | "name"
  | "category"
  | "status"
  | "location"
  | "areaDepartment"
  | "blackTonerLevel"
  | "cyanTonerLevel"
  | "magentaTonerLevel"
  | "yellowTonerLevel"
  | "drumLevel"
  | "lowSupplyThreshold"
  | "lastCleanedAt"
  | "cleaningIntervalDays"
  | "lastPrintheadReplacementAt"
  | "lastPlatenRollerReplacementAt"
  | "maintenanceDueAt"
>;

type StockAlertItem = Pick<StockItem, "id" | "name" | "quantityOnHand" | "minimumQuantity">;

export function isThermalCleaningDue(asset: PrinterAsset, now = new Date()) {
  if (isMaintenanceExcluded(asset)) return false;
  if (asset.category !== "THERMAL_PRINTER") return false;
  const intervalDays = asset.cleaningIntervalDays ?? 30;
  if (!asset.lastCleanedAt) return true;
  const nextDue = new Date(asset.lastCleanedAt);
  nextDue.setDate(nextDue.getDate() + intervalDays);
  return nextDue <= now;
}

export function isMfpSupplyLow(asset: PrinterAsset, threshold = asset.lowSupplyThreshold ?? 20) {
  if (isMaintenanceExcluded(asset)) return [];
  if (asset.category !== "MFP_PRINTER") return [];
  const levels = [
    ["Black toner", asset.blackTonerLevel, "MFP_LOW_TONER" as AlertType],
    ["Cyan toner", asset.cyanTonerLevel, "MFP_LOW_TONER" as AlertType],
    ["Magenta toner", asset.magentaTonerLevel, "MFP_LOW_TONER" as AlertType],
    ["Yellow toner", asset.yellowTonerLevel, "MFP_LOW_TONER" as AlertType],
    ["Drum", asset.drumLevel, "MFP_DRUM_LOW" as AlertType],
  ] as const;

  return levels.filter(([, level]) => level != null && level <= threshold).map(([label, level, type]) => ({ label, level: level!, type }));
}

export function isMaintenanceDue(asset: PrinterAsset, now = new Date()) {
  if (isMaintenanceExcluded(asset)) return false;
  return Boolean(asset.maintenanceDueAt && asset.maintenanceDueAt <= now);
}

export function buildStockAlertCandidates(items: StockAlertItem[]): AlertCandidate[] {
  return items
    .filter((item) => isLowStock(item.quantityOnHand, item.minimumQuantity))
    .map((item) => ({
      type: "LOW_STOCK",
      source: "STOCK",
      severity: item.quantityOnHand <= 0 ? "HIGH" : "MEDIUM",
      title: `${item.name} is low`,
      message: `${item.name} has ${item.quantityOnHand} on hand. Minimum is ${item.minimumQuantity}.`,
      stockItemId: item.id,
    }));
}

export function buildPrinterAlertCandidates(assets: PrinterAsset[], now = new Date()): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  for (const asset of assets) {
    if (isThermalCleaningDue(asset, now)) {
      candidates.push({
        type: "THERMAL_CLEANING_DUE",
        source: "PRINTER",
        severity: "MEDIUM",
        title: `${asset.name} cleaning due`,
        message: "Thermal printer cleaning is due based on the configured interval and last cleaned date.",
        assetId: asset.id,
      });
    }

    if (asset.category === "THERMAL_PRINTER" && isMaintenanceDue(asset, now)) {
      candidates.push({
        type: "THERMAL_MAINTENANCE_DUE",
        source: "PRINTER",
        severity: "MEDIUM",
        title: `${asset.name} maintenance due`,
        message: "Preventive maintenance is due for this thermal printer.",
        assetId: asset.id,
      });
    }

    for (const supply of isMfpSupplyLow(asset)) {
      candidates.push({
        type: supply.type,
        source: "PRINTER",
        severity: supply.level <= 5 ? "HIGH" : "MEDIUM",
        title: `${asset.name} ${supply.label} low`,
        message: `${supply.label} is at ${supply.level}%.`,
        assetId: asset.id,
      });
    }
  }
  return candidates;
}

export function alertDuplicateKey(alert: { type: AlertType; assetId?: string | null; stockItemId?: string | null }) {
  return `${alert.type}:${alert.assetId ?? ""}:${alert.stockItemId ?? ""}`;
}

export function suppressDuplicateAlerts<T extends { type: AlertType; assetId?: string | null; stockItemId?: string | null }>(alerts: T[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = alertDuplicateKey(alert);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
