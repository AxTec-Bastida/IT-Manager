import type {
  AssetLoan,
  AssetLoanItem,
  AssetLoanItemReturnStatus,
  AssetLoanReturnCondition,
  AssetLoanStatus,
  Device,
  DeviceCondition,
  DeviceStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { ClientInputError } from "@/lib/api";

export const activeAssetLoanStatuses: AssetLoanStatus[] = ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"];
export const blockedAssetLoanStatuses: DeviceStatus[] = ["RETIRED", "DISPOSED", "LOST", "LOANED_OUT", "IN_REPAIR_RMA", "MISSING"];

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"> | Prisma.TransactionClient;

export type CreateAssetLoanInput = {
  loanNumber?: string | null;
  employeeId?: string | null;
  temporaryBorrowerId?: string | null;
  loanedBy?: string | null;
  loanStartAt?: Date | null;
  expectedReturnAt: Date;
  signatureData?: string | null;
  termsAccepted?: boolean;
  termsText?: string | null;
  checkoutNotes?: string | null;
  assetIds: string[];
  conditionOut?: DeviceCondition | null;
  accessoriesOut?: string | null;
  allowAssigned?: boolean;
};

export type ReturnAssetLoanItemInput = {
  itemId: string;
  conditionIn: AssetLoanReturnCondition;
  accessoriesReturned?: string | null;
  returnNotes?: string | null;
  returnedAt?: Date | null;
};

export function borrowerLabel(loan: {
  employee?: { fullName: string; employeeId?: string | null } | null;
  temporaryBorrower?: { name: string; tempId: string } | null;
}) {
  if (loan.employee) return `${loan.employee.fullName}${loan.employee.employeeId ? ` (${loan.employee.employeeId})` : ""}`;
  if (loan.temporaryBorrower) return `${loan.temporaryBorrower.name} (${loan.temporaryBorrower.tempId})`;
  return "Unknown borrower";
}

export function isAssetLoanOverdue(loan: Pick<AssetLoan, "status" | "expectedReturnAt">, now = new Date()) {
  if (!activeAssetLoanStatuses.includes(loan.status)) return false;
  const due = new Date(loan.expectedReturnAt);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < now.getTime();
}

export function canLoanAsset(asset: Pick<Device, "status" | "name" | "assetTag">) {
  if (blockedAssetLoanStatuses.includes(asset.status)) {
    return {
      ok: false as const,
      message: `${asset.assetTag || asset.name} cannot be loaned because its status is ${asset.status.replaceAll("_", " ")}.`,
    };
  }
  return { ok: true as const };
}

export function deviceStatusForLoanReturn(condition: AssetLoanReturnCondition): DeviceStatus {
  if (condition === "GOOD" || condition === "FAIR") return "AVAILABLE";
  if (condition === "LOST") return "LOST";
  return "IN_REPAIR_RMA";
}

export function deviceConditionForLoanReturn(condition: AssetLoanReturnCondition): DeviceCondition {
  if (condition === "GOOD" || condition === "FAIR" || condition === "DAMAGED" || condition === "NOT_WORKING" || condition === "MISSING_ACCESSORIES") {
    return condition;
  }
  return "NEEDS_REVIEW";
}

export function assetLoanItemStatusForCondition(condition: AssetLoanReturnCondition): AssetLoanItemReturnStatus {
  if (condition === "LOST") return "LOST";
  if (condition === "MISSING_ACCESSORIES") return "MISSING_ACCESSORIES";
  if (condition === "DAMAGED" || condition === "NOT_WORKING") return "RETURNED_DAMAGED";
  return "RETURNED";
}

export function assetLoanStatusForItems(items: Array<Pick<AssetLoanItem, "returnStatus" | "returnedAt">>): AssetLoanStatus {
  if (!items.length) return "ACTIVE";
  const pending = items.filter((item) => item.returnStatus === "PENDING" && !item.returnedAt).length;
  const finished = items.length - pending;
  if (pending > 0 && finished > 0) return "PARTIALLY_RETURNED";
  if (pending > 0) return "ACTIVE";
  if (items.every((item) => item.returnStatus === "LOST")) return "LOST";
  if (items.some((item) => item.returnStatus === "RETURNED_DAMAGED" || item.returnStatus === "MISSING_ACCESSORIES")) return "RETURNED_DAMAGED";
  if (items.every((item) => item.returnStatus === "CANCELLED")) return "CANCELLED";
  return "RETURNED";
}

export async function nextAssetLoanNumber(prisma: Tx) {
  const count = await prisma.assetLoan.count();
  return `AL-${String(count + 1).padStart(5, "0")}`;
}

export async function createAssetLoan(prisma: PrismaClient, input: CreateAssetLoanInput) {
  const assetIds = [...new Set(input.assetIds.filter(Boolean))];
  if (!assetIds.length) throw new ClientInputError("Select at least one asset.");
  if (!input.employeeId && !input.temporaryBorrowerId) throw new ClientInputError("Select an employee or temporary borrower.");
  if (input.employeeId && input.temporaryBorrowerId) throw new ClientInputError("Choose only one borrower type.");

  return prisma.$transaction(async (tx) => {
    const devices = await tx.device.findMany({
      where: { id: { in: assetIds } },
      include: {
        employee: true,
        rmaItems: { where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } }, include: { rmaCase: true } },
        assetLoanItems: { where: { returnStatus: "PENDING", loan: { status: { in: activeAssetLoanStatuses } } }, include: { loan: true } },
      },
    });
    if (devices.length !== assetIds.length) throw new ClientInputError("One or more selected assets were not found.");

    const blocked = devices.map(canLoanAsset).find((result) => !result.ok);
    if (blocked) throw new ClientInputError(blocked.message);
    const activeLoan = devices.find((device) => device.assetLoanItems.length > 0);
    if (activeLoan) throw new ClientInputError(`${activeLoan.assetTag || activeLoan.name} is already checked out.`);
    const activeRma = devices.find((device) => device.rmaItems.length > 0);
    if (activeRma) throw new ClientInputError(`${activeRma.assetTag || activeRma.name} is in active RMA ${activeRma.rmaItems[0]?.rmaCase.rmaNumber}.`);
    const assigned = devices.find((device) => device.employeeId || device.assignedTo);
    if (assigned && !input.allowAssigned) throw new ClientInputError(`${assigned.assetTag || assigned.name} is currently assigned. Confirm assigned assets before creating this loan.`);

    const loan = await tx.assetLoan.create({
      data: {
        loanNumber: clean(input.loanNumber) || (await nextAssetLoanNumber(tx)),
        employeeId: clean(input.employeeId),
        temporaryBorrowerId: clean(input.temporaryBorrowerId),
        loanedBy: clean(input.loanedBy),
        loanStartAt: input.loanStartAt ?? new Date(),
        expectedReturnAt: input.expectedReturnAt,
        signatureData: clean(input.signatureData),
        termsAccepted: Boolean(input.termsAccepted),
        termsText: clean(input.termsText),
        checkoutNotes: clean(input.checkoutNotes),
        items: {
          create: devices.map((device) => ({
            deviceId: device.id,
            conditionOut: input.conditionOut ?? device.condition,
            accessoriesOut: clean(input.accessoriesOut),
          })),
        },
      },
      include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } },
    });

    for (const item of loan.items) {
      await tx.device.update({ where: { id: item.deviceId }, data: { status: "LOANED_OUT" } });
      await tx.activityLog.create({
        data: {
          action: "asset_loan.checked_out",
          entity: "device",
          entityId: item.deviceId,
          message: `${item.device.name} was checked out to ${borrowerLabel(loan)}. Assignment history was preserved.`,
          metadata: JSON.stringify({ assetLoanId: loan.id, loanNumber: loan.loanNumber, employeeId: loan.employeeId, temporaryBorrowerId: loan.temporaryBorrowerId }),
        },
      });
    }

    await tx.activityLog.create({
      data: {
        action: "asset_loan.created",
        entity: "AssetLoan",
        entityId: loan.id,
        message: `Asset loan ${loan.loanNumber} created for ${borrowerLabel(loan)} with ${loan.items.length} asset${loan.items.length === 1 ? "" : "s"}.`,
      },
    });

    return loan;
  });
}

