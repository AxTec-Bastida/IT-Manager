import { describe, expect, it } from "vitest";
import { calculateDepreciation, canEditAssetValue, canViewAssetValue, defaultUsefulLifeMonths } from "@/lib/depreciation";

describe("asset value depreciation helpers", () => {
  it("calculates straight-line depreciation with a residual floor", () => {
    const result = calculateDepreciation({
      purchaseValue: 1200,
      purchaseDate: new Date(2025, 0, 1),
      usefulLifeMonths: 12,
      residualPercent: 25,
      now: new Date(2025, 6, 1),
    });

    expect(result.hasValue).toBe(true);
    expect(result.ageMonths).toBe(6);
    expect(result.residualValue).toBe(300);
    expect(result.monthlyDepreciation).toBe(75);
    expect(result.currentEstimatedValue).toBe(750);
  });

  it("never depreciates below residual value", () => {
    const result = calculateDepreciation({
      purchaseValue: 1200,
      purchaseDate: new Date(2020, 0, 1),
      usefulLifeMonths: 12,
      residualPercent: 25,
      now: new Date(2025, 0, 1),
    });

    expect(result.currentEstimatedValue).toBe(300);
  });

  it("keeps future purchase dates at purchase value", () => {
    const result = calculateDepreciation({
      purchaseValue: 900,
      purchaseDate: new Date(2027, 0, 1),
      usefulLifeMonths: 36,
      now: new Date(2026, 0, 1),
    });

    expect(result.ageMonths).toBe(0);
    expect(result.currentEstimatedValue).toBe(900);
  });

  it("does not estimate missing or invalid purchase values", () => {
    expect(calculateDepreciation({ purchaseValue: null }).hasValue).toBe(false);
    expect(calculateDepreciation({ purchaseValue: 0 }).hasValue).toBe(false);
    expect(calculateDepreciation({ purchaseValue: -1 }).hasValue).toBe(false);
  });

  it("uses category default useful lives", () => {
    expect(defaultUsefulLifeMonths("LAPTOP")).toBe(36);
    expect(defaultUsefulLifeMonths("THERMAL_PRINTER")).toBe(48);
    expect(defaultUsefulLifeMonths("SCALE")).toBe(60);
    expect(defaultUsefulLifeMonths("OTHER")).toBe(36);
  });

  it("limits value visibility and editing by role", () => {
    expect(canViewAssetValue({ role: "ADMIN", isActive: true })).toBe(true);
    expect(canEditAssetValue({ role: "ADMIN", isActive: true })).toBe(true);
    expect(canViewAssetValue({ role: "IT_STAFF", isActive: true })).toBe(true);
    expect(canEditAssetValue({ role: "IT_STAFF", isActive: true })).toBe(true);
    expect(canViewAssetValue({ role: "AUDITOR", isActive: true })).toBe(true);
    expect(canEditAssetValue({ role: "AUDITOR", isActive: true })).toBe(false);
    expect(canViewAssetValue({ role: "VIEWER", isActive: true })).toBe(false);
    expect(canViewAssetValue({ role: "ADMIN", isActive: false })).toBe(false);
  });
});
