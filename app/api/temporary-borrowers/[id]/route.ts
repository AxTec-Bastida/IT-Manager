import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { temporaryBorrowerSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const borrower = await prisma.temporaryBorrower.findUnique({
    where: { id },
    include: { stockIssues: { include: { stockItem: true }, orderBy: { issuedAt: "desc" } } },
  });
  if (!borrower) return jsonError("Temporary borrower not found.", 404);
  return NextResponse.json({ borrower });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requirePermission("stock.write");
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = temporaryBorrowerSchema.parse(payload);
    const { tempId, ...data } = parsed;
    const borrower = await prisma.temporaryBorrower.update({ where: { id }, data: { ...data, ...(tempId ? { tempId } : {}) } });
    await prisma.activityLog.create({
      data: {
        action: borrower.active ? "temporary_borrower.updated" : "temporary_borrower.deactivated",
        entity: "TemporaryBorrower",
        entityId: borrower.id,
        message: `${borrower.name} temporary borrower record was ${borrower.active ? "updated" : "deactivated"}.`,
      },
    });
    return NextResponse.json({ borrower });
  } catch (error) {
    return handleApiError(error);
  }
}
