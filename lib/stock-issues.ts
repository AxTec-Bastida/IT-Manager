import type { Prisma, PrismaClient, StockIssueStatus, StockIssueType, StockReturnCondition } from "@prisma/client";
import { calculateStockMovement } from "@/lib/stock";
import { ClientInputError } from "@/lib/api";

export const activeStockIssueStatuses: StockIssueStatus[] = ["ACTIVE", "PARTIALLY_RETURNED"];

export type IssueStockInput = {
  stockItemId: string;
  quantity: number;
  issueType: StockIssueType;
  employeeId?: string | null;
  temporaryBorrowerId?: string | null;
  issuedBy?: string | null;
  issuedAt?: Date | null;
  expectedReturnAt?: Date | null;
  conditionOut?: string | null;
  notes?: string | null;
};

export type ReturnStockIssueInput = {
  returnedQuantity: number;
  conditionIn: StockReturnCondition;
  returnedAt?: Date | null;
  returnNotes?: string | null;
};

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"> | Prisma.TransactionClient;

export function borrowerLabel(issue: {
  employee?: { fullName: string; employeeId?: string | null } | null;
  temporaryBorrower?: { name: string; tempId: string } | null;
}) {
  if (issue.employee) return `${issue.employee.fullName}${issue.employee.employeeId ? ` (${issue.employee.employeeId})` : ""}`;
  if (issue.temporaryBorrower) return `${issue.temporaryBorrower.name} (${issue.temporaryBorrower.tempId})`;
  return "Unknown borrower";
}

function normalizeScanText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function stockItemMatchesScan(
  item: { barcodeValue?: string | null; sku?: string | null; name: string },
  value: string,
) {
  const scan = normalizeScanText(value);
  if (!scan) return false;
  return [item.barcodeValue, item.sku, item.name].some((candidate) => {
    const normalized = normalizeScanText(candidate);
    if (!normalized) return false;
    return normalized === scan || normalized.includes(scan) || scan.includes(normalized);
  });
}

export function employeeMatchesIssueScan(employee: { employeeId?: string | null; fullName: string; email?: string | null }, value: string) {
  const scan = normalizeScanText(value);
  if (!scan) return false;
  return [employee.employeeId, employee.fullName, employee.email].some((candidate) => {
    const normalized = normalizeScanText(candidate);
    if (!normalized) return false;
    return normalized === scan || normalized.includes(scan);
  });
}

export function temporaryBorrowerMatchesIssueScan(borrower: { tempId: string; name: string; email?: string | null }, value: string) {
  const scan = normalizeScanText(value);
  if (!scan) return false;
  return [borrower.tempId, borrower.name, borrower.email].some((candidate) => {
    const normalized = normalizeScanText(candidate);
    if (!normalized) return false;
    return normalized === scan || normalized.includes(scan);
  });
}

export function isStockLoanOverdue(issue: { issueType: StockIssueType; status: StockIssueStatus; expectedReturnAt?: Date | null }, now = new Date()) {
  if (issue.issueType !== "LOAN" || !activeStockIssueStatuses.includes(issue.status) || !issue.expectedReturnAt) return false;
  const due = new Date(issue.expectedReturnAt);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < now.getTime();
}

export function stockIssueStatusAfterReturn(quantity: number, returnedQuantity: number): StockIssueStatus {
  if (returnedQuantity <= 0) return "ACTIVE";
  return returnedQuantity >= quantity ? "RETURNED" : "PARTIALLY_RETURNED";
}

export function shouldReturnToUsableStock(condition: StockReturnCondition) {
  return condition === "GOOD" || condition === "FAIR";
}

export async function nextTemporaryBorrowerId(prisma: Tx) {
  const count = await prisma.temporaryBorrower.count();
  return `TEMP-${String(count + 1).padStart(3, "0")}`;
}

export async function nextStockIssueNumber(prisma: Tx) {
  const count = await prisma.stockIssue.count();
  return `SI-${String(count + 1).padStart(5, "0")}`;
}

