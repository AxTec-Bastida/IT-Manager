import { describe, expect, it } from "vitest";
import {
  alertCanTransition,
  buildConflictAlertCandidates,
  buildMissingAssetOnlineCandidates,
  buildMovementAlertCandidates,
  buildWarrantyAlertCandidates,
  dedupeCandidates,
  shouldEvaluateMovement,
} from "@/lib/alert-workflows";

const fixedAsset = {
  id: "asset-1",
  name: "PACK-ZT411-03",
  category: "THERMAL_PRINTER" as const,
  status: "ACTIVE" as const,
  isFixedAsset: true,
  usesStaticIp: true,
  expectedLocationZoneId: "packing",
  movementAlertsEnabled: true,
  allowedZoneDistance: 0,
};

describe("smart alert workflows", () => {
  it("suppresses duplicate candidates", () => {
    const alerts = dedupeCandidates([
      { type: "LOW_STOCK", source: "STOCK", severity: "MEDIUM", title: "A", message: "A", stockItemId: "stock-1" },
      { type: "LOW_STOCK", source: "STOCK", severity: "MEDIUM", title: "A", message: "A", stockItemId: "stock-1" },
    ]);
    expect(alerts).toHaveLength(1);
  });

  it("supports alert status transitions", () => {
    expect(alertCanTransition("OPEN", "ACKNOWLEDGED")).toBe(true);
    expect(alertCanTransition("ACKNOWLEDGED", "RESOLVED")).toBe(true);
    expect(alertCanTransition("RESOLVED", "OPEN")).toBe(false);
  });

  it("creates conflict alerts", () => {
    const candidates = buildConflictAlertCandidates([
      { type: "DUPLICATE_IP", severity: "HIGH", title: "Duplicate IP", description: "Two assets", affectedDeviceIds: ["a", "b"], affectedIps: ["192.168.1.10"], suggestedFix: "Fix it" },
    ]);
    expect(candidates[0].type).toBe("CONFLICT_DUPLICATE_IP");
    expect(candidates[0].source).toBe("IPAM");
  });

  it("creates warranty alerts within threshold", () => {
    const candidates = buildWarrantyAlertCandidates(
      [{ id: "asset-1", name: "Dell Latitude", assetTag: "LAP-001", warrantyExpiresAt: new Date("2026-06-01") }],
      [{ id: "fac-1", facturaNumber: "F-1", vendorName: "Dell", warrantyEndAt: new Date("2026-06-10") }],
      60,
      new Date("2026-05-05"),
    );
    expect(candidates.map((candidate) => candidate.type)).toEqual(["WARRANTY_EXPIRING", "FACTURA_WARRANTY_EXPIRING"]);
  });

  it("does not create same-zone movement alerts", () => {
    const candidates = buildMovementAlertCandidates([fixedAsset], [{ assetId: "asset-1", apName: "AP-PACK", apMac: "aa", locationLabel: "Packing", seenAt: new Date(), apMapLocation: { locationZoneId: "packing", locationZone: { id: "packing", name: "Packing" } } }]);
    expect(candidates).toHaveLength(0);
  });

  it("creates different-zone movement alert only for fixed/static assets", () => {
    const moved = buildMovementAlertCandidates([fixedAsset], [{ assetId: "asset-1", apName: "AP-SHIP", apMac: "bb", locationLabel: "Shipping", seenAt: new Date(), apMapLocation: { locationZoneId: "shipping", locationZone: { id: "shipping", name: "Shipping" } } }]);
    const mobile = buildMovementAlertCandidates([{ ...fixedAsset, id: "asset-2", category: "SCANNER", isFixedAsset: false, usesStaticIp: false }], [{ assetId: "asset-2", apName: "AP-SHIP", apMac: "bb", locationLabel: "Shipping", seenAt: new Date(), apMapLocation: { locationZoneId: "shipping", locationZone: { id: "shipping", name: "Shipping" } } }]);
    expect(shouldEvaluateMovement(fixedAsset)).toBe(true);
    expect(moved[0].type).toBe("FIXED_ASSET_MOVED");
    expect(mobile).toHaveLength(0);
  });

  it("creates missing asset seen online alert", () => {
    const candidates = buildMissingAssetOnlineCandidates(
      [{ id: "asset-1", name: "SCAN-CART-01", status: "MISSING" }],
      [{ assetId: "asset-1", online: true, apName: "AP-SHIP", apMac: "bb", lastSeenAt: new Date(), syncedAt: new Date() }],
    );
    expect(candidates[0].type).toBe("MISSING_ASSET_SEEN_ONLINE");
  });
});
