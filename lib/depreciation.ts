import type { AppRole, AssetValueProfile, DeviceCategory } from "@prisma/client";

export const DEFAULT_VALUE_CURRENCY = "MXN";
export const DEFAULT_RESIDUAL_PERCENT = 30;
export const DEFAULT_DEPRECIATION_METHOD = "STRAIGHT_LINE";

export type DepreciationInput = {
  purchaseValue?: number | null;
  purchaseDate?: Date | string | null;
  usefulLifeMonths?: number | null;
  residualPercent?: number | null;
  residualValue?: number | null;
  category?: DeviceCategory | string | null;
  now?: Date;
};

export type DepreciationResult = {
  hasValue: boolean;
  purchaseValue: number | null;
  purchaseDate: Date | null;
  usefulLifeMonths: number;
  residualPercent: number;
  residualValue: number | null;
  monthlyDepreciation: number | null;
  ageMonths: number | null;
  currentEstimatedValue: number | null;
  lastCalculatedAt: Date | null;
  reason?: string;
};

export type AssetValueProfileLike = Pick<
  AssetValueProfile,
  "purchaseValue" | "purchaseDate" | "usefulLifeMonths" | "residualPercent" | "residualValue" | "currentEstimatedValue" | "lastCalculatedAt" | "currency"
>;

export function canViewAssetValue(user: { role: AppRole; isActive?: boolean } | null | undefined) {
  if (!user || user.isActive === false) return false;
  return user.role === "ADMIN" || user.role === "IT_STAFF" || user.role === "AUDITOR";
}

export function canEditAssetValue(user: { role: AppRole; isActive?: boolean } | null | undefined) {
  if (!user || user.isActive === false) return false;
  return user.role === "ADMIN" || user.role === "IT_STAFF";
}

export function defaultUsefulLifeMonths(category?: DeviceCategory | string | null) {
  switch (category) {
    case "LAPTOP":
    case "DESKTOP":
    case "PHONE":
    case "TABLET":
    case "SCANNER":
    case "DOCKING_STATION":
      return 36;
    case "THERMAL_PRINTER":
    case "MFP_PRINTER":
    case "OTHER_PRINTER":
    case "ACCESS_POINT":
    case "SWITCH":
    case "CAMERA":
    case "NVR":
    case "CAMERA_NVR":
      return 48;
    case "SCALE":
      return 60;
    default:
      return 36;
  }
}

export function completedAgeMonths(purchaseDate: Date | string | null | undefined, now = new Date()) {
  const date = normalizeDate(purchaseDate);
  if (!date) return null;
  if (date > now) return 0;
  let months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months -= 1;
  return Math.max(0, months);
}

export function calculateDepreciation(input: DepreciationInput): DepreciationResult {
  const now = input.now ?? new Date();
  const purchaseValue = normalizeNumber(input.purchaseValue);
  const purchaseDate = normalizeDate(input.purchaseDate);
  const usefulLifeMonths = input.usefulLifeMonths && input.usefulLifeMonths > 0 ? input.usefulLifeMonths : defaultUsefulLifeMonths(input.category);
  const residualPercent = input.residualPercent == null ? DEFAULT_RESIDUAL_PERCENT : clamp(input.residualPercent, 0, 100);

  if (purchaseValue == null) {
    return emptyResult({ purchaseDate, usefulLifeMonths, residualPercent, reason: "Purchase value is not set." });
  }
  if (purchaseValue <= 0) {
    return emptyResult({ purchaseValue, purchaseDate, usefulLifeMonths, residualPercent, reason: "Purchase value must be greater than zero." });
  }
  if (!purchaseDate) {
    const residualValue = input.residualValue ?? roundCurrency(purchaseValue * (residualPercent / 100));
    return {
      hasValue: true,
      purchaseValue,
      purchaseDate: null,
      usefulLifeMonths,
      residualPercent,
      residualValue,
      monthlyDepreciation: null,
      ageMonths: null,
      currentEstimatedValue: purchaseValue,
      lastCalculatedAt: now,
      reason: "Purchase date is not set; current value remains the purchase value.",
    };
  }

  const residualValue = input.residualValue == null ? roundCurrency(purchaseValue * (residualPercent / 100)) : Math.max(0, input.residualValue);
  const ageMonths = completedAgeMonths(purchaseDate, now) ?? 0;
  const depreciableValue = Math.max(0, purchaseValue - residualValue);
  const monthlyDepreciation = usefulLifeMonths > 0 ? depreciableValue / usefulLifeMonths : 0;
  const estimated = Math.max(residualValue, purchaseValue - monthlyDepreciation * ageMonths);

  return {
    hasValue: true,
    purchaseValue,
    purchaseDate,
    usefulLifeMonths,
    residualPercent,
    residualValue: roundCurrency(residualValue),
    monthlyDepreciation: roundCurrency(monthlyDepreciation),
    ageMonths,
    currentEstimatedValue: roundCurrency(Math.min(purchaseValue, estimated)),
    lastCalculatedAt: now,
  };
}

export function buildAssetValueSummary(
  device: { category: DeviceCategory | string; purchaseDate?: Date | null; valueProfile?: AssetValueProfileLike | null },
  now = new Date(),
) {
  const profile = device.valueProfile;
  if (!profile) return calculateDepreciation({ category: device.category, purchaseDate: device.purchaseDate, now });
  return calculateDepreciation({
    purchaseValue: profile.purchaseValue,
    purchaseDate: profile.purchaseDate ?? device.purchaseDate,
    usefulLifeMonths: profile.usefulLifeMonths,
    residualPercent: profile.residualPercent,
    residualValue: profile.residualValue,
    category: device.category,
    now,
  });
}

export function formatMoney(value: number | null | undefined, currency = DEFAULT_VALUE_CURRENCY) {
  if (value == null || Number.isNaN(value)) return "Not set";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

export function formatAssetAge(months: number | null | undefined) {
  if (months == null) return "Unknown";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (!years) return `${remainder} month${remainder === 1 ? "" : "s"}`;
  if (!remainder) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} yr ${remainder} mo`;
}

function emptyResult(input: Partial<DepreciationResult>): DepreciationResult {
  return {
    hasValue: false,
    purchaseValue: input.purchaseValue ?? null,
    purchaseDate: input.purchaseDate ?? null,
    usefulLifeMonths: input.usefulLifeMonths ?? 36,
    residualPercent: input.residualPercent ?? DEFAULT_RESIDUAL_PERCENT,
    residualValue: null,
    monthlyDepreciation: null,
    ageMonths: null,
    currentEstimatedValue: null,
    lastCalculatedAt: null,
    reason: input.reason,
  };
}

function normalizeNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value);
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
