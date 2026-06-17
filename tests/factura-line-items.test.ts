import { describe, expect, it } from "vitest";
import { ClientInputError } from "@/lib/api";
import { applyLineItemValues, assertCanLinkAssets, calculateLineItemTotal, lineItemValueSourceLabel, unlinkedQuantity } from "@/lib/factura-line-items";
import { facturaLineItemApplyValuesSchema, facturaLineItemLinkAssetsSchema, facturaLineItemSchema } from "@/lib/validation";

describe("factura line item helpers", () => {
  it("calculates totals and validates line item input", () => {
    expect(calculateLineItemTotal(3, 19.995)).toBe(59.99);

    const parsed = facturaLineItemSchema.parse({
      description: "Dell Latitude 5520",
      sku: "LAT-5520",
      category: "LAPTOP",
      quantity: "2",
      unitCost: "1200.50",
      currency: "MXN",
    });

    expect(parsed.quantity).toBe(2);
    expect(parsed.unitCost).toBe(1200.5);
    expect(facturaLineItemSchema.safeParse({ description: "", quantity: 0, unitCost: -1 }).success).toBe(false);
  });

  it("guards line item asset linking by quantity and duplicates", () => {
    const lineItem = { quantity: 2, assetLinks: [{ deviceId: "asset-1" }] };

    expect(unlinkedQuantity(lineItem)).toBe(1);
    expect(assertCanLinkAssets(lineItem, [" asset-2 ", "asset-2", ""])).toEqual(["asset-2"]);
    expect(() => assertCanLinkAssets(lineItem, ["asset-1"])).toThrow(ClientInputError);
    expect(() => assertCanLinkAssets(lineItem, ["asset-2", "asset-3"])).toThrow(/unlinked quantity remaining/);
    expect(() => assertCanLinkAssets(lineItem, [])).toThrow(/Select at least one/);
  });

  it("validates link/apply payloads", () => {
    expect(facturaLineItemLinkAssetsSchema.parse({ assetIds: ["asset-1", "asset-2"] }).assetIds).toEqual(["asset-1", "asset-2"]);
    expect(facturaLineItemLinkAssetsSchema.safeParse({ assetIds: [""] }).success).toBe(false);
    expect(facturaLineItemApplyValuesSchema.parse({ overwriteExisting: "on" }).overwriteExisting).toBe(true);
  });

  it("labels factura line item value sources", () => {
    const source = lineItemValueSourceLabel({
      sourceType: "FACTURA_LINE_ITEM",
      sourceFacturaLineItemAsset: {
        lineItem: {
          description: "Dell Latitude",
          unitCost: 1000,
          currency: "MXN",
          factura: { id: "factura-1", facturaNumber: "F-1", vendorName: "Dell", purchaseDate: new Date("2026-06-01") },
        },
      },
    });

    expect(source).toMatchObject({ label: "Factura line item", facturaNumber: "F-1", lineItemDescription: "Dell Latitude", unitCost: 1000 });
    expect(lineItemValueSourceLabel({ sourceType: "MANUAL" })).toBeNull();
  });

  it("applies values from linked assets without overwriting existing profiles by default", async () => {
    const prisma = fakePrisma();
    const lineItem = {
      id: "line-1",
      description: "Dell Latitude",
      unitCost: 1500,
      currency: "MXN",
      factura: { id: "factura-1", facturaNumber: "F-1", vendorName: "Dell", purchaseDate: new Date("2026-01-01") },
      assetLinks: [
        {
          id: "link-new",
          allocatedUnitCost: null,
          currency: "MXN",
          device: { id: "asset-new", assetTag: "GHT-LP-1", name: "Laptop", category: "LAPTOP" as const, purchaseDate: null, valueProfile: null },
        },
        {
          id: "link-existing",
          allocatedUnitCost: 900,
          currency: "USD",
          device: { id: "asset-existing", assetTag: "GHT-LP-2", name: "Laptop 2", category: "LAPTOP" as const, purchaseDate: null, valueProfile: { id: "value-1", purchaseValue: 800 } },
        },
      ],
    };

    const result = await applyLineItemValues(prisma as never, lineItem);

    expect(result).toEqual({ created: 1, updated: 0, skippedExisting: 1 });
    expect(prisma.createdProfiles).toHaveLength(1);
    expect(prisma.updatedProfiles).toHaveLength(0);
    expect(prisma.activityLogs).toHaveLength(1);
    expect(prisma.createdProfiles[0].data).toMatchObject({ deviceId: "asset-new", purchaseValue: 1500, sourceType: "FACTURA_LINE_ITEM", sourceFacturaLineItemAssetId: "link-new" });
  });

  it("overwrites existing asset values only when explicitly requested", async () => {
    const prisma = fakePrisma();
    const result = await applyLineItemValues(
      prisma as never,
      {
        id: "line-1",
        description: "Dell Latitude",
        unitCost: 1500,
        currency: "MXN",
        factura: { id: "factura-1", facturaNumber: "F-1", vendorName: "Dell", purchaseDate: null },
        assetLinks: [
          {
            id: "link-existing",
            allocatedUnitCost: 900,
            currency: "USD",
            device: { id: "asset-existing", assetTag: "GHT-LP-2", name: "Laptop 2", category: "LAPTOP" as const, purchaseDate: new Date("2026-02-01"), valueProfile: { id: "value-1", purchaseValue: 800 } },
          },
        ],
      },
      { overwriteExisting: true },
    );

    expect(result).toEqual({ created: 0, updated: 1, skippedExisting: 0 });
    expect(prisma.updatedProfiles[0]).toMatchObject({ where: { deviceId: "asset-existing" }, data: { purchaseValue: 900, currency: "USD", sourceFacturaLineItemAssetId: "link-existing" } });
    expect(prisma.activityLogs).toHaveLength(1);
  });
});

function fakePrisma() {
  const state = {
    createdProfiles: [] as unknown[],
    updatedProfiles: [] as unknown[],
    activityLogs: [] as unknown[],
  };
  return {
    get createdProfiles() {
      return state.createdProfiles;
    },
    get updatedProfiles() {
      return state.updatedProfiles;
    },
    get activityLogs() {
      return state.activityLogs;
    },
    assetValueProfile: {
      create: async (input: unknown) => {
        state.createdProfiles.push(input);
        return input;
      },
      update: async (input: unknown) => {
        state.updatedProfiles.push(input);
        return input;
      },
    },
    activityLog: {
      create: async (input: unknown) => {
        state.activityLogs.push(input);
        return input;
      },
    },
  };
}
