import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { temporaryBorrowerSchema } from "@/lib/validation";
import { nextTemporaryBorrowerId } from "@/lib/stock-issues";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const active = request.nextUrl.searchParams.get("active");
  const where: Prisma.TemporaryBorrowerWhereInput = {
    ...(active === "true" ? { active: true } : active === "false" ? { active: false } : {}),
    ...(q
      ? {
          OR: [
            { tempId: { contains: q } },
            { name: { contains: q } },
            { department: { contains: q } },
            { area: { contains: q } },
            { supervisorName: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };
  const borrowers = await prisma.temporaryBorrower.findMany({
    where,
    include: { stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, include: { stockItem: true } } },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ borrowers });
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("stock.write");
    const payload = await request.json();
    const parsed = temporaryBorrowerSchema.parse(payload);
    const borrower = await prisma.$transaction(async (tx) => {
      const tempId = parsed.tempId || (await nextTemporaryBorrowerId(tx));
      const created = await tx.temporaryBorrower.create({ data: { ...parsed, tempId } });
      await tx.activityLog.create({
        data: {
          action: "temporary_borrower.created",
          entity: "TemporaryBorrower",
          entityId: created.id,
          message: `${created.name} was created as temporary borrower ${created.tempId}.`,
        },
      });
      return created;
    });
    return NextResponse.json({ borrower }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
