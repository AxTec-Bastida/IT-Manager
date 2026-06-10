import { describe, expect, it } from "vitest";
import {
  buildInventoryOverview,
  buildInventorySignals,
  filterInventoryAssets,
  getInventoryReviewReasons,
  inventorySearchScore,
  matchesInventoryView,
  normalizeInventoryView,
  paginateInventory,
  shouldShowInventoryListFromParams,
  sortInventorySearchResults,
  type InventoryAsset,
} from "@/lib/inventory-views";

const baseAsset: InventoryAsset = {
  id: "asset-1",
  name: "Asset",
  assetTag: "TAG-1",
  serialNumber: "SER-1",
  category: "LAPTOP",
  status: "ACTIVE",
  condition: "GOOD",
  brand: "DELL",
  model: "Latitude 5520",
  location: "Packing",
  areaDepartment: "Packing",
  ipAddress: null,
  macAddress: null,
  usesStaticIp: false,
  isFixedAsset: false,
  movementAlertsEnabled: false,
  photos: [{ photoType: "OVERVIEW" }, { photoType: "ASSET_TAG" }, { photoType: "SERIAL_LABEL" }, { photoType: "CONDITION" }],
};

describe("inventory view helpers", () => {
  it("normalizes unknown views to all", () => {
    expect(normalizeInventoryView("mobile")).toBe("mobile");
    expect(normalizeInventoryView("networked")).toBe("network");
    expect(normalizeInventoryView("banana")).toBe("all");
  });

  it("filters category and workflow views", () => {
    const assets = [
      baseAsset,
      { ...baseAsset, id: "phone", category: "PHONE", name: "iPhone 12", model: "iPhone 12" },
      { ...baseAsset, id: "printer", category: "THERMAL_PRINTER", name: "Packing Printer", model: "ZT411" },
      { ...baseAsset, id: "scale", category: "SCALE", name: "Mettler Scale", model: "BC60" },
      { ...baseAsset, id: "scanner", category: "SCANNER", name: "Zebra Scanner", model: "TC52" },
      { ...baseAsset, id: "monitor", category: "MONITOR", name: "Dell Monitor", model: "E2425HSM" },
      { ...baseAsset, id: "available", status: "AVAILABLE" },
      { ...baseAsset, id: "missing", status: "MISSING" },
      { ...baseAsset, id: "retired", status: "RETIRED" },
      { ...baseAsset, id: "loan", status: "LOANED_OUT", assetLoanItems: [{ returnStatus: "PENDING", loan: { status: "ACTIVE" } }] },
      { ...baseAsset, id: "rma", status: "IN_REPAIR_RMA", rmaItems: [{ result: "PENDING", rmaCase: { status: "ACTIVE" } }] },
    ];
    const signals = buildInventorySignals(assets);

    expect(filterInventoryAssets(assets, { view: "laptops" }, signals).map((asset) => asset.id)).toContain("asset-1");
    expect(filterInventoryAssets(assets, { view: "mobile" }, signals).map((asset) => asset.id)).toEqual(["phone"]);
    expect(filterInventoryAssets(assets, { view: "printers" }, signals).map((asset) => asset.id)).toEqual(["printer"]);
    expect(filterInventoryAssets(assets, { view: "scales" }, signals).map((asset) => asset.id)).toEqual(["scale"]);
    expect(filterInventoryAssets(assets, { view: "scanners" }, signals).map((asset) => asset.id)).toEqual(["scanner"]);
    expect(filterInventoryAssets(assets, { view: "monitors" }, signals).map((asset) => asset.id)).toEqual(["monitor"]);
    expect(filterInventoryAssets(assets, { view: "available" }, signals).map((asset) => asset.id)).toContain("available");
    expect(filterInventoryAssets(assets, { view: "loaned" }, signals).map((asset) => asset.id)).toContain("loan");
    expect(filterInventoryAssets(assets, { view: "rma" }, signals).map((asset) => asset.id)).toContain("rma");
    expect(filterInventoryAssets(assets, { view: "missing" }, signals).map((asset) => asset.id)).toEqual(["missing"]);
    expect(filterInventoryAssets(assets, { view: "retired" }, signals).map((asset) => asset.id)).toEqual(["retired"]);
  });

  it("includes networked assets with IP, MAC, or static candidate category", () => {
    const assets = [
      baseAsset,
      { ...baseAsset, id: "ip", ipAddress: "192.168.1.10" },
      { ...baseAsset, id: "mac", macAddress: "AA:BB" },
      { ...baseAsset, id: "switch", category: "SWITCH", name: "Switch", model: "USW" },
    ];
    const signals = buildInventorySignals(assets);

    expect(filterInventoryAssets(assets, { view: "network" }, signals).map((asset) => asset.id)).toEqual(["ip", "mac", "switch"]);
    expect(filterInventoryAssets(assets, { view: "networked" }, signals).map((asset) => asset.id)).toEqual(["ip", "mac", "switch"]);
  });

  it("finds needs-review and missing-photo assets", () => {
    const missingPhotos = { ...baseAsset, id: "photo-gap", photos: [] };
    const suspicious = { ...baseAsset, id: "bad-name", name: "ACCESS POINT GHT-LP-1", category: "LAPTOP", assetTag: "GHT-LP-1", model: "Latitude 3520" };
    const duplicateA = { ...baseAsset, id: "dup-a", ipAddress: "192.168.163.21" };
    const duplicateB = { ...baseAsset, id: "dup-b", assetTag: "TAG-2", serialNumber: "SER-2", ipAddress: "192.168.163.21" };
    const assets = [baseAsset, missingPhotos, suspicious, duplicateA, duplicateB];
    const signals = buildInventorySignals(assets);

    expect(matchesInventoryView(missingPhotos, "missing-photos", signals)).toBe(true);
    expect(getInventoryReviewReasons(suspicious, signals)).toContain("Laptop/Latitude record is named Access Point.");
    expect(filterInventoryAssets(assets, { view: "needs-review" }, signals).map((asset) => asset.id)).toEqual(["photo-gap", "bad-name", "dup-a", "dup-b"]);
  });

  it("marks LOANED_OUT assets without active loans for review", () => {
    const orphan = { ...baseAsset, id: "orphan", status: "LOANED_OUT", assetLoanItems: [] };
    const signals = buildInventorySignals([orphan]);
    expect(getInventoryReviewReasons(orphan, signals)).toContain("Loaned out status without an active loan.");
  });

  it("builds overview counts and paginates bounded results", () => {
    const assets = Array.from({ length: 121 }, (_, index) => ({ ...baseAsset, id: `asset-${index}`, assetTag: `TAG-${index}`, serialNumber: `SER-${index}` }));
    const overview = buildInventoryOverview(assets);
    const page = paginateInventory(assets, 1, 50);

    expect(overview.total).toBe(121);
    expect(page.items).toHaveLength(50);
    expect(page.totalPages).toBe(3);
    expect(page.startNumber).toBe(1);
    expect(page.endNumber).toBe(50);
  });

  it("keeps the inventory hub from rendering the list until a user chooses a list/search/filter", () => {
    expect(shouldShowInventoryListFromParams({})).toBe(false);
    expect(shouldShowInventoryListFromParams({ q: "GHT-LP" })).toBe(true);
    expect(shouldShowInventoryListFromParams({ view: "mobile" })).toBe(true);
    expect(shouldShowInventoryListFromParams({ list: "true" })).toBe(true);
  });

  it("searches physical labels, scan aliases, and serials", () => {
    const assets = [
      { ...baseAsset, id: "loose", assetTag: "TAG-LOOSE", name: "Cart with J01 label note", serialNumber: "SER-LOOSE" },
      { ...baseAsset, id: "alias", assetTag: "GHT-LP-10", serialNumber: "SER-10", aliases: [{ aliasType: "PHYSICAL_LABEL", value: "J01" }] },
      { ...baseAsset, id: "scan", assetTag: "GHT-LP-11", serialNumber: "SER-11", aliases: [{ aliasType: "SCAN_CODE", value: "K01" }] },
      { ...baseAsset, id: "serial", assetTag: "GHT-LP-12", serialNumber: "SN-J99" },
    ];
    const signals = buildInventorySignals(assets);

    expect(filterInventoryAssets(assets, { q: "J01" }, signals).map((asset) => asset.id)).toContain("alias");
    expect(filterInventoryAssets(assets, { q: "K01" }, signals).map((asset) => asset.id)).toEqual(["scan"]);
    expect(filterInventoryAssets(assets, { q: "SN-J99" }, signals).map((asset) => asset.id)).toEqual(["serial"]);
  });

  it("ranks exact asset tags, labels, and serials ahead of loose text matches", () => {
    const assets = [
      { ...baseAsset, id: "loose", assetTag: "OTHER-1", name: "GHT-LP-63 shipping note", serialNumber: "SER-LOOSE" },
      { ...baseAsset, id: "serial", assetTag: "OTHER-2", name: "Laptop", serialNumber: "GHT-LP-63" },
      { ...baseAsset, id: "alias", assetTag: "OTHER-3", name: "Laptop", serialNumber: "SER-ALIAS", aliases: [{ aliasType: "PHYSICAL_LABEL", value: "GHT-LP-63" }] },
      { ...baseAsset, id: "tag", assetTag: "GHT-LP-63", name: "Latitude", serialNumber: "SER-TAG" },
    ];

    expect(sortInventorySearchResults(assets, "GHT-LP-63").map((asset) => asset.id)).toEqual(["tag", "alias", "serial", "loose"]);
    expect(inventorySearchScore(assets[3], "GHT-LP-63")).toBeGreaterThan(inventorySearchScore(assets[0], "GHT-LP-63"));
  });
});
