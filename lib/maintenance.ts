import type { DeviceCategory, MaintenanceResult, MaintenanceType } from "@prisma/client";

export const printerMaintenanceCategories = new Set<DeviceCategory>(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"]);
export const scaleMaintenanceCategories = new Set<DeviceCategory>(["SCALE"]);

export const printerMaintenanceDefaultDays = 30;
export const scaleMaintenanceDefaultDays = 90;
export const dueSoonDays = 7;

export type MaintenanceAsset = {
  id: string;
  name: string;
  assetTag?: string | null;
  category: DeviceCategory | string;
  maintenanceDueAt?: Date | string | null;
  lastCleanedAt?: Date | string | null;
  cleaningIntervalDays?: number | null;
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

export type MaintenanceStatus = "OK" | "DUE_SOON" | "OVERDUE" | "NO_SCHEDULE";

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

export function supportsMaintenanceFocus(asset: Pick<MaintenanceAsset, "category">) {
  return isPrinterAsset(asset) || isScaleAsset(asset);
}

export function defaultMaintenanceTypeForAsset(asset: Pick<MaintenanceAsset, "category">): MaintenanceType {
  if (isPrinterAsset(asset)) return "CLEAN_PRINTHEAD";
  if (isScaleAsset(asset)) return "CALIBRATION_CHECK";
  return "INSPECTION";
}

export function defaultNextDueAt(asset: Pick<MaintenanceAsset, "category">, performedAt: Date) {
  if (!supportsMaintenanceFocus(asset)) return null;
  if (isPrinterAsset(asset)) return addDays(performedAt, printerMaintenanceDefaultDays);
  if (isScaleAsset(asset)) return addDays(performedAt, scaleMaintenanceDefaultDays);
  return null;
}

export function scheduleStatus(nextDueAt?: Date | string | null, now = new Date()): MaintenanceStatus {
  const dueDate = normalizeDate(nextDueAt);
  if (!dueDate) return "NO_SCHEDULE";
  if (dueDate < startOfDay(now)) return "OVERDUE";
  if (dueDate <= addDays(startOfDay(now), dueSoonDays)) return "DUE_SOON";
  return "OK";
}

export function maintenanceStatusLabel(status: MaintenanceStatus) {
  return status === "OK" ? "OK" : status === "DUE_SOON" ? "Due soon" : status === "OVERDUE" ? "Overdue" : "No schedule";
}

export function maintenanceStatusTone(status: MaintenanceStatus) {
  if (status === "OK") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "DUE_SOON") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "OVERDUE") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function buildMaintenanceSummary(asset: MaintenanceAsset, now = new Date()) {
  const latest = [...(asset.maintenanceRecords ?? [])].sort((a, b) => normalizeDate(b.performedAt)!.getTime() - normalizeDate(a.performedAt)!.getTime())[0] ?? null;
  const nextDueAt = normalizeDate(asset.maintenanceDueAt) ?? normalizeDate(latest?.nextDueAt);
  const status = scheduleStatus(nextDueAt, now);
  return {
    latest,
    lastMaintenanceAt: normalizeDate(latest?.performedAt),
    lastResult: latest?.result ?? null,
    nextDueAt,
    status,
    failedOrFollowUp: (asset.maintenanceRecords ?? []).filter((record) => record.result === "FAIL" || record.result === "NEEDS_FOLLOW_UP"),
  };
}

export function summarizeMaintenanceReview<T extends MaintenanceAsset>(assets: T[], now = new Date()) {
  const printers = assets.filter(isPrinterAsset);
  const scales = assets.filter(isScaleAsset);
  const withSummaries = assets.map((asset) => ({ asset, summary: buildMaintenanceSummary(asset, now) }));
  return {
    printers,
    scales,
    printersMissingHistory: printers.filter((asset) => (asset.maintenanceRecords?.length ?? 0) === 0),
    scalesMissingHistory: scales.filter((asset) => (asset.maintenanceRecords?.length ?? 0) === 0),
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
