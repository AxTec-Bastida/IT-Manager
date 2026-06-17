import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { applyLineItemValues } from "@/lib/factura-line-items";
import { prisma } from "@/lib/prisma";
import { facturaLineItemApplyValuesSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; lineItemId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id, lineItemId } = await context.params;
    const input = facturaLineItemApplyValuesSchema.parse(await request.json());
    const lineItem = await prisma.facturaLineItem.findFirst({
      where: { id: lineItemId, facturaId: id },
      include: {
        factura: true,
        assetLinks: { include: { device: { include: { valueProfile: true } } } },
      },
    });
    if (!lineItem) return jsonError("Factura line item not found.", 404);
    if (!lineItem.assetLinks.length) return jsonError("Link at least one asset before applying values.", 422);
    const result = await prisma.$transaction((tx) => applyLineItemValues(tx, lineItem, { overwriteExisting: input.overwriteExisting, actor: makeActivityActor(actor) }));
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "factura.line_item_values_applied",
        entity: "factura",
        entityId: id,
        message: `Values were applied from line item ${lineItem.description}.`,
        metadata: JSON.stringify({ facturaLineItemId: lineItem.id, ...result, overwriteExisting: input.overwriteExisting }),
      },
    });
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
