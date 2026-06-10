import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string; photoId: string }> };

export async function POST(_request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id, photoId } = await context.params;
    const photo = await prisma.assetPhoto.findFirst({ where: { id: photoId, assetId: id }, include: { asset: true } });
    if (!photo) return jsonError("Photo not found.", 404);
    await prisma.$transaction([
      prisma.assetPhoto.updateMany({ where: { assetId: id }, data: { isPrimary: false } }),
      prisma.assetPhoto.update({ where: { id: photoId }, data: { isPrimary: true } }),
      prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "asset.photo_primary_changed",
          entity: "device",
          entityId: id,
          message: `Primary photo changed for ${photo.asset.name}.`,
          metadata: JSON.stringify({ photoId }),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
