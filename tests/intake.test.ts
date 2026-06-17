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
