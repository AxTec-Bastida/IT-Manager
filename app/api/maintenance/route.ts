import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { maintenanceRecordSchema } from "@/lib/validation";
import { calculateStockMovement } from "@/lib/stock";
import { defaultNextDueAt, summarizeMaintenanceReview } from "@/lib/maintenance";

function deviceMaintenanceUpdate(maintenanceType: string, performedAt: Date, nextDueAt?: Date | null) {
  return {
    ...(["CLEANING", "CLEAN_PRINTHEAD", "CLEAN_ROLLER"].includes(maintenanceType) ? { lastCleanedAt: performedAt } : {}),
    ...(maintenanceType === "TONER_REPLACEMENT" || maintenanceType === "INK_REPLACEMENT" ? { lastSupplyReplacementAt: performedAt } : {}),
    ...(maintenanceType === "PRINTHEAD_REPLACEMENT" || maintenanceType === "REPLACE_PRINTHEAD" ? { lastPrintheadReplacementAt: performedAt } : {}),
    ...(maintenanceType === "PLATEN_ROLLER_REPLACEMENT" || maintenanceType === "REPLACE_PLATEN_ROLLER" || maintenanceType === "REPLACE_ROLLER" ? { lastPlatenRollerReplacementAt: performedAt } : {}),
    ...(maintenanceType === "CUTTER_REPLACEMENT" ? { lastCutterReplacementAt: performedAt } : {}),
    ...(nextDueAt ? { maintenanceDueAt: nextDueAt } : {}),
  };
}

export async function GET() {
  try {
    await requirePermission("inventory.read");
    const [assets, recent] = await Promise.all([
      prisma.device.findMany({
        where: { category: { in: ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE"] } },
        select: {
          id: true,
          name: true,
          assetTag: true,
          category: true,
          status: true,
          location: true,
          areaDepartment: true,
          maintenanceDueAt: true,
          lastCleanedAt: true,
          cleaningIntervalDays: true,
          maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 10 },
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      prisma.maintenanceRecord.findMany({
        orderBy: { performedAt: "desc" },
        take: 20,
        include: { asset: { select: { id: true, name: true, assetTag: true, category: true } }, stockItem: { select: { id: true, name: true } } },
      }),
    ]);
    return NextResponse.json({ summary: summarizeMaintenanceReview(assets), assets, recent });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const payload = await request.json();
    const parsed = maintenanceRecordSchema.parse(payload);
    const asset = await prisma.device.findUnique({ where: { id: parsed.assetId } });
    if (!asset) return jsonError("Asset not found.", 404);
    const data = {
      ...parsed,
      nextDueAt: parsed.nextDueAt ?? defaultNextDueAt(asset, parsed.performedAt),
      performedBy: parsed.performedBy || actor.name,
    };

    if (data.stockItemId && data.quantityUsed) {
      const stockItem = await prisma.stockItem.findUnique({ where: { id: data.stockItemId } });
      if (!stockItem) return jsonError("Stock item not found.", 404);
      const calculated = calculateStockMovement({
        currentQuantity: stockItem.quantityOnHand,
        movementType: "USED_FOR_REPAIR",
        quantity: data.quantityUsed,
      });

      const [record] = await prisma.$transaction([
        prisma.maintenanceRecord.create({ data }),
        prisma.stockItem.update({ where: { id: stockItem.id }, data: { quantityOnHand: calculated.newQuantity } }),
        prisma.stockMovement.create({
          data: {
            stockItemId: stockItem.id,
            assetId: asset.id,
            movementType: "USED_FOR_REPAIR",
            quantity: calculated.quantity,
            previousQuantity: calculated.previousQuantity,
            newQuantity: calculated.newQuantity,
            reason: data.maintenanceType,
            notes: data.notes,
            performedBy: data.performedBy,
          },
        }),
        prisma.device.update({ where: { id: asset.id }, data: deviceMaintenanceUpdate(data.maintenanceType, data.performedAt, data.nextDueAt) }),
        prisma.activityLog.create({
          data: {
            ...makeActivityActor(actor),
            action: "maintenance.created",
            entity: "device",
            entityId: asset.id,
            message: `${data.maintenanceType.replaceAll("_", " ")} recorded for ${asset.name}; used ${calculated.quantity} ${stockItem.name}.`,
          },
        }),
      ]);
      return NextResponse.json({ record }, { status: 201 });
    }

    const [record] = await prisma.$transaction([
      prisma.maintenanceRecord.create({ data }),
      prisma.device.update({ where: { id: asset.id }, data: deviceMaintenanceUpdate(data.maintenanceType, data.performedAt, data.nextDueAt) }),
      prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "maintenance.created",
          entity: "device",
          entityId: asset.id,
          message: `${data.maintenanceType.replaceAll("_", " ")} recorded for ${asset.name}.`,
        },
      }),
    ]);

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
