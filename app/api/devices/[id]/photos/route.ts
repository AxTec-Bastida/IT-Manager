import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { generateSafeFilename, generateThumbnailForUpload, normalizePhotoSource, normalizePhotoType, publicUploadPath, saveUploadedFile, shouldSetPrimaryPhoto, validateUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { id } = await context.params;
    const photos = await prisma.assetPhoto.findMany({ where: { assetId: id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] });
    return NextResponse.json({ photos });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const asset = await prisma.device.findUnique({ where: { id } });
    if (!asset) return jsonError("Asset not found.", 404);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("Photo file is required.", 400);

    const validation = validateUploadFile({ kind: "asset-photo", mimeType: file.type, fileSize: file.size });
    if (!validation.ok) return jsonError(validation.message, 400);

    const storedFilename = generateSafeFilename(file.type, "asset-photo");
    await saveUploadedFile(file, "assets", storedFilename);
    const derivative = await generateThumbnailForUpload("assets", storedFilename);

    const existingPrimaryCount = await prisma.assetPhoto.count({ where: { assetId: id, isPrimary: true } });
    const isPrimary = shouldSetPrimaryPhoto(existingPrimaryCount, formData.get("isPrimary") === "on" || formData.get("isPrimary") === "true");
    if (isPrimary) {
      await prisma.assetPhoto.updateMany({ where: { assetId: id }, data: { isPrimary: false } });
    }

    const photo = await prisma.assetPhoto.create({
      data: {
        assetId: id,
        photoType: normalizePhotoType(formData.get("photoType")),
        caption: String(formData.get("caption") || "").trim() || null,
        originalFilename: file.name || null,
        storedFilename,
        filePath: publicUploadPath("assets", storedFilename),
        mimeType: file.type,
        fileSize: file.size,
        sizeBytes: file.size,
        width: derivative.width,
        height: derivative.height,
        thumbnailFilename: derivative.thumbnailFilename,
        thumbnailPath: derivative.thumbnailPath,
        optimizedFilename: storedFilename,
        optimizedPath: publicUploadPath("assets", storedFilename),
        uploadedByUserId: actor.id,
        uploadedByName: actor.name,
        compressionApplied: formData.get("compressionApplied") === "true",
        source: normalizePhotoSource(formData.get("source")),
        isPrimary,
        uploadedBy: String(formData.get("uploadedBy") || "").trim() || null,
      },
    });

    await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "asset.photo_uploaded",
        entity: "device",
        entityId: id,
        message: `Photo uploaded for ${asset.name}.`,
        metadata: JSON.stringify({ photoId: photo.id, photoType: photo.photoType, isPrimary }),
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
