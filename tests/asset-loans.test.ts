import { describe, expect, it } from "vitest";
import {
  assetLoanItemStatusForCondition,
  assetLoanStatusForItems,
  canLoanAsset,
  deviceConditionForLoanReturn,
  deviceStatusForLoanReturn,
  isAssetLoanOverdue,
} from "@/lib/asset-loans";

describe("asset loan workflow rules", () => {
  it("blocks assets that should not be checked out", () => {
    expect(canLoanAsset({ name: "iPod", assetTag: "A1", status: "AVAILABLE" }).ok).toBe(true);
    expect(canLoanAsset({ name: "Old laptop", assetTag: "A2", status: "RETIRED" }).ok).toBe(false);
    expect(canLoanAsset({ name: "Scale", assetTag: "A3", status: "IN_REPAIR_RMA" }).ok).toBe(false);
    expect(canLoanAsset({ name: "Scanner", assetTag: "A4", status: "LOANED_OUT" }).ok).toBe(false);
  });

  it("maps good and fair returns to available", () => {
    expect(deviceStatusForLoanReturn("GOOD")).toBe("AVAILABLE");
    expect(deviceStatusForLoanReturn("FAIR")).toBe("AVAILABLE");
    expect(deviceConditionForLoanReturn("FAIR")).toBe("FAIR");
  });

  it("maps damaged, missing accessory, and lost returns out of daily use", () => {
    expect(deviceStatusForLoanReturn("DAMAGED")).toBe("IN_REPAIR_RMA");
    expect(deviceStatusForLoanReturn("NOT_WORKING")).toBe("IN_REPAIR_RMA");
    expect(deviceStatusForLoanReturn("MISSING_ACCESSORIES")).toBe("IN_REPAIR_RMA");
    expect(deviceStatusForLoanReturn("LOST")).toBe("LOST");
    expect(deviceConditionForLoanReturn("LOST")).toBe("NEEDS_REVIEW");
  });

  it("maps item return conditions to item statuses", () => {
    expect(assetLoanItemStatusForCondition("GOOD")).toBe("RETURNED");
    expect(assetLoanItemStatusForCondition("DAMAGED")).toBe("RETURNED_DAMAGED");
    expect(assetLoanItemStatusForCondition("MISSING_ACCESSORIES")).toBe("MISSING_ACCESSORIES");
    expect(assetLoanItemStatusForCondition("LOST")).toBe("LOST");
  });

  it("calculates full, partial, damaged, and lost loan status", () => {
    expect(assetLoanStatusForItems([{ returnStatus: "PENDING", returnedAt: null } as never])).toBe("ACTIVE");
    expect(assetLoanStatusForItems([{ returnStatus: "RETURNED", returnedAt: new Date() } as never, { returnStatus: "PENDING", returnedAt: null } as never])).toBe("PARTIALLY_RETURNED");
    expect(assetLoanStatusForItems([{ returnStatus: "RETURNED", returnedAt: new Date() } as never])).toBe("RETURNED");
    expect(assetLoanStatusForItems([{ returnStatus: "RETURNED_DAMAGED", returnedAt: new Date() } as never])).toBe("RETURNED_DAMAGED");
    expect(assetLoanStatusForItems([{ returnStatus: "LOST", returnedAt: new Date() } as never])).toBe("LOST");
  });

  it("detects overdue active loans", () => {
    expect(isAssetLoanOverdue({ status: "ACTIVE", expectedReturnAt: new Date("2026-05-01T12:00:00Z") } as never, new Date("2026-05-03T12:00:00Z"))).toBe(true);
    expect(isAssetLoanOverdue({ status: "RETURNED", expectedReturnAt: new Date("2026-05-01T12:00:00Z") } as never, new Date("2026-05-03T12:00:00Z"))).toBe(false);
  });
});
