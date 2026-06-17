import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { calculateLineItemTotal } from "@/lib/factura-line-items";
import { prisma } from "@/lib/prisma";
import { facturaLineItemSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; lineItemId: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id, lineItemId } = await context.params;
    const existing = await prisma.facturaLineItem.findFirst({ where: { id: lineItemId, facturaId: id }, include: { factura: true, assetLinks: true } });
    if (!existing) return jsonError("Factura line item not found.", 404);
    const input = facturaLineItemSchema.parse(await request.json());
    if (input.quantity < existing.assetLinks.length) {
      return jsonError(`Quantity cannot be lower than the ${existing.assetLinks.length} linked asset(s).`, 422);
    }
    const lineItem = await prisma.facturaLineItem.update({
      where: { id: existing.id },
      data: {
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
        action: "factura.line_item_updated",
        entity: "factura",
        entityId: id,
        message: `Line item ${lineItem.description} was updated on factura ${existing.factura.facturaNumber}.`,
        metadata: JSON.stringify({ facturaLineItemId: lineItem.id, previousQuantity: existing.quantity, quantity: lineItem.quantity, unitCost: lineItem.unitCost, currency: lineItem.currency }),
      },
    });
    return NextResponse.json({ lineItem });
  } catch (error) {
    return handleApiError(error);
  }
}
