import type { DeviceCategory, DeviceStatus, MaintenanceResult, MaintenanceType } from "@prisma/client";
import { isSledAsset as checkSledAsset } from "@/lib/asset-display";

export const printerMaintenanceCategories = new Set<DeviceCategory>(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"]);
export const scaleMaintenanceCategories = new Set<DeviceCategory>(["SCALE"]);

export const printerMaintenanceDefaultDays = 30;
export const scaleMaintenanceDefaultDays = 90;
export const printerStockMaintenanceDefaultDays = 180;
export const scaleStockMaintenanceDefaultDays = 365;
export const dueSoonDays = 7;

export type MaintenanceAsset = {
  id: string;
  name: string;
  assetTag?: string | null;
  category: DeviceCategory | string;
  status?: DeviceStatus | string | null;
  location?: string | null;
  areaDepartment?: string | null;
  maintenanceDueAt?: Date | string | null;
  lastCleanedAt?: Date | string | null;
  cleaningIntervalDays?: number | null;
  brand?: string | null;
  model?: string | null;
  maintenanceRecords?: Array<{
    id: string;
    maintenanceType: MaintenanceType;
    result: MaintenanceResult;
    performedAt: Date | string;
    nextDueAt?: Date | string | null;
    notes?: string | null;
    testWeight?: string | null;
    measuredValue?: string | null;
    expectedValue?: string | null;
    resultDetails?: string | null;
    vendorTicket?: string | null;
  }>;
};

export type MaintenanceContext = "ACTIVE" | "STOCK" | "SPARE" | "STORAGE" | "RETIRED" | "DECOMMISSIONED";
export type MaintenanceStatus = "OK" | "DUE_SOON" | "OVERDUE" | "NO_SCHEDULE" | "EXCLUDED";
export type MaintenanceProfile = {
  context: MaintenanceContext;
  intervalDays: number | null;
  label: string;
  explanation: string;
};

export const maintenanceResultLabels: Record<MaintenanceResult, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  NEEDS_FOLLOW_UP: "Needs follow-up",
};

export const maintenanceResultOptions = Object.keys(maintenanceResultLabels) as MaintenanceResult[];

export const testPrintResultOptions = [
  "Good print",
  "Faded",
  "Lines/missing dots",
  "Label alignment issue",
  "Sensor issue",
  "Ribbon/label issue",
];

export function isPrinterAsset(asset: Pick<MaintenanceAsset, "category">) {
  return printerMaintenanceCategories.has(asset.category as DeviceCategory);
}

export function isScaleAsset(asset: Pick<MaintenanceAsset, "category">) {
  return scaleMaintenanceCategories.has(asset.category as DeviceCategory);
}

export function isScannerAsset(asset: Pick<MaintenanceAsset, "category">) {
  return asset.category === "SCANNER";
}

export function isSledAsset(asset: Pick<MaintenanceAsset, "category" | "name" | "assetTag" | "brand" | "model">) {
  return checkSledAsset({
    category: asset.category,
    name: asset.name,
    assetTag: asset.assetTag,
    brand: asset.brand,
    model: asset.model,
  });
}

export function supportsMaintenanceFocus(asset: Pick<MaintenanceAsset, "category" | "name" | "assetTag" | "brand" | "model">) {
  return isPrinterAsset(asset) || isScaleAsset(asset) || isScannerAsset(asset) || isSledAsset(asset);
}

export function maintenanceContextForAsset(asset: Pick<MaintenanceAsset, "status" | "location" | "areaDepartment">): MaintenanceContext {
  if (asset.status === "DISPOSED") return "DECOMMISSIONED";
  if (["RETIRED", "MISSING", "LOST"].includes(String(asset.status ?? ""))) return "RETIRED";
  const locationText = `${asset.location ?? ""} ${asset.areaDepartment ?? ""}`.toLowerCase();
  if (/\b(spare|backup|reserve|reserved)\b/.test(locationText) || asset.status === "RESERVED") return "SPARE";
  if (/\b(stock|stockroom|warehouse|almacen|almac[eé]n)\b/.test(locationText)) return "STOCK";
  if (/\b(storage|stored|bodega)\b/.test(locationText) || asset.status === "AVAILABLE") return "STORAGE";
  return "ACTIVE";
}

export function isMaintenanceExcluded(asset: Pick<MaintenanceAsset, "status" | "location" | "areaDepartment">) {
  const context = maintenanceContextForAsset(asset);
  return context === "RETIRED" || context === "DECOMMISSIONED";
}

