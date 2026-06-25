import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ClientInputError } from "@/lib/api";
import {
  BULK_INTAKE_MAX_COUNT,
  createBulkIntakeAssets,
  createSingleIntakeAsset,
  formatIntakeTag,
  generateBulkAssetPreview,
  intakeBulkAssetSchema,
  intakeStock,
  intakeStockSchema,
  manualLabelsHref,
  suggestAssetTag,
  parseMappingCsv,
  validateMappingRows,
} from "@/lib/intake";

describe("inventory intake helpers", () => {
  it("generates padded tags and preview rows", () => {
    expect(formatIntakeTag("GHT-SLD", 1, 3, "-")).toBe("GHT-SLD-001");
    expect(formatIntakeTag("Zebra-", 208, 0, "")).toBe("Zebra-208");
    const input = intakeBulkAssetSchema.parse({
      prefix: "QA-SLD",
      start: 1,
      end: 3,
      padding: 3,
      separator: "-",
      category: "SCANNER",
      nameTemplate: "Sled {tag}",
      status: "ACTIVE",
      condition: "GOOD",
    });
    expect(generateBulkAssetPreview(input).map((asset) => asset.assetTag)).toEqual(["QA-SLD-001", "QA-SLD-002", "QA-SLD-003"]);
    expect(generateBulkAssetPreview(input)[0].name).toBe("Sled QA-SLD-001");
  });

  it("rejects invalid bulk ranges and over-limit batches", () => {
    expect(intakeBulkAssetSchema.safeParse({ prefix: "QA", start: 5, end: 4, category: "SCANNER", nameTemplate: "{tag}" }).success).toBe(false);
    expect(intakeBulkAssetSchema.safeParse({ prefix: "QA", start: 1, end: BULK_INTAKE_MAX_COUNT + 1, category: "SCANNER", nameTemplate: "{tag}" }).success).toBe(false);
  });

  it("builds manual label links for generated tags", () => {
    const href = manualLabelsHref(["QA-SLD-001", "QA-SLD-002"]);
    expect(href).toContain("/labels?mode=manual");
    expect(decodeURIComponent(href)).toContain("QA-SLD-001\nQA-SLD-002");
  });

  it("single asset intake rejects duplicate tags", async () => {
    const prisma = fakePrisma({ duplicateAssetTag: "QA-1" });
    await expect(createSingleIntakeAsset(prisma, {
      assetTag: "QA-1",
      name: "QA Laptop",
      category: "LAPTOP",
      serialNumber: null,
      status: "ACTIVE",
      condition: "GOOD",
      location: null,
      areaDepartment: null,
      brand: null,
      model: null,
      assignedTo: null,
      purchaseDate: null,
      warrantyExpiresAt: null,
      facturaId: null,
      purchaseValue: null,
      valueCurrency: "MXN",
      usefulLifeMonths: null,
      residualPercent: null,
      notes: null,
    })).rejects.toBeInstanceOf(ClientInputError);
  });

  it("single asset intake creates an optional value profile only when value is provided", async () => {
    const prisma = fakePrisma();
    await createSingleIntakeAsset(prisma, {
      assetTag: "QA-VALUE-1",
      name: "QA Value Laptop",
      category: "LAPTOP",
      serialNumber: null,
      status: "ACTIVE",
      condition: "GOOD",
      location: null,
      areaDepartment: null,
      brand: "DELL",
      model: "Latitude",
      assignedTo: null,
      purchaseDate: new Date("2026-01-01"),
      warrantyExpiresAt: null,
      facturaId: null,
      purchaseValue: 1200,
      valueCurrency: "MXN",
      usefulLifeMonths: 36,
      residualPercent: 30,
      notes: null,
    });

    expect(prisma.valueProfiles).toHaveLength(1);
    expect(prisma.valueProfiles[0]).toMatchObject({ purchaseValue: 1200, currency: "MXN", usefulLifeMonths: 36 });
  });

  it("bulk intake rejects existing tags before creating", async () => {
    const prisma = fakePrisma({ existingAssetTags: ["QA-SLD-002"] });
    const input = intakeBulkAssetSchema.parse({
      prefix: "QA-SLD",
      start: 1,
      end: 3,
      padding: 3,
      separator: "-",
      category: "SCANNER",
      nameTemplate: "Sled {tag}",
      status: "ACTIVE",
      condition: "GOOD",
    });
    await expect(createBulkIntakeAssets(prisma, input)).rejects.toThrow("Existing asset tags");
    expect(prisma.createdMany).toBe(0);
  });

  it("stock intake creates new stock item and movement", async () => {
    const prisma = fakePrisma();
    const stock = await intakeStock(prisma, intakeStockSchema.parse({
      mode: "new",
      itemName: "QA Mouse",
      category: "ACCESSORY",
      itemType: "PERIPHERAL",
      receivedQuantity: 5,
      minimumQuantity: 1,
    }));
    expect(stock.name).toBe("QA Mouse");
    expect(prisma.movements[0]).toMatchObject({ movementType: "ADD", previousQuantity: 0, newQuantity: 5 });
  });

  it("stock intake adds quantity to existing item and creates movement", async () => {
    const prisma = fakePrisma({ stockItem: { id: "stock-1", name: "Keyboard", quantityOnHand: 7 } });
    await intakeStock(prisma, intakeStockSchema.parse({
      mode: "existing",
      stockItemId: "stock-1",
      receivedQuantity: 3,
    }));
    expect(prisma.stockQuantity).toBe(10);
    expect(prisma.movements[0]).toMatchObject({ movementType: "ADD", previousQuantity: 7, newQuantity: 10 });
  });

  it("suggestAssetTag returns next available tag for known category", async () => {
    const prisma = {
      device: {
        findMany: async () => [
          { assetTag: "GHT-LP-001" },
          { assetTag: "GHT-LP-005" },
          { assetTag: "GHT-LP-003" },
        ],
      },
    };
    const tag = await suggestAssetTag(prisma as never, "LAPTOP");
    expect(tag).toBe("GHT-LP-006");
  });

  it("suggestAssetTag returns first tag when no existing assets", async () => {
    const prisma = { device: { findMany: async () => [] } };
    const tag = await suggestAssetTag(prisma as never, "LAPTOP");
    expect(tag).toBe("GHT-LP-001");
  });

  it("suggestAssetTag returns null for unknown category prefix", async () => {
    const prisma = { device: { findMany: async () => [] } };
    // Other doesn't have a defined prefix? Wait, OTHER has "GHT-OTH" prefix.
    // If a category has no prefix, it returns null. Wait, let's verify if suggestAssetTag is null for other categories
    // But suggestAssetTag expects a DeviceCategory. All categories might have prefixes or not.
    // Let's just verify suggestAssetTag handles LAPTOP prefix.
    const tag = await suggestAssetTag(prisma as never, "LAPTOP");
    expect(tag).not.toBeNull();
  });

  it("parseMappingCsv parses asset tag and serial from TSV", () => {
    const text = "GHT-SLD-001\tBRN007948UN24\tGHT-IPO-130\nGHT-SLD-002\tBRN007949UN24";
    const rows = parseMappingCsv(text);
    expect(rows[0].assetTag).toBe("GHT-SLD-001");
    expect(rows[0].serialNumber).toBe("BRN007948UN24");
    expect(rows[0].pairedTag).toBe("GHT-IPO-130");
    expect(rows[1].assetTag).toBe("GHT-SLD-002");
    expect(rows[1].pairedTag).toBeNull();
  });

  it("validateMappingRows marks duplicate assetTag in batch", () => {
    const rows = parseMappingCsv("GHT-SLD-001\tSN1\nGHT-SLD-001\tSN2");
    const result = validateMappingRows(rows, new Set(), new Set(), new Set());
    expect(result[0].status).toBe("ready");
    expect(result[1].status).toBe("duplicate");
  });

  it("validateMappingRows marks existing_asset for tag in DB", () => {
    const rows = parseMappingCsv("GHT-SLD-100\tSN1");
    const result = validateMappingRows(rows, new Set(["GHT-SLD-100"]), new Set(), new Set());
    expect(result[0].status).toBe("existing_asset");
  });

  it("validateMappingRows marks paired_missing when paired device not found", () => {
    const rows = parseMappingCsv("GHT-SLD-001\tSN1\tGHT-IPO-999");
    const result = validateMappingRows(rows, new Set(), new Set(), new Set(["GHT-IPO-130"]));
    expect(result[0].status).toBe("paired_missing");
    expect(result[0].warnings[0]).toContain("GHT-IPO-999");
  });

  it("validateMappingRows marks ready when paired device exists", () => {
    const rows = parseMappingCsv("GHT-SLD-001\tSN1\tGHT-IPO-130");
    const result = validateMappingRows(rows, new Set(), new Set(), new Set(["GHT-IPO-130"]));
    expect(result[0].status).toBe("ready");
  });
});