export async function returnAssetLoanItems(prisma: PrismaClient, loanId: string, items: ReturnAssetLoanItemInput[], returnNotes?: string | null) {
  if (!items.length) throw new ClientInputError("Select at least one asset to return.");

  return prisma.$transaction(async (tx) => {
    const loan = await tx.assetLoan.findUnique({
      where: { id: loanId },
      include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } },
    });
    if (!loan) throw new ClientInputError("Asset loan not found.", 404);
    if (loan.status === "RETURNED" || loan.status === "CANCELLED") throw new ClientInputError("This loan is already closed.");
    const itemMap = new Map(loan.items.map((item) => [item.id, item]));
    const now = new Date();

    for (const input of items) {
      const item = itemMap.get(input.itemId);
      if (!item) continue;
      if (item.returnStatus !== "PENDING") continue;
      const returnedAt = input.returnedAt ?? now;
      const returnStatus = assetLoanItemStatusForCondition(input.conditionIn);
      await tx.assetLoanItem.update({
        where: { id: item.id },
        data: {
          conditionIn: input.conditionIn,
          accessoriesReturned: clean(input.accessoriesReturned),
          returnNotes: clean(input.returnNotes),
          returnStatus,
          returnedAt,
        },
      });
      await tx.device.update({
        where: { id: item.deviceId },
        data: { status: deviceStatusForLoanReturn(input.conditionIn), condition: deviceConditionForLoanReturn(input.conditionIn) },
      });
      await tx.activityLog.create({
        data: {
          action: "asset_loan.returned",
          entity: "device",
          entityId: item.deviceId,
          message: `${item.device.name} was returned from asset loan ${loan.loanNumber} as ${input.conditionIn.replaceAll("_", " ").toLowerCase()}.`,
          metadata: JSON.stringify({ assetLoanId: loan.id, loanNumber: loan.loanNumber, conditionIn: input.conditionIn, returnStatus }),
        },
      });
    }

    const updated = await tx.assetLoan.findUnique({ where: { id: loanId }, include: { items: true } });
    if (!updated) throw new Error("Asset loan not found after return.");
    const nextStatus = assetLoanStatusForItems(updated.items);
    const noPending = !updated.items.some((item) => item.returnStatus === "PENDING");
    const saved = await tx.assetLoan.update({
      where: { id: loanId },
      data: {
        status: nextStatus,
        actualReturnAt: noPending ? now : updated.actualReturnAt,
        returnNotes: [updated.returnNotes, clean(returnNotes)].filter(Boolean).join(" | ") || updated.returnNotes,
      },
      include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } },
    });
    await tx.activityLog.create({
      data: {
        action: "asset_loan.return_update",
        entity: "AssetLoan",
        entityId: saved.id,
        message: `Asset loan ${saved.loanNumber} return update saved. Status is ${saved.status.replaceAll("_", " ")}.`,
      },
    });
    return saved;
  });
}

function clean(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}
