import { describe, expect, it } from "vitest";
import { maintenanceRecordSchema } from "@/lib/validation";
import {
  buildMaintenanceSummary,
  defaultMaintenanceTypeForAsset,
  defaultNextDueAt,
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
});
