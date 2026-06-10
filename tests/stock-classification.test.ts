import { describe, expect, it } from "vitest";
import { canArchiveSuspiciousStock, detectSuspiciousStockComments, isCommentLikeLegacyStockRow, summarizeStockReview } from "@/lib/data-quality";
import { canIssueStockItemFromScan, filterStockItemsForList, suggestStockCategory } from "@/lib/stock-classification";

describe("stock classification and cleanup helpers", () => {
  it("flags imported comment rows and leaves real stock alone", () => {
    const suspicious = detectSuspiciousStockComments([
      stock({ id: "comment", name: "Comentarios", quantityOnHand: 0 }),
      stock({ id: "iphone", name: "Falta crear iPhone J136", quantityOnHand: 0 }),
      stock({ id: "display", name: "Display Base", quantityOnHand: 3 }),
    ]);

    expect(suspicious.map((item) => item.id)).toEqual(["comment", "iphone"]);
    expect(suspicious.every((item) => item.canArchive)).toBe(true);
  });

  it("only archives suspicious unused stock rows", () => {
    expect(canArchiveSuspiciousStock(stock({ name: "Falta crear iPhone J140", quantityOnHand: 0 }))).toBe(true);
    expect(canArchiveSuspiciousStock(stock({ name: "Falta crear iPhone J140", quantityOnHand: 0, _count: { movements: 1, maintenanceRecords: 0, stockIssues: 0, purchaseNoteItems: 0 } }))).toBe(false);
  });

  it("suggests categories for real imported stock names", () => {
    expect(suggestStockCategory({ name: "Ugreen PD FC", category: "OTHER" })?.category).toBe("CHARGER");
    expect(suggestStockCategory({ name: "VOLTME PD FC", category: "OTHER" })?.category).toBe("CHARGER");
    expect(suggestStockCategory({ name: "Apple MFi", category: "OTHER" })?.category).toBe("CABLE");
    expect(suggestStockCategory({ name: "Zebra cs6080 Cable", category: "OTHER" })?.category).toBe("CABLE");
    expect(suggestStockCategory({ name: "Arm Display Base Assembled", category: "OTHER" })?.category).toBe("DISPLAY_BASE");
  });

  it("summarizes stock category cleanup review", () => {
    const summary = summarizeStockReview([
      stock({ id: "a", name: "Ugreen PD FC", category: "OTHER", quantityOnHand: 2 }),
      stock({ id: "b", name: "Cable", category: "CABLE", quantityOnHand: 3 }),
    ]);

    expect(summary.categorySuggestions).toHaveLength(1);
    expect(summary.categorySuggestions[0].suggestedCategory).toBe("CHARGER");
  });

  it("hides archived stock by default and blocks scan issue actions", () => {
    const active = stock({ id: "active", name: "Keyboard", active: true });
    const archived = stock({ id: "archived", name: "Comentarios", active: false });

    expect(filterStockItemsForList([active, archived], false).map((item) => item.id)).toEqual(["active"]);
    expect(filterStockItemsForList([active, archived], true)).toHaveLength(2);
    expect(canIssueStockItemFromScan(active)).toBe(true);
    expect(canIssueStockItemFromScan(archived)).toBe(false);
  });

  it("detects comment-like legacy stock rows for future imports", () => {
    expect(isCommentLikeLegacyStockRow({ name: "Comentarios" })).toBe(true);
    expect(isCommentLikeLegacyStockRow({ name: "Falta crear iPhone J136" })).toBe(true);
    expect(isCommentLikeLegacyStockRow({ name: "Display Base", quantity: 1 })).toBe(false);
  });
});

function stock(overrides: Partial<Parameters<typeof detectSuspiciousStockComments>[0][number]> = {}) {
  return {
    id: "stock",
    name: "Stock",
    sku: null,
    category: "OTHER",
    quantityOnHand: 1,
    minimumQuantity: 0,
    storageLocation: null,
    vendorName: null,
    facturaId: null,
    active: true,
    _count: { movements: 0, maintenanceRecords: 0, stockIssues: 0, purchaseNoteItems: 0 },
    stockIssues: [],
    ...overrides,
  };
}
