import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { stockIssueSchema } from "@/lib/validation";
import { issueStock, isStockLoanOverdue } from "@/lib/stock-issues";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const status = request.nextUrl.searchParams.get("status")?.trim();
  const issueType = request.nextUrl.searchParams.get("issueType")?.trim();
  const overdue = request.nextUrl.searchParams.get("overdue") === "true";
  const temporary = request.nextUrl.searchParams.get("temporary") === "true";

  const where: Prisma.StockIssueWhereInput = {
    ...(status ? { status: status as never } : {}),
    ...(issueType ? { issueType: issueType as never } : {}),
    ...(temporary ? { temporaryBorrowerId: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { issueNumber: { contains: q } },
            { notes: { contains: q } },
            { stockItem: { name: { contains: q } } },
            { stockItem: { sku: { contains: q } } },
            { stockItem: { barcodeValue: { contains: q } } },
            { employee: { fullName: { contains: q } } },
            { employee: { employeeId: { contains: q } } },
            { temporaryBorrower: { name: { contains: q } } },
            { temporaryBorrower: { tempId: { contains: q } } },
          ],
        }
      : {}),
  };

  const issues = await prisma.stockIssue.findMany({
    where,
    include: { stockItem: true, employee: true, temporaryBorrower: true },
    orderBy: [{ status: "asc" }, { expectedReturnAt: "asc" }, { issuedAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ issues: overdue ? issues.filter((issue) => isStockLoanOverdue(issue)) : issues });
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("stock.write");
    const payload = await request.json();
    const parsed = stockIssueSchema.parse(payload);
    const result = await issueStock(prisma, parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
