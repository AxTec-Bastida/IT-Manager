import { NextRequest, NextResponse } from "next/server";
import type { AssetLoanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { activeAssetLoanStatuses, createAssetLoan, isAssetLoanOverdue } from "@/lib/asset-loans";
import { assetLoanSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";
import { sendAssetLoanWorkflowEmail } from "@/lib/email-workflows";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const view = searchParams.get("view")?.trim();
  const status = searchParams.get("status")?.trim();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const where: Prisma.AssetLoanWhereInput = {
    ...(view === "active" ? { status: { in: activeAssetLoanStatuses } } : {}),
    ...(view === "overdue" ? { status: { in: activeAssetLoanStatuses }, expectedReturnAt: { lt: startOfDay(new Date()) } } : {}),
    ...(view === "due-today" ? { status: { in: activeAssetLoanStatuses }, expectedReturnAt: { lte: today, gte: startOfDay(new Date()) } } : {}),
    ...(status ? { status: status as AssetLoanStatus } : {}),
    ...(q
      ? {
          OR: [
            { loanNumber: { contains: q } },
            { loanedBy: { contains: q } },
            { checkoutNotes: { contains: q } },
            { employee: { OR: [{ fullName: { contains: q } }, { employeeId: { contains: q } }, { email: { contains: q } }] } },
            { temporaryBorrower: { OR: [{ name: { contains: q } }, { tempId: { contains: q } }, { email: { contains: q } }] } },
            { items: { some: { device: { OR: [{ assetTag: { contains: q } }, { serialNumber: { contains: q } }, { model: { contains: q } }, { name: { contains: q } }] } } } },
          ],
        }
      : {}),
  };

  const loans = await prisma.assetLoan.findMany({
    where,
    include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } },
    orderBy: [{ status: "asc" }, { expectedReturnAt: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ loans: loans.map((loan) => ({ ...loan, computedOverdue: isAssetLoanOverdue(loan) })) });
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("loans.write");
    const payload = await request.json();
    const parsed = assetLoanSchema.parse({ ...payload, assetIds: Array.isArray(payload.assetIds) ? payload.assetIds : [] });
    const loan = await createAssetLoan(prisma, parsed);
    const emailResult = await sendAssetLoanWorkflowEmail(prisma, loan.id, "checkout");
    return NextResponse.json({ loan, emailResult }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
