import type { StockMovementType } from "@prisma/client";
import { ClientInputError } from "@/lib/api";

export type StockQuantityInput = {
  currentQuantity: number;
  movementType: StockMovementType;
  quantity: number;
  adjustmentTarget?: number | null;
};

export type StockMovementResult = {
  previousQuantity: number;
  newQuantity: number;
  quantity: number;
};

export function calculateStockMovement(input: StockQuantityInput): StockMovementResult {
  const previousQuantity = input.currentQuantity;
  const quantity = Math.trunc(input.quantity);
  if (!Number.isFinite(previousQuantity) || previousQuantity < 0) throw new ClientInputError("Current quantity must be zero or higher.");
  
  // For adjustments/physical counts, quantity can be calculated from delta, but target check is primary
  const isAdjustment = ["ADJUST", "PHYSICAL_COUNT", "ADJUSTMENT"].includes(input.movementType);
  if (!isAdjustment && (!Number.isFinite(quantity) || quantity <= 0)) {
    throw new ClientInputError("Quantity must be greater than zero.");
  }

  let newQuantity = previousQuantity;
  if (isAdjustment) {
    newQuantity = Math.trunc(input.adjustmentTarget ?? previousQuantity);
  } else if (["ADD", "RETURNED_TO_STOCK", "RECEIVE", "RESTOCK", "RETURN"].includes(input.movementType)) {
    newQuantity = previousQuantity + quantity;
  } else {
    newQuantity = previousQuantity - quantity;
  }

  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    throw new ClientInputError("Stock quantity cannot go below zero.");
  }

  // Calculate actual change for history display
  const calculatedQuantity = isAdjustment ? Math.abs(newQuantity - previousQuantity) : quantity;

  return { previousQuantity, newQuantity, quantity: calculatedQuantity };
}

export function isLowStock(quantityOnHand: number, minimumQuantity: number) {
  return quantityOnHand <= minimumQuantity;
}

export function stockMovementAction(type: StockMovementType) {
  if (["ADD", "RETURNED_TO_STOCK", "RECEIVE", "RESTOCK", "RETURN"].includes(type)) return "increased";
  if (["ADJUST", "PHYSICAL_COUNT", "ADJUSTMENT"].includes(type)) return "adjusted";
  return "decreased";
}

