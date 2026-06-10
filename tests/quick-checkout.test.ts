import { describe, expect, it } from "vitest";
import {
  canAddQuickCheckoutAsset,
  expectedReturnDate,
  hasAssignedAssetWarning,
  quickCheckoutAssetWarning,
  quickCheckoutHrefForAsset,
  quickCheckoutHrefForEmployee,
  quickCheckoutHrefForTemporaryBorrower,
} from "@/lib/quick-checkout";

describe("quick asset checkout helpers", () => {
  it("builds preload links for assets and borrowers", () => {
    expect(quickCheckoutHrefForAsset("asset-1")).toBe("/loans/quick-checkout?assetId=asset-1");
    expect(quickCheckoutHrefForEmployee("emp-1")).toBe("/loans/quick-checkout?borrowerType=employee&borrowerId=emp-1");
    expect(quickCheckoutHrefForTemporaryBorrower("tmp-1")).toBe("/loans/quick-checkout?borrowerType=temporary&borrowerId=tmp-1");
  });

  it("defaults expected return to three days", () => {
    expect(expectedReturnDate(3, new Date("2026-06-01T12:00:00Z"))).toBe("2026-06-04");
    expect(expectedReturnDate(1, new Date("2026-06-01T12:00:00Z"))).toBe("2026-06-02");
  });

  it("blocks duplicate and ineligible assets", () => {
    expect(canAddQuickCheckoutAsset(asset({ id: "a1" }), [])).toEqual({ ok: true });
    expect(canAddQuickCheckoutAsset(asset({ id: "a1" }), ["a1"]).ok).toBe(false);
    expect(quickCheckoutAssetWarning(asset({ status: "LOANED_OUT" }))).toContain("LOANED OUT");
    expect(quickCheckoutAssetWarning(asset({ assetLoanItems: [{}] }))).toContain("already loaned out");
    expect(quickCheckoutAssetWarning(asset({ rmaItems: [{}] }))).toContain("currently in RMA");
  });

  it("requires assigned asset warning when a selected asset has an assignment", () => {
    expect(hasAssignedAssetWarning([asset({ employee: { fullName: "Ana" } })])).toBe(true);
    expect(hasAssignedAssetWarning([asset({ assignedTo: "IT" })])).toBe(true);
    expect(hasAssignedAssetWarning([asset()])).toBe(false);
  });
});

function asset(overrides = {}) {
  return {
    id: "asset",
    name: "Scanner",
    assetTag: "A-1",
    status: "AVAILABLE",
    assignedTo: null,
    employeeId: null,
    employee: null,
    rmaItems: [],
    assetLoanItems: [],
    ...overrides,
  };
}
