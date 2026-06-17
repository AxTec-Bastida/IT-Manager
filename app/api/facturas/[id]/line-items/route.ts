import { NextRequest, NextResponse } from "next/server";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { calculateLineItemTotal } from "@/lib/factura-line-items";
import { prisma } from "@/lib/prisma";
import { facturaLineItemSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { id } = await context.params;
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: { lineItems: { include: { assetLinks: { include: { device: true } } }, orderBy: { createdAt: "asc" } } },
    });
    if (!factura) return jsonError("Factura not found.", 404);
    return NextResponse.json({ lineItems: factura.lineItems });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) return jsonError("Factura not found.", 404);
    const input = facturaLineItemSchema.parse(await request.json());
    const lineItem = await prisma.facturaLineItem.create({
      data: {
        facturaId: factura.id,
        description: input.description,
        sku: input.sku,
        model: input.model,
        category: input.category,
        quantity: input.quantity,
        unitCost: input.unitCost,
        currency: input.currency,
        totalCost: calculateLineItemTotal(input.quantity, input.unitCost),
        notes: input.notes,
      },
    });
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "factura.line_item_created",
        entity: "factura",
        entityId: factura.id,
        message: `Line item ${lineItem.description} was added to factura ${factura.facturaNumber}.`,
        metadata: JSON.stringify({ facturaLineItemId: lineItem.id, quantity: lineItem.quantity, unitCost: lineItem.unitCost, currency: lineItem.currency }),
      },
    });
    return NextResponse.json({ lineItem }, { status: 201 });
  } catch (error) {
    if (error instanceof ClientInputError) return handleApiError(error);
    return handleApiError(error);
  }
}
