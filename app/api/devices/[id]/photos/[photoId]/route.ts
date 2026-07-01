import { unlink } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { normalizePhotoType, uploadStoragePath } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; photoId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id, photoId } = await context.params;
    const body = await request.json();
    const photo = await prisma.assetPhoto.findFirst({ where: { id: photoId, assetId: id }, include: { asset: true } });
    if (!photo) return jsonError("Photo not found.", 404);

    const photoType = body.photoType ? normalizePhotoType(body.photoType) : photo.photoType;
    const makePrimary = body.isPrimary === true;
    if (makePrimary) {
      await prisma.assetPhoto.updateMany({ where: { assetId: id }, data: { isPrimary: false } });
    }

    const updated = await prisma.assetPhoto.update({
      where: { id: photoId },
      data: {
        caption: typeof body.caption === "string" ? body.caption.trim() || null : photo.caption,
        photoType,
        ...(makePrimary ? { isPrimary: true } : {}),
      },
    });

    await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: makePrimary ? "asset.photo_primary_changed" : "asset.photo_updated",
        entity: "device",
        entityId: id,
        message: makePrimary ? `Primary photo changed for ${photo.asset.name}.` : `Photo caption/details updated for ${photo.asset.name}.`,
        metadata: JSON.stringify({ photoId }),
      },
    });

    return NextResponse.json({ photo: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id, photoId } = await context.params;
    const photo = await prisma.assetPhoto.findFirst({ where: { id: photoId, assetId: id }, include: { asset: true } });
    if (!photo) return jsonError("Photo not found.", 404);

    await prisma.assetPhoto.delete({ where: { id: photoId } });
    await unlink(uploadStoragePath("assets", photo.storedFilename)).catch(() => undefined);
    if (photo.thumbnailFilename) await unlink(uploadStoragePath("assets", photo.thumbnailFilename, "thumbs")).catch(() => undefined);

    if (photo.isPrimary) {
      const replacement = await prisma.assetPhoto.findFirst({ where: { assetId: id }, orderBy: { createdAt: "desc" } });
      if (replacement) await prisma.assetPhoto.update({ where: { id: replacement.id }, data: { isPrimary: true } });
    }

    await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "asset.photo_deleted",
        entity: "device",
        entityId: id,
        message: `Photo deleted for ${photo.asset.name}.`,
        metadata: JSON.stringify({ photoId }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