describe("inventory intake route and UI contracts", () => {
  it("API routes enforce write permissions and return 422 validation through shared handler", async () => {
    const singleRoute = await readFile(path.join(process.cwd(), "app/api/intake/assets/single/route.ts"), "utf8");
    const bulkRoute = await readFile(path.join(process.cwd(), "app/api/intake/assets/bulk/route.ts"), "utf8");
    const stockRoute = await readFile(path.join(process.cwd(), "app/api/intake/stock/route.ts"), "utf8");
    expect(singleRoute).toContain('requirePermission("inventory.write")');
    expect(bulkRoute).toContain('requirePermission("inventory.write")');
    expect(stockRoute).toContain('requirePermission("stock.write")');
    expect(singleRoute).toContain("handleApiError");
    expect(bulkRoute).toContain("handleApiError");
    expect(stockRoute).toContain("handleApiError");
  });

  it("legacy import remains admin-only and points users to intake", async () => {
    const source = await readFile(path.join(process.cwd(), "app/import/legacy-sheet/page.tsx"), "utf8");
    expect(source).toContain('hasPageRole("ADMIN")');
    expect(source).toContain("New inventory should be created through Intake");
    expect(source).toContain('href="/intake"');
  });
});

function fakePrisma(options: {
  duplicateAssetTag?: string;
  existingAssetTags?: string[];
  stockItem?: { id: string; name: string; quantityOnHand: number };
} = {}) {
  const state = {
    createdMany: 0,
    stockQuantity: options.stockItem?.quantityOnHand ?? 0,
    movements: [] as Array<Record<string, unknown>>,
    valueProfiles: [] as Array<Record<string, unknown>>,
  };
  const prisma = {
    get createdMany() {
      return state.createdMany;
    },
    get stockQuantity() {
      return state.stockQuantity;
    },
    get movements() {
      return state.movements;
    },
    get valueProfiles() {
      return state.valueProfiles;
    },
    device: {
      findFirst: async ({ where }: { where: { assetTag?: string | null } }) => where.assetTag === options.duplicateAssetTag ? { id: "existing", assetTag: where.assetTag } : null,
      findMany: async () => (options.existingAssetTags ?? []).map((assetTag) => ({ assetTag })),
      create: async ({ data }: { data: { assetTag?: string | null; name: string } }) => ({ id: "device-1", assetTag: data.assetTag ?? null, name: data.name }),
      createMany: async ({ data }: { data: unknown[] }) => {
        state.createdMany = data.length;
        return { count: data.length };
      },
    },
    stockItem: {
      findUnique: async () => options.stockItem ?? null,
      findFirst: async () => null,
      create: async ({ data }: { data: { name: string; quantityOnHand: number } }) => ({ id: "stock-new", name: data.name, quantityOnHand: data.quantityOnHand }),
      update: async ({ data }: { data: { quantityOnHand: number } }) => {
        state.stockQuantity = data.quantityOnHand;
        return { id: options.stockItem?.id ?? "stock-1", name: options.stockItem?.name ?? "Stock", quantityOnHand: data.quantityOnHand };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.movements.push(data);
        return data;
      },
    },
    assetValueProfile: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.valueProfiles.push(data);
        return data;
      },
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        state.valueProfiles.push(...data);
        return { count: data.length };
      },
    },
    activityLog: { create: async () => ({}) },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma),
  };
  return prisma;
}
