import { describe, expect, it } from "vitest";
import { getAssetCategoryLabel, getAssetDisplayName, getAssetIdentityLine, isSledAsset, isSuspiciousImportedName, shouldShowNetworkSummary } from "@/lib/asset-display";

describe("asset display helpers", () => {
  it("uses brand and model when an imported name is suspicious", () => {
    expect(getAssetDisplayName({ name: "ACCESS POINT GHT-LP-11", category: "LAPTOP", brand: "DELL", model: "Latitude 5520", assetTag: "GHT-LP-11" })).toBe("DELL Latitude 5520");
    expect(isSuspiciousImportedName({ name: "ACCESS POINT GHT-LP-11", category: "LAPTOP", model: "Latitude 5520" })).toBe(true);
  });

  it("keeps useful non-suspicious names when category identity does not need brand/model first", () => {
    expect(getAssetDisplayName({ name: "Packing Printer 03", category: "THERMAL_PRINTER", brand: "Zebra", model: "ZT411" })).toBe("Packing Printer 03");
  });

  it("builds a fallback name and identity line", () => {
    expect(getAssetDisplayName({ category: "SCALE", assetTag: "SCALE-01" })).toBe("Scales SCALE-01");
    expect(getAssetIdentityLine({ assetTag: "GHT-LP-11", serialNumber: "ABC123" })).toBe("Tag: GHT-LP-11 · Serial: ABC123");
  });

  it("hides IP/MAC noise for mobile assets unless tracking is enabled or networked view is selected", () => {
    const mobile = { category: "PHONE", ipAddress: "192.168.1.10", macAddress: "AA:BB" };
    expect(shouldShowNetworkSummary(mobile)).toBe(false);
    expect(shouldShowNetworkSummary({ ...mobile, usesStaticIp: true })).toBe(true);
    expect(shouldShowNetworkSummary(mobile, "networked")).toBe(true);
  });

  it("displays imported GHT-SLD sleds as sled assets instead of generic Other records", () => {
    const sled = { name: "OTHER GHT-SLD-190", category: "OTHER", brand: "Infinite Peripherals", model: "Infinea X", assetTag: "GHT-SLD-190" };
    expect(isSledAsset(sled)).toBe(true);
    expect(getAssetDisplayName(sled)).toBe("Infinite Peripherals Infinea X");
    expect(getAssetCategoryLabel(sled)).toBe("Sled");
  });
});
