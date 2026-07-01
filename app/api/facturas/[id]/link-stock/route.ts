import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("stock.write");
    const { id } = await context.params;
    const { stockItemId } = await request.json();
    if (!stockItemId) return jsonError("stockItemId is required.", 400);

    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) return jsonError("Factura not found.", 404);

    const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!stockItem) return jsonError("Stock item not found.", 404);

    await prisma.$transaction([
      prisma.stockItem.update({
        where: { id: stockItemId },
        data: { facturaId: id },
      }),
      prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.stock_linked",
          entity: "factura",
          entityId: id,
          message: `Stock item ${stockItem.name} linked to factura ${factura.facturaNumber}.`,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("stock.write");
    const { id } = await context.params;
    const { stockItemId } = await request.json();
    if (!stockItemId) return jsonError("stockItemId is required.", 400);

    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) return jsonError("Factura not found.", 404);

    const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!stockItem) return jsonError("Stock item not found.", 404);

    await prisma.$transaction([
      prisma.stockItem.update({
        where: { id: stockItemId },
        data: { facturaId: null },
      }),
      prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.stock_unlinked",
          entity: "factura",
          entityId: id,
          message: `Stock item ${stockItem.name} unlinked from factura ${factura.facturaNumber}.`,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
