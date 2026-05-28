import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { stockItemSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const stockItem = await prisma.stockItem.findUnique({
    where: { id },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 25, include: { asset: true, employee: true } },
      maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 25, include: { asset: true } },
      alerts: { where: { status: "OPEN" }, orderBy: { lastSeenAt: "desc" } },
    },
  });
  if (!stockItem) return jsonError("Stock item not found.", 404);
  return NextResponse.json({ stockItem });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const data = stockItemSchema.parse(payload);
    const stockItem = await prisma.stockItem.update({ where: { id }, data });

    await prisma.activityLog.create({
      data: {
        action: "stock.updated",
        entity: "stock",
        entityId: id,
        message: `${stockItem.name} was updated.`,
      },
    });

    return NextResponse.json({ stockItem });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const stockItem = await prisma.stockItem.update({ where: { id }, data: { active: false } });
    await prisma.activityLog.create({
      data: {
        action: "stock.deactivated",
        entity: "stock",
        entityId: id,
        message: `${stockItem.name} was deactivated and kept in history.`,
      },
    });
    return NextResponse.json({ stockItem });
  } catch (error) {
    return handleApiError(error);
  }
}
