import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { assertCanLinkAssets } from "@/lib/factura-line-items";
import { prisma } from "@/lib/prisma";
import { facturaLineItemLinkAssetsSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; lineItemId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id, lineItemId } = await context.params;
    const input = facturaLineItemLinkAssetsSchema.parse(await request.json());
    const lineItem = await prisma.facturaLineItem.findFirst({ where: { id: lineItemId, facturaId: id }, include: { factura: true, assetLinks: true } });
    if (!lineItem) return jsonError("Factura line item not found.", 404);
    const assetIds = assertCanLinkAssets(lineItem, input.assetIds);
    const assets = await prisma.device.findMany({ where: { id: { in: assetIds } }, select: { id: true, assetTag: true, name: true } });
    if (assets.length !== assetIds.length) return jsonError("One or more selected assets were not found.", 404);
    const existingOtherLinks = await prisma.facturaLineItemAsset.findMany({
      where: { deviceId: { in: assetIds }, facturaLineItemId: { not: lineItem.id } },
      include: { lineItem: { include: { factura: true } }, device: true },
    });
    if (existingOtherLinks.length) {
      return jsonError(`Asset already linked to another factura line item: ${existingOtherLinks.map((link) => link.device.assetTag || link.device.name).join(", ")}.`, 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.facturaLineItemAsset.createMany({
        data: assetIds.map((deviceId) => ({ facturaLineItemId: lineItem.id, deviceId, allocatedUnitCost: lineItem.unitCost, currency: lineItem.currency })),
      });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.line_item_assets_linked",
          entity: "factura",
          entityId: id,
          message: `${assetIds.length} asset(s) were linked to factura line item ${lineItem.description}.`,
          metadata: JSON.stringify({ facturaLineItemId: lineItem.id, assetIds }),
        },
      });
    });
    return NextResponse.json({ linked: assetIds.length });
  } catch (error) {
    return handleApiError(error);
  }
}
