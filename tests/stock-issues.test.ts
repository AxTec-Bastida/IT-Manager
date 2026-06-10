import { describe, expect, it } from "vitest";
import { calculateStockMovement } from "@/lib/stock";
import {
  employeeMatchesIssueScan,
  isStockLoanOverdue,
  shouldReturnToUsableStock,
  stockIssueStatusAfterReturn,
  stockItemMatchesScan,
  temporaryBorrowerMatchesIssueScan,
} from "@/lib/stock-issues";

describe("scan-based stock issues", () => {
  it("finds stock items by scan code, SKU, or name", () => {
    const item = { name: "Keyboard", sku: "KEY-STD", barcodeValue: "STOCK:KEYBOARD" };
    expect(stockItemMatchesScan(item, "STOCK:KEYBOARD")).toBe(true);
    expect(stockItemMatchesScan(item, "KEY-STD")).toBe(true);
    expect(stockItemMatchesScan(item, "keyboard")).toBe(true);
    expect(stockItemMatchesScan({ name: "Mouse", sku: null, barcodeValue: null }, "keyboard")).toBe(false);
  });

  it("matches employees and temporary borrowers for issue workflow scans", () => {
    expect(employeeMatchesIssueScan({ employeeId: "E-100", fullName: "Juan Perez", email: "juan@example.com" }, "E-100")).toBe(true);
    expect(employeeMatchesIssueScan({ employeeId: null, fullName: "Juan Perez", email: null }, "juan")).toBe(true);
    expect(temporaryBorrowerMatchesIssueScan({ tempId: "TEMP-001", name: "Contractor One", email: null }, "TEMP-001")).toBe(true);
  });

  it("decreases stock for handouts and loans without allowing negative stock", () => {
    expect(calculateStockMovement({ currentQuantity: 5, movementType: "HANDED_OUT", quantity: 1 }).newQuantity).toBe(4);
    expect(calculateStockMovement({ currentQuantity: 5, movementType: "LOANED_OUT", quantity: 2 }).newQuantity).toBe(3);
    expect(() => calculateStockMovement({ currentQuantity: 1, movementType: "LOANED_OUT", quantity: 2 })).toThrow("below zero");
  });

  it("maps partial and full stock loan returns", () => {
    expect(stockIssueStatusAfterReturn(3, 1)).toBe("PARTIALLY_RETURNED");
    expect(stockIssueStatusAfterReturn(3, 3)).toBe("RETURNED");
    expect(shouldReturnToUsableStock("GOOD")).toBe(true);
    expect(shouldReturnToUsableStock("FAIR")).toBe(true);
    expect(shouldReturnToUsableStock("DAMAGED")).toBe(false);
    expect(shouldReturnToUsableStock("MISSING")).toBe(false);
  });

  it("detects overdue active stock loans", () => {
    expect(isStockLoanOverdue({ issueType: "LOAN", status: "ACTIVE", expectedReturnAt: new Date("2026-05-20") }, new Date("2026-05-29"))).toBe(true);
    expect(isStockLoanOverdue({ issueType: "LOAN", status: "RETURNED", expectedReturnAt: new Date("2026-05-20") }, new Date("2026-05-29"))).toBe(false);
    expect(isStockLoanOverdue({ issueType: "HANDOUT", status: "RETURNED", expectedReturnAt: null }, new Date("2026-05-29"))).toBe(false);
  });
});
