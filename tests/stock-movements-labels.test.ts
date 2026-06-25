import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ClientInputError } from "@/lib/api";
import { calculateStockMovement, stockMovementAction, isLowStock } from "@/lib/stock";
import { generateRangeLabels } from "@/lib/labels";

describe("stock movements calculations", () => {
  it("correctly adds stock for RESTOCK, RECEIVE, and RETURN", () => {
    const restock = calculateStockMovement({
      currentQuantity: 10,
      movementType: "RESTOCK",
      quantity: 5,
    });
    expect(restock).toEqual({ previousQuantity: 10, newQuantity: 15, quantity: 5 });

    const receive = calculateStockMovement({
      currentQuantity: 20,
      movementType: "RECEIVE",
      quantity: 10,
    });
    expect(receive).toEqual({ previousQuantity: 20, newQuantity: 30, quantity: 10 });

    const ret = calculateStockMovement({
      currentQuantity: 5,
      movementType: "RETURN",
      quantity: 2,
    });
    expect(ret).toEqual({ previousQuantity: 5, newQuantity: 7, quantity: 2 });
  });

  it("correctly subtracts stock for ISSUE", () => {
    const issue = calculateStockMovement({
      currentQuantity: 15,
      movementType: "ISSUE",
      quantity: 3,
    });
    expect(issue).toEqual({ previousQuantity: 15, newQuantity: 12, quantity: 3 });
  });

  it("correctly handles PHYSICAL_COUNT adjustments", () => {
    const adjustUp = calculateStockMovement({
      currentQuantity: 50,
      movementType: "PHYSICAL_COUNT",
      quantity: 0,
      adjustmentTarget: 55,
    });
    expect(adjustUp).toEqual({ previousQuantity: 50, newQuantity: 55, quantity: 5 });

    const adjustDown = calculateStockMovement({
      currentQuantity: 50,
      movementType: "PHYSICAL_COUNT",
      quantity: 0,
      adjustmentTarget: 40,
    });
    expect(adjustDown).toEqual({ previousQuantity: 50, newQuantity: 40, quantity: 10 });
  });

  it("throws error if stock goes below zero", () => {
    expect(() =>
      calculateStockMovement({
        currentQuantity: 5,
        movementType: "ISSUE",
        quantity: 10,
      })
    ).toThrow(ClientInputError);

    expect(() =>
      calculateStockMovement({
        currentQuantity: 5,
        movementType: "PHYSICAL_COUNT",
        quantity: 0,
        adjustmentTarget: -1,
      })
    ).toThrow(ClientInputError);
  });

  it("returns correct action descriptions", () => {
    expect(stockMovementAction("RESTOCK")).toBe("increased");
    expect(stockMovementAction("RECEIVE")).toBe("increased");
    expect(stockMovementAction("RETURN")).toBe("increased");
    expect(stockMovementAction("ISSUE")).toBe("decreased");
    expect(stockMovementAction("PHYSICAL_COUNT")).toBe("adjusted");
  });

  it("detects low stock based on threshold", () => {
    expect(isLowStock(5, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(11, 10)).toBe(false);
  });
});

describe("label padding and range logic", () => {
  it("supports J01 with padding 2 and J001 with padding 3", () => {
    const j01 = generateRangeLabels({ prefix: "J", start: 1, end: 3, padding: 2 });
    expect(j01.map((item) => item.assetTag)).toEqual(["J01", "J02", "J03"]);

    const j001 = generateRangeLabels({ prefix: "J", start: 1, end: 3, padding: 3 });
    expect(j001.map((item) => item.assetTag)).toEqual(["J001", "J002", "J003"]);
  });

  it("supports custom stock code format STK-0001 with padding 4", () => {
    const stk = generateRangeLabels({ prefix: "STK-", start: 9, end: 11, padding: 4 });
    expect(stk.map((item) => item.assetTag)).toEqual(["STK-0009", "STK-0010", "STK-0011"]);
  });
});

describe("stock code generation API and page contracts", () => {
  it("asserts GET endpoint has permission check and uses STK- prefix", async () => {
    const apiFile = await readFile(path.join(process.cwd(), "app/api/stock/generate-code/route.ts"), "utf8");
    expect(apiFile).toContain('requirePermission("stock.write")');
    expect(apiFile).toContain('const prefix = "STK-";');
    expect(apiFile).toContain('NextResponse.json({ suggested })');
  });
});
