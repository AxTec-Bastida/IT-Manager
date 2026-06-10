import { describe, expect, it } from "vitest";
import { detectDuplicateExactValues, detectInvalidIps, detectMobileTrackingViolations, detectNegativeStock } from "@/lib/data-integrity";

describe("data integrity sanity checks", () => {
  it("detects duplicate exact asset tags and serial numbers", () => {
    const result = detectDuplicateExactValues([
      { id: "1", assetTag: "A-1", serialNumber: "S-1" },
      { id: "2", assetTag: "A-1", serialNumber: "S-2" },
      { id: "3", assetTag: "A-3", serialNumber: "S-2" },
    ]);
    expect(result.assetTagDuplicates).toEqual([{ value: "A-1", ids: ["1", "2"] }]);
    expect(result.serialDuplicates).toEqual([{ value: "S-2", ids: ["2", "3"] }]);
  });

  it("detects invalid IPs and negative stock", () => {
    expect(detectInvalidIps([{ id: "1", ipAddress: "192.168.1.10" }, { id: "2", ipAddress: "192.168.1.280" }])).toEqual([{ id: "2", ipAddress: "192.168.1.280" }]);
    expect(detectNegativeStock([{ id: "stock-1", quantityOnHand: -1 }, { id: "stock-2", quantityOnHand: 0 }])).toEqual([{ id: "stock-1", quantityOnHand: -1 }]);
  });

  it("detects mobile inventory records with network tracking enabled", () => {
    const violations = detectMobileTrackingViolations([
      { id: "1", category: "PHONE", ipAddress: null, macAddress: null, usesStaticIp: false, movementAlertsEnabled: false },
      { id: "2", category: "TABLET", ipAddress: "10.0.0.5", macAddress: null, usesStaticIp: false, movementAlertsEnabled: false },
      { id: "3", category: "DESKTOP", ipAddress: "10.0.0.6", macAddress: null, usesStaticIp: true, movementAlertsEnabled: true },
    ]);
    expect(violations).toEqual([{ id: "2", reason: "IP/MAC present" }]);
  });
});
