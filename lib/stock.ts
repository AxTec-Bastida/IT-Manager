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
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ClientInputError("Quantity must be greater than zero.");

  const newQuantity =
    input.movementType === "ADJUST"
      ? Math.trunc(input.adjustmentTarget ?? quantity)
      : ["ADD", "RETURNED_TO_STOCK"].includes(input.movementType)
        ? previousQuantity + quantity
        : previousQuantity - quantity;

  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    throw new ClientInputError("Stock quantity cannot go below zero.");
  }

  return { previousQuantity, newQuantity, quantity };
}

export function isLowStock(quantityOnHand: number, minimumQuantity: number) {
  return quantityOnHand <= minimumQuantity;
}

export function stockMovementAction(type: StockMovementType) {
  if (type === "ADD" || type === "RETURNED_TO_STOCK") return "increased";
  if (type === "ADJUST") return "adjusted";
  return "decreased";
}
