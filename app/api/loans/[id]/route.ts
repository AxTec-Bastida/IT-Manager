import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { activeAssetLoanStatuses } from "@/lib/asset-loans";
import { assetLoanSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const loan = await prisma.assetLoan.findUnique({ where: { id }, include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } } });
  if (!loan) return jsonError("Asset loan not found.", 404);
  return NextResponse.json({ loan });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = assetLoanSchema.parse({ ...payload, assetIds: Array.isArray(payload.assetIds) ? payload.assetIds : [] });
    const existing = await prisma.assetLoan.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return jsonError("Asset loan not found.", 404);
    const newAssetIds = parsed.assetIds.filter((assetId) => !existing.items.some((item) => item.deviceId === assetId));

    const loan = await prisma.$transaction(async (tx) => {
      if (newAssetIds.length) {
        const devices = await tx.device.findMany({
          where: { id: { in: newAssetIds } },
          include: {
            assetLoanItems: { where: { returnStatus: "PENDING", loan: { status: { in: activeAssetLoanStatuses } } } },
            rmaItems: { where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } } },
          },
        });
        const blocked = devices.find((device) => ["RETIRED", "DISPOSED", "LOST", "LOANED_OUT", "IN_REPAIR_RMA", "MISSING"].includes(device.status) || device.assetLoanItems.length || device.rmaItems.length);
        if (blocked) throw new Error(`${blocked.assetTag || blocked.name} cannot be added to this active loan.`);
        const assigned = devices.find((device) => device.employeeId || device.assignedTo);
        if (assigned && !parsed.allowAssigned) throw new Error(`${assigned.assetTag || assigned.name} is currently assigned. Confirm assigned assets before adding it.`);
      }

      const updated = await tx.assetLoan.update({
        where: { id },
        data: {
          loanNumber: parsed.loanNumber || existing.loanNumber,
          employeeId: parsed.employeeId,
          temporaryBorrowerId: parsed.temporaryBorrowerId,
          loanedBy: parsed.loanedBy,
          loanStartAt: parsed.loanStartAt,
          expectedReturnAt: parsed.expectedReturnAt,
          signatureData: parsed.signatureData,
          termsAccepted: parsed.termsAccepted,
          termsText: parsed.termsText,
          checkoutNotes: parsed.checkoutNotes,
          items: newAssetIds.length ? { create: newAssetIds.map((deviceId) => ({ deviceId, conditionOut: parsed.conditionOut, accessoriesOut: parsed.accessoriesOut })) } : undefined,
        },
        include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } },
      });
      for (const deviceId of newAssetIds) {
        await tx.device.update({ where: { id: deviceId }, data: { status: "LOANED_OUT" } });
      }
      await tx.activityLog.create({ data: { action: "asset_loan.updated", entity: "AssetLoan", entityId: id, message: `Asset loan ${updated.loanNumber} was updated.` } });
      return updated;
    });

    return NextResponse.json({ loan });
  } catch (error) {
    return handleApiError(error);
  }
}
