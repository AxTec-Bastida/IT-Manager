import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; lineItemId: string }> };

const schema = z.object({ assetId: z.string().min(1) });

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id, lineItemId } = await context.params;
    const input = schema.parse(await request.json());
    const link = await prisma.facturaLineItemAsset.findFirst({ where: { facturaLineItemId: lineItemId, deviceId: input.assetId, lineItem: { facturaId: id } }, include: { device: true, lineItem: true } });
    if (!link) return jsonError("Linked asset not found on this line item.", 404);
    const valueProfile = await prisma.assetValueProfile.findFirst({ where: { sourceFacturaLineItemAssetId: link.id } });
    if (valueProfile) return jsonError("This asset value profile uses the line item as its source. Edit the value source before unlinking.", 422);
    await prisma.$transaction(async (tx) => {
      await tx.facturaLineItemAsset.delete({ where: { id: link.id } });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.line_item_asset_unlinked",
          entity: "factura",
          entityId: id,
          message: `${link.device.assetTag || link.device.name} was unlinked from factura line item ${link.lineItem.description}.`,
          metadata: JSON.stringify({ facturaLineItemId: lineItemId, assetId: input.assetId }),
        },
      });
    });
    return NextResponse.json({ unlinked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