export async function issueStock(prisma: PrismaClient, input: IssueStockInput) {
  if (!input.employeeId && !input.temporaryBorrowerId) throw new ClientInputError("Select an employee or temporary borrower.");
  if (input.employeeId && input.temporaryBorrowerId) throw new ClientInputError("Choose only one borrower type.");
  if (input.issueType === "LOAN" && input.expectedReturnAt && input.expectedReturnAt < (input.issuedAt ?? new Date("1900-01-01"))) {
    throw new ClientInputError("Expected return date cannot be before issued date.");
  }

  return prisma.$transaction(async (tx) => {
    const stockItem = await tx.stockItem.findUnique({ where: { id: input.stockItemId } });
    if (!stockItem || !stockItem.active) throw new ClientInputError("Stock item not found.", 404);

    const calculated = calculateStockMovement({
      currentQuantity: stockItem.quantityOnHand,
      movementType: input.issueType === "LOAN" ? "LOANED_OUT" : "HANDED_OUT",
      quantity: input.quantity,
    });

    const issue = await tx.stockIssue.create({
      data: {
        issueNumber: await nextStockIssueNumber(tx),
        stockItemId: stockItem.id,
        quantity: calculated.quantity,
        issueType: input.issueType,
        status: input.issueType === "HANDOUT" ? "RETURNED" : "ACTIVE",
        employeeId: input.employeeId || null,
        temporaryBorrowerId: input.temporaryBorrowerId || null,
        issuedBy: input.issuedBy || null,
        issuedAt: input.issuedAt ?? new Date(),
        expectedReturnAt: input.issueType === "LOAN" ? input.expectedReturnAt ?? null : null,
        conditionOut: input.conditionOut || null,
        notes: input.notes || null,
      },
      include: { stockItem: true, employee: true, temporaryBorrower: true },
    });

    const updatedStockItem = await tx.stockItem.update({ where: { id: stockItem.id }, data: { quantityOnHand: calculated.newQuantity } });
    await tx.stockMovement.create({
      data: {
        stockItemId: stockItem.id,
        stockIssueId: issue.id,
        employeeId: input.employeeId || null,
        temporaryBorrowerId: input.temporaryBorrowerId || null,
        movementType: input.issueType === "LOAN" ? "LOANED_OUT" : "HANDED_OUT",
        quantity: calculated.quantity,
        previousQuantity: calculated.previousQuantity,
        newQuantity: calculated.newQuantity,
        reason: input.issueType === "LOAN" ? "Stock loan" : "Stock handout",
        notes: input.notes || null,
        performedBy: input.issuedBy || null,
      },
    });
    await tx.activityLog.create({
      data: {
        action: input.issueType === "LOAN" ? "stock.loaned" : "stock.handed_out",
        entity: "StockIssue",
        entityId: issue.id,
        message: `${stockItem.name} ${input.issueType === "LOAN" ? "loaned to" : "handed out to"} ${borrowerLabel(issue)}. Quantity ${calculated.previousQuantity} to ${calculated.newQuantity}.`,
        metadata: JSON.stringify({ stockItemId: stockItem.id, issueType: input.issueType, quantity: calculated.quantity }),
      },
    });

    return { issue, stockItem: updatedStockItem };
  });
}

export async function returnStockIssue(prisma: PrismaClient, id: string, input: ReturnStockIssueInput) {
  return prisma.$transaction(async (tx) => {
    const issue = await tx.stockIssue.findUnique({
      where: { id },
      include: { stockItem: true, employee: true, temporaryBorrower: true },
    });
    if (!issue) throw new ClientInputError("Stock issue not found.", 404);
    if (issue.issueType !== "LOAN") throw new ClientInputError("Only loaned stock can be returned.");
    if (issue.status === "RETURNED" || issue.status === "CANCELLED") throw new ClientInputError("This stock issue is already closed.");

    const remaining = issue.quantity - issue.returnedQuantity;
    const quantity = Math.trunc(input.returnedQuantity);
    if (quantity > remaining) throw new ClientInputError(`Only ${remaining} item${remaining === 1 ? " remains" : "s remain"} to return.`);

    const usableReturn = shouldReturnToUsableStock(input.conditionIn);
    const calculated = usableReturn
      ? calculateStockMovement({ currentQuantity: issue.stockItem.quantityOnHand, movementType: "RETURNED_TO_STOCK", quantity })
      : { previousQuantity: issue.stockItem.quantityOnHand, newQuantity: issue.stockItem.quantityOnHand, quantity };
    const nextReturnedQuantity = issue.returnedQuantity + quantity;
    const nextStatus = stockIssueStatusAfterReturn(issue.quantity, nextReturnedQuantity);

    const [updatedIssue, updatedStockItem] = await Promise.all([
      tx.stockIssue.update({
        where: { id },
        data: {
          returnedQuantity: nextReturnedQuantity,
          status: nextStatus,
          conditionIn: input.conditionIn,
          returnedAt: nextStatus === "RETURNED" ? input.returnedAt ?? new Date() : issue.returnedAt,
          returnNotes: [issue.returnNotes, input.returnNotes].filter(Boolean).join(" | ") || null,
        },
        include: { stockItem: true, employee: true, temporaryBorrower: true },
      }),
      tx.stockItem.update({ where: { id: issue.stockItemId }, data: { quantityOnHand: calculated.newQuantity } }),
    ]);

    await tx.stockMovement.create({
      data: {
        stockItemId: issue.stockItemId,
        stockIssueId: issue.id,
        employeeId: issue.employeeId,
        temporaryBorrowerId: issue.temporaryBorrowerId,
        movementType: "RETURNED_TO_STOCK",
        quantity,
        previousQuantity: calculated.previousQuantity,
        newQuantity: calculated.newQuantity,
        reason: usableReturn ? "Loan return" : `Loan return - ${input.conditionIn.replaceAll("_", " ").toLowerCase()}`,
        notes: input.returnNotes || null,
      },
    });
    await tx.activityLog.create({
      data: {
        action: "stock.loan_returned",
        entity: "StockIssue",
        entityId: issue.id,
        message: `${quantity} ${issue.stockItem.name} returned from ${borrowerLabel(issue)} as ${input.conditionIn.replaceAll("_", " ").toLowerCase()}. Quantity ${calculated.previousQuantity} to ${calculated.newQuantity}.`,
        metadata: JSON.stringify({ stockItemId: issue.stockItemId, conditionIn: input.conditionIn, returnedQuantity: quantity, usableReturn }),
      },
    });

    return { issue: updatedIssue, stockItem: updatedStockItem };
  });
}
