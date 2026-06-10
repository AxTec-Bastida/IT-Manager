import { describe, expect, it } from "vitest";
import {
  classifySearchTerm,
  isExactSerializedAssetMatch,
  isGenericPeripheralLikeDevice,
  isGenericStockSearchTerm,
  preferredWorkflowForLookup,
  serializedAssetSearchScore,
  sortSerializedAssetMatches,
  sortStockWorkflowMatches,
  stockRecordLooksSerialized,
} from "@/lib/item-workflow-classification";

describe("stock vs serialized workflow classification", () => {
  it("classifies generic stock and peripheral terms", () => {
    expect(classifySearchTerm("Mouse")).toBe("STOCK_ITEM");
    expect(classifySearchTerm("Keyboard")).toBe("STOCK_ITEM");
    expect(classifySearchTerm("Cable")).toBe("STOCK_ITEM");
    expect(isGenericStockSearchTerm("teclado")).toBe(true);
  });

  it("keeps exact asset tag, serial, and physical label matches serialized", () => {
    const asset = {
      id: "asset-1",
      name: "Dell Laptop",
      assetTag: "GHT-LP-63",
      serialNumber: "SER-63",
      category: "LAPTOP",
      aliases: [{ aliasType: "PHYSICAL_LABEL", value: "J063" }],
    };

    expect(isExactSerializedAssetMatch(asset, "GHT-LP-63")).toBe(true);
    expect(isExactSerializedAssetMatch(asset, "SER-63")).toBe(true);
    expect(isExactSerializedAssetMatch(asset, "J063")).toBe(true);
    expect(preferredWorkflowForLookup({ query: "J063", devices: [asset], stockItems: [{ name: "J063 Cable" }] }).preferred).toBe("SERIALIZED_ASSET");
  });

  it("prefers stock suggestions for generic terms over loose OTHER device matches", () => {
    const weirdOther = { id: "other", name: "OTHER GHT-T-8", assetTag: "GHT-T-8", serialNumber: null, category: "OTHER", notes: "Mouse" };
    const mouse = { id: "stock", name: "Mouse", sku: "MOUSE", barcodeValue: "STOCK:MOUSE", category: "MOUSE", itemType: "PERIPHERAL" };

    expect(preferredWorkflowForLookup({ query: "Mouse", devices: [weirdOther], stockItems: [mouse] }).preferred).toBe("STOCK_ITEM");
    expect(serializedAssetSearchScore(weirdOther, "Mouse")).toBe(0);
    expect(sortStockWorkflowMatches([mouse], "Mouse")[0].id).toBe("stock");
  });

  it("ranks exact serialized matches before loose text matches", () => {
    const loose = { id: "loose", name: "GHT-LP-63 note", assetTag: "OTHER-1", serialNumber: null, category: "OTHER" };
    const exactTag = { id: "exact", name: "Latitude", assetTag: "GHT-LP-63", serialNumber: "SER", category: "LAPTOP" };
    const exactAlias = { id: "alias", name: "Latitude", assetTag: "GHT-LP-64", serialNumber: "SER2", category: "LAPTOP", aliases: [{ aliasType: "SCAN_CODE", value: "J063" }] };

    expect(sortSerializedAssetMatches([loose, exactTag], "GHT-LP-63").map((asset) => asset.id)).toEqual(["exact", "loose"]);
    expect(sortSerializedAssetMatches([loose, exactAlias], "J063").map((asset) => asset.id)).toEqual(["alias", "loose"]);
  });

  it("flags generic peripheral-like devices and serialized-looking stock", () => {
    expect(isGenericPeripheralLikeDevice({ name: "Mouse", category: "OTHER" })).toBe(true);
    expect(isGenericPeripheralLikeDevice({ name: "OTHER GHT-T-8", assetTag: "GHT-T-8", category: "OTHER" })).toBe(true);
    expect(stockRecordLooksSerialized({ name: "Laptop Dell Latitude", category: "OTHER", itemType: "SUPPLY" })).toBe(true);
    expect(stockRecordLooksSerialized({ name: "Mouse", category: "MOUSE", itemType: "PERIPHERAL" })).toBe(false);
  });
});
