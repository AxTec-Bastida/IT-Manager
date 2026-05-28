import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { stockMovementSchema } from "@/lib/validation";
import { calculateStockMovement, stockMovementAction } from "@/lib/stock";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const data = stockMovementSchema.parse(payload);
    const stockItem = await prisma.stockItem.findUnique({ where: { id } });
    if (!stockItem) return jsonError("Stock item not found.", 404);

    const calculated = calculateStockMovement({
      currentQuantity: stockItem.quantityOnHand,
      movementType: data.movementType,
      quantity: data.quantity,
      adjustmentTarget: data.adjustmentTarget,
    });

    const [updatedStockItem, movement] = await prisma.$transaction([
      prisma.stockItem.update({ where: { id }, data: { quantityOnHand: calculated.newQuantity } }),
      prisma.stockMovement.create({
        data: {
          stockItemId: id,
          movementType: data.movementType,
          quantity: calculated.quantity,
          previousQuantity: calculated.previousQuantity,
          newQuantity: calculated.newQuantity,
          assetId: data.assetId,
          employeeId: data.employeeId,
          reason: data.reason,
          notes: data.notes,
          performedBy: data.performedBy,
          facturaId: data.facturaId,
        },
      }),
      prisma.activityLog.create({
        data: {
          action: "stock.quantity_changed",
          entity: "stock",
          entityId: id,
          message: `${stockItem.name} quantity ${stockMovementAction(data.movementType)} from ${calculated.previousQuantity} to ${calculated.newQuantity}.`,
          metadata: JSON.stringify({ movementType: data.movementType, quantity: calculated.quantity }),
        },
      }),
    ]);

    return NextResponse.json({ stockItem: updatedStockItem, movement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
