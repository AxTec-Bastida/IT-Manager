import { describe, expect, it } from "vitest";
import { maintenanceRecordSchema } from "@/lib/validation";
import {
  buildMaintenanceSummary,
  defaultMaintenanceTypeForAsset,
  defaultNextDueAt,
  isScannerAsset,
  isSledAsset,
  maintenanceProfileForAsset,
  scheduleStatus,
  summarizeMaintenanceReview,
} from "@/lib/maintenance";

const printer = {
  id: "printer-1",
  name: "PACK-ZT411-01",
  assetTag: "PRN-001",
  category: "THERMAL_PRINTER" as const,
  maintenanceDueAt: null,
  lastCleanedAt: null,
  cleaningIntervalDays: null,
  maintenanceRecords: [],
};

const scale = {
  id: "scale-1",
  name: "PACK-SCALE-01",
  assetTag: "SCALE-001",
  category: "SCALE" as const,
  maintenanceDueAt: null,
  lastCleanedAt: null,
  cleaningIntervalDays: null,
  maintenanceRecords: [],
};

describe("printer and scale maintenance helpers", () => {
  it("uses focused default maintenance types for printers and scales", () => {
    expect(defaultMaintenanceTypeForAsset(printer)).toBe("CLEAN_PRINTHEAD");
    expect(defaultMaintenanceTypeForAsset(scale)).toBe("CALIBRATION_CHECK");
  });

  it("sets default follow-up schedules without polling equipment", () => {
    const performedAt = new Date("2026-06-01T08:00:00.000Z");
    expect(defaultNextDueAt(printer, performedAt)?.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(defaultNextDueAt(scale, performedAt)?.toISOString().slice(0, 10)).toBe("2026-08-30");
  });

  it("uses longer stock/spare profiles and excludes retired assets", () => {
    const performedAt = new Date("2026-06-01T08:00:00.000Z");
    const spareScale = { ...scale, status: "RESERVED" as const };
    const retiredPrinter = { ...printer, status: "RETIRED" as const };

    expect(maintenanceProfileForAsset(spareScale).intervalDays).toBe(365);
    expect(defaultNextDueAt(spareScale, performedAt)?.toISOString().slice(0, 10)).toBe("2027-06-01");
    expect(maintenanceProfileForAsset(retiredPrinter).intervalDays).toBeNull();
    expect(buildMaintenanceSummary(retiredPrinter).status).toBe("EXCLUDED");
  });

  it("classifies overdue, due soon, clear, and unscheduled dates", () => {
    const now = new Date("2026-06-16T12:00:00.000Z");
    expect(scheduleStatus(null, now)).toBe("NO_SCHEDULE");
    expect(scheduleStatus("2026-06-15", now)).toBe("OVERDUE");
    expect(scheduleStatus("2026-06-20", now)).toBe("DUE_SOON");
    expect(scheduleStatus("2026-07-01", now)).toBe("OK");
  });

  it("summarizes missing baselines and failed follow-up records", () => {
    const failedPrinter = {
      ...printer,
      id: "printer-2",
      maintenanceDueAt: "2026-06-10",
      maintenanceRecords: [
        {
          id: "record-1",
          maintenanceType: "TEST_PRINT" as const,
          result: "FAIL" as const,
          performedAt: new Date("2026-06-10T08:00:00.000Z"),
          nextDueAt: new Date("2026-06-11T08:00:00.000Z"),
          notes: "Lines on print test.",
        },
      ],
    };
    const review = summarizeMaintenanceReview([printer, scale, failedPrinter], new Date("2026-06-16T12:00:00.000Z"));
    expect(review.printersMissingHistory.map((asset) => asset.id)).toContain("printer-1");
    expect(review.scalesMissingHistory.map((asset) => asset.id)).toEqual(["scale-1"]);
    expect(review.overdue.map((asset) => asset.id)).toContain("printer-2");
    expect(review.noSchedule.map((asset) => asset.id)).toEqual(["printer-1", "scale-1"]);
    expect(review.failedNeedsFollowUp[0].record.result).toBe("FAIL");
  });

  it("does not count retired assets as missing schedules", () => {
    const review = summarizeMaintenanceReview([{ ...printer, id: "retired-printer", status: "RETIRED" }], new Date("2026-06-16T12:00:00.000Z"));

    expect(review.excluded.map((asset) => asset.id)).toEqual(["retired-printer"]);
    expect(review.noSchedule).toHaveLength(0);
  });

  it("builds latest result and next due summary from maintenance history", () => {
    const summary = buildMaintenanceSummary({
      ...scale,
      maintenanceRecords: [
        {
          id: "record-1",
          maintenanceType: "CALIBRATION_CHECK" as const,
          result: "PASS" as const,
          performedAt: new Date("2026-06-01T08:00:00.000Z"),
          nextDueAt: new Date("2026-08-30T08:00:00.000Z"),
          notes: null,
        },
      ],
    }, new Date("2026-06-16T12:00:00.000Z"));
    expect(summary.lastResult).toBe("PASS");
    expect(summary.nextDueAt?.toISOString().slice(0, 10)).toBe("2026-08-30");
    expect(summary.status).toBe("OK");
  });
});

describe("scanner and sled maintenance helpers", () => {
  const scanner = {
    id: "scanner-1",
    name: "Symbol Barcode Scanner",
    assetTag: "GHT-SCN-001",
    category: "SCANNER" as const,
    maintenanceDueAt: null,
    lastCleanedAt: null,
    cleaningIntervalDays: null,
    maintenanceRecords: [],
  };

  const sled = {
    id: "sled-1",
    name: "Infinite Peripherals Sled Device",
    assetTag: "GHT-SLD-001",
    category: "OTHER" as const,
    brand: "Infinite Peripherals",
    model: "Infinea Tab",
    maintenanceDueAt: null,
    lastCleanedAt: null,
    cleaningIntervalDays: null,
    maintenanceRecords: [],
  };

  it("identifies scanner and sled assets correctly", () => {
    expect(isScannerAsset(scanner)).toBe(true);
    expect(isSledAsset(sled)).toBe(true);
    expect(isScannerAsset(sled)).toBe(false);
    expect(isSledAsset(scanner)).toBe(false);
  });

  it("uses INSPECTION as default maintenance type for scanners and sleds", () => {
    expect(defaultMaintenanceTypeForAsset(scanner)).toBe("INSPECTION");
    expect(defaultNextDueAt(scanner, new Date("2026-06-01T08:00:00.000Z"))?.toISOString().slice(0, 10)).toBe("2026-11-28");
  });

  it("uses longer stock/spare profiles for scanners/sleds and shorter profiles for active ones", () => {
    const performedAt = new Date("2026-06-01T08:00:00.000Z");
    const activeScanner = { ...scanner, status: "IN_USE" as const };
    const stockScanner = { ...scanner, status: "AVAILABLE" as const };
    const activeSled = { ...sled, status: "IN_USE" as const };
    const spareSled = { ...sled, status: "RESERVED" as const };

    expect(maintenanceProfileForAsset(activeScanner).intervalDays).toBe(180);
    expect(maintenanceProfileForAsset(stockScanner).intervalDays).toBe(365);
    expect(maintenanceProfileForAsset(activeSled).intervalDays).toBe(180);
    expect(maintenanceProfileForAsset(spareSled).intervalDays).toBe(365);

    expect(defaultNextDueAt(activeScanner, performedAt)?.toISOString().slice(0, 10)).toBe("2026-11-28");
    expect(defaultNextDueAt(stockScanner, performedAt)?.toISOString().slice(0, 10)).toBe("2027-06-01");
    expect(defaultNextDueAt(activeSled, performedAt)?.toISOString().slice(0, 10)).toBe("2026-11-28");
    expect(defaultNextDueAt(spareSled, performedAt)?.toISOString().slice(0, 10)).toBe("2027-06-01");
  });

  it("summarizes missing history for active scanners and sleds in maintenance review", () => {
    const review = summarizeMaintenanceReview([scanner, sled], new Date("2026-06-16T12:00:00.000Z"));
    expect(review.scanners.map((a) => a.id)).toContain("scanner-1");
    expect(review.sleds.map((a) => a.id)).toContain("sled-1");
    expect(review.scannersMissingHistory.map((a) => a.id)).toContain("scanner-1");
    expect(review.sledsMissingHistory.map((a) => a.id)).toContain("sled-1");
  });
});

describe("maintenance validation", () => {
  it("requires notes for failed or follow-up maintenance results", () => {
    const parsed = maintenanceRecordSchema.safeParse({
      assetId: "asset-1",
      maintenanceType: "TEST_PRINT",
      result: "FAIL",
      performedAt: "2026-06-16",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toContain("Notes are required");
  });

  it("accepts scale calibration fields and printer test details", () => {
    const parsed = maintenanceRecordSchema.parse({
      assetId: "scale-1",
      maintenanceType: "CALIBRATION_CHECK",
      result: "PASS",
      performedAt: "2026-06-16",
      testWeight: "20 lb",
      expectedValue: "20.00",
      measuredValue: "20.01",
      resultDetails: "Within tolerance",
    });
    expect(parsed.testWeight).toBe("20 lb");
    expect(parsed.result).toBe("PASS");
  });

  it("rejects negative page count or measured values", () => {
    const parsed = maintenanceRecordSchema.safeParse({
      assetId: "printer-1",
      maintenanceType: "TEST_PRINT",
      result: "PASS",
      performedAt: "2026-06-16",
      measuredValue: "-1",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toContain("cannot be negative");
  });
});
