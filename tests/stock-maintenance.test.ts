import { describe, expect, it } from "vitest";
import { buildPrinterAlertCandidates, buildStockAlertCandidates, isMfpSupplyLow, isThermalCleaningDue, suppressDuplicateAlerts } from "@/lib/maintenance-alerts";
import { calculateStockMovement, isLowStock } from "@/lib/stock";

const baseAsset = {
  id: "asset-1",
  name: "PACK-ZT411-01",
  category: "THERMAL_PRINTER" as const,
  blackTonerLevel: null,
  cyanTonerLevel: null,
  magentaTonerLevel: null,
  yellowTonerLevel: null,
  drumLevel: null,
  lowSupplyThreshold: null,
  lastCleanedAt: null,
  cleaningIntervalDays: null,
  lastPrintheadReplacementAt: null,
  lastPlatenRollerReplacementAt: null,
  maintenanceDueAt: null,
};

describe("stock quantity logic", () => {
  it("adds, removes, and adjusts stock quantities", () => {
    expect(calculateStockMovement({ currentQuantity: 5, movementType: "ADD", quantity: 3 }).newQuantity).toBe(8);
    expect(calculateStockMovement({ currentQuantity: 5, movementType: "REMOVE", quantity: 2 }).newQuantity).toBe(3);
    expect(calculateStockMovement({ currentQuantity: 5, movementType: "ADJUST", quantity: 1, adjustmentTarget: 9 }).newQuantity).toBe(9);
  });

  it("does not allow stock to go below zero", () => {
    expect(() => calculateStockMovement({ currentQuantity: 1, movementType: "USED_FOR_REPAIR", quantity: 2 })).toThrow("below zero");
  });

  it("detects low stock", () => {
    expect(isLowStock(2, 2)).toBe(true);
    expect(isLowStock(3, 2)).toBe(false);
  });
});

describe("printer maintenance and supply alerts", () => {
  it("detects thermal cleaning due without creating MFP supply alerts", () => {
    expect(isThermalCleaningDue(baseAsset, new Date("2026-05-05"))).toBe(true);
    expect(isMfpSupplyLow(baseAsset)).toEqual([]);
  });

  it("detects MFP low toner and maintenance kit thresholds", () => {
    const lowMfp = {
      ...baseAsset,
      category: "MFP_PRINTER" as const,
      name: "ADMIN-MFP-01",
      blackTonerLevel: 10,
      cyanTonerLevel: 50,
      magentaTonerLevel: 18,
      yellowTonerLevel: null,
      drumLevel: 4,
      lowSupplyThreshold: 20,
    };
    expect(isMfpSupplyLow(lowMfp).map((item) => item.label)).toEqual(["Black toner", "Magenta toner", "Drum"]);
  });

  it("builds stock and printer alert candidates", () => {
    const stockAlerts = buildStockAlertCandidates([{ id: "stock-1", name: "ZT411 Printhead", quantityOnHand: 1, minimumQuantity: 2 } as never]);
    const printerAlerts = buildPrinterAlertCandidates([{ ...baseAsset, lastCleanedAt: new Date("2026-01-01"), cleaningIntervalDays: 30 }], new Date("2026-05-05"));
    expect(stockAlerts[0].type).toBe("LOW_STOCK");
    expect(printerAlerts[0].type).toBe("THERMAL_CLEANING_DUE");
  });

  it("suppresses duplicate alert spam by type and linked record", () => {
    const alerts = suppressDuplicateAlerts([
      { type: "LOW_STOCK" as const, stockItemId: "stock-1" },
      { type: "LOW_STOCK" as const, stockItemId: "stock-1" },
      { type: "LOW_STOCK" as const, stockItemId: "stock-2" },
    ]);
    expect(alerts).toHaveLength(2);
  });
});