export function maintenanceProfileForAsset(asset: Pick<MaintenanceAsset, "category" | "status" | "location" | "areaDepartment" | "name" | "assetTag" | "brand" | "model">): MaintenanceProfile {
  if (!supportsMaintenanceFocus(asset)) {
    return { context: "DECOMMISSIONED", intervalDays: null, label: "Not tracked", explanation: "This category does not use the printer/scale maintenance schedule." };
  }
  const context = maintenanceContextForAsset(asset);
  if (context === "RETIRED" || context === "DECOMMISSIONED") {
    return { context, intervalDays: null, label: context === "RETIRED" ? "Retired" : "Decommissioned", explanation: "Retired, lost, missing, or disposed assets are excluded from normal recurring maintenance alerts." };
  }
  const stockLike = context === "STOCK" || context === "SPARE" || context === "STORAGE";
  if (isScaleAsset(asset)) {
    const intervalDays = stockLike ? scaleStockMaintenanceDefaultDays : scaleMaintenanceDefaultDays;
    return {
      context,
      intervalDays,
      label: stockLike ? "Scale stock/spare profile" : "Scale active profile",
      explanation: stockLike ? "Stock, spare, and stored scales use a longer yearly baseline interval." : "Active scales use a 3-month calibration/check interval.",
    };
  }
  if (isPrinterAsset(asset)) {
    const intervalDays = stockLike ? printerStockMaintenanceDefaultDays : printerMaintenanceDefaultDays;
    return {
      context,
      intervalDays,
      label: stockLike ? "Printer stock/spare profile" : "Printer active profile",
      explanation: stockLike ? "Stock, spare, and stored printers use a longer 6-month baseline interval." : "Active printers use the normal monthly maintenance interval.",
    };
  }
  if (isScannerAsset(asset)) {
    const intervalDays = stockLike ? 365 : 180;
    return {
      context,
      intervalDays,
      label: stockLike ? "Scanner stock/spare profile" : "Scanner active profile",
      explanation: stockLike ? "Stock, spare, and stored scanners use a longer yearly baseline interval." : "Active scanners use a 6-month cleaning/check interval.",
    };
  }
  if (isSledAsset(asset)) {
    const intervalDays = stockLike ? 365 : 180;
    return {
      context,
      intervalDays,
      label: stockLike ? "Sled stock/spare profile" : "Sled active profile",
      explanation: stockLike ? "Stock, spare, and stored sleds use a longer yearly baseline interval." : "Active sleds use a 6-month physical/functional check interval.",
    };
  }
  return { context: "DECOMMISSIONED", intervalDays: null, label: "Not tracked", explanation: "This category does not use the printer/scale maintenance schedule." };
}

export function defaultMaintenanceTypeForAsset(asset: Pick<MaintenanceAsset, "category" | "name" | "assetTag" | "brand" | "model">): MaintenanceType {
  if (isPrinterAsset(asset)) return "CLEAN_PRINTHEAD";
  if (isScaleAsset(asset)) return "CALIBRATION_CHECK";
  return "INSPECTION";
}

export function defaultNextDueAt(asset: Pick<MaintenanceAsset, "category" | "status" | "location" | "areaDepartment" | "name" | "assetTag" | "brand" | "model">, performedAt: Date) {
  if (!supportsMaintenanceFocus(asset)) return null;
  const profile = maintenanceProfileForAsset(asset);
  return profile.intervalDays ? addDays(performedAt, profile.intervalDays) : null;
}

export function scheduleStatus(nextDueAt?: Date | string | null, now = new Date()): MaintenanceStatus {
  const dueDate = normalizeDate(nextDueAt);
  if (!dueDate) return "NO_SCHEDULE";
  if (dueDate < startOfDay(now)) return "OVERDUE";
  if (dueDate <= addDays(startOfDay(now), dueSoonDays)) return "DUE_SOON";
  return "OK";
}

export function maintenanceStatusLabel(status: MaintenanceStatus) {
  return status === "OK" ? "OK" : status === "DUE_SOON" ? "Due soon" : status === "OVERDUE" ? "Overdue" : status === "EXCLUDED" ? "Excluded" : "No schedule";
}

export function maintenanceStatusTone(status: MaintenanceStatus) {
  if (status === "OK") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "DUE_SOON") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "OVERDUE") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "EXCLUDED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function buildMaintenanceSummary(asset: MaintenanceAsset, now = new Date()) {
  const latest = [...(asset.maintenanceRecords ?? [])].sort((a, b) => normalizeDate(b.performedAt)!.getTime() - normalizeDate(a.performedAt)!.getTime())[0] ?? null;
  const profile = maintenanceProfileForAsset(asset);
  const nextDueAt = profile.intervalDays ? normalizeDate(asset.maintenanceDueAt) ?? normalizeDate(latest?.nextDueAt) : null;
  const status = profile.intervalDays ? scheduleStatus(nextDueAt, now) : "EXCLUDED";
  return {
    latest,
    profile,
    lastMaintenanceAt: normalizeDate(latest?.performedAt),
    lastResult: latest?.result ?? null,
    nextDueAt,
    status,
    failedOrFollowUp: (asset.maintenanceRecords ?? []).filter((record) => record.result === "FAIL" || record.result === "NEEDS_FOLLOW_UP"),
  };
}

export function summarizeMaintenanceReview<T extends MaintenanceAsset>(assets: T[], now = new Date()) {
  const activeAssets = assets.filter((asset) => !isMaintenanceExcluded(asset));
  const excluded = assets.filter(isMaintenanceExcluded);
  const printers = activeAssets.filter(isPrinterAsset);
  const scales = activeAssets.filter(isScaleAsset);
  const scanners = activeAssets.filter(isScannerAsset);
  const sleds = activeAssets.filter(isSledAsset);
  const withSummaries = assets.map((asset) => ({ asset, summary: buildMaintenanceSummary(asset, now) }));
  return {
    printers,
    scales,
    scanners,
    sleds,
    excluded,
    printersMissingHistory: printers.filter((asset) => (asset.maintenanceRecords?.length ?? 0) === 0),
    scalesMissingHistory: scales.filter((asset) => (asset.maintenanceRecords?.length ?? 0) === 0),
    scannersMissingHistory: scanners.filter((asset) => (asset.maintenanceRecords?.length ?? 0) === 0),
    sledsMissingHistory: sleds.filter((asset) => (asset.maintenanceRecords?.length ?? 0) === 0),
    overdue: withSummaries.filter((item) => item.summary.status === "OVERDUE").map((item) => item.asset),
    dueSoon: withSummaries.filter((item) => item.summary.status === "DUE_SOON").map((item) => item.asset),
    noSchedule: withSummaries.filter((item) => supportsMaintenanceFocus(item.asset) && item.summary.status === "NO_SCHEDULE").map((item) => item.asset),
    failedNeedsFollowUp: withSummaries.flatMap((item) => item.summary.failedOrFollowUp.map((record) => ({ asset: item.asset, record }))),
  };
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function normalizeDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
