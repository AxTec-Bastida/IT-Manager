import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ClientInputError } from "@/lib/api";
import { parseFacturaLineItemCandidates, parseMoneyValue } from "@/lib/factura-extraction";
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

  it("parses simple factura text candidates and ignores totals", () => {
    const candidates = parseFacturaLineItemCandidates(`
      Dell Latitude 5520 SKU LAT-5520 2 12,000.00 24,000.00 MXN
      Zebra cs6080 Cable 5 100,50 502,50 MXN
      Subtotal 24,502.50
      IVA 3,920.40
      Total 28,422.90
    `);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ description: "Dell Latitude 5520 SKU LAT-5520", quantity: 2, unitCost: 12000, totalCost: 24000, currency: "MXN" });
    expect(candidates[0].confidence).toBeGreaterThan(0.7);
    expect(candidates[1]).toMatchObject({ description: "Zebra cs6080 Cable", quantity: 5, unitCost: 100.5, totalCost: 502.5 });
    expect(candidates.some((candidate) => candidate.description.toLowerCase().includes("subtotal"))).toBe(false);
  });

  it("handles currency parsing and low confidence warnings", () => {
    expect(parseMoneyValue("$1,234.56")).toBe(1234.56);
    expect(parseMoneyValue("1.234,56")).toBe(1234.56);

    const [candidate] = parseFacturaLineItemCandidates("Generic adapter 999.99 999.99 MXN");
    expect(candidate.confidence).toBeLessThan(0.7);
    expect(candidate.warnings.join(" ")).toContain("Quantity or unit cost is missing");
  });

  it("keeps extraction routes permissioned and non-mutating until reviewed", async () => {
    const extractRoute = await fs.readFile(path.join(process.cwd(), "app", "api", "facturas", "[id]", "extract-line-items", "route.ts"), "utf8");
    const createRoute = await fs.readFile(path.join(process.cwd(), "app", "api", "facturas", "[id]", "line-items", "from-candidates", "route.ts"), "utf8");

    expect(extractRoute).toContain('requirePermission("inventory.write")');
    expect(extractRoute).toContain("extractFacturaCandidates");
    expect(extractRoute).not.toContain("facturaLineItem.create");
    expect(createRoute).toContain('requirePermission("inventory.write")');
    expect(createRoute).toContain("facturaLineItemSchema");
    expect(createRoute).toContain("Possible duplicate line item");
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
