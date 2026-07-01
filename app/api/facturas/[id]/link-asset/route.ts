import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const { assetId } = await request.json();
    if (!assetId) return jsonError("assetId is required.", 400);

    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) return jsonError("Factura not found.", 404);

    const asset = await prisma.device.findUnique({ where: { id: assetId } });
    if (!asset) return jsonError("Asset not found.", 404);

    await prisma.$transaction([
      prisma.device.update({
        where: { id: assetId },
        data: { facturaId: id },
      }),
      prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.asset_linked",
          entity: "factura",
          entityId: id,
          message: `Asset ${asset.assetTag || asset.name} linked to factura ${factura.facturaNumber}.`,
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
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const { assetId } = await request.json();
    if (!assetId) return jsonError("assetId is required.", 400);

    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) return jsonError("Factura not found.", 404);

    const asset = await prisma.device.findUnique({ where: { id: assetId } });
    if (!asset) return jsonError("Asset not found.", 404);

    const lineItemLink = await prisma.facturaLineItemAsset.findFirst({
      where: { deviceId: assetId, lineItem: { facturaId: id } },
    });
    if (lineItemLink) {
      return jsonError("This asset is linked to a factura line item. Unlink it from the line item section first.", 422);
    }

    await prisma.$transaction([
      prisma.device.update({
        where: { id: assetId },
        data: { facturaId: null },
      }),
      prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.asset_unlinked",
          entity: "factura",
          entityId: id,
          message: `Asset ${asset.assetTag || asset.name} unlinked from factura ${factura.facturaNumber}.`,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
