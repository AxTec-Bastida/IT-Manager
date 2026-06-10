import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { generateSafeFilename, generateThumbnailForUpload, normalizePhotoSource, publicUploadPath, saveUploadedFile, validateUploadFile } from "@/lib/uploads";
import type { StockItemPhotoType } from "@prisma/client";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const allowedStockPhotoTypes: StockItemPhotoType[] = ["OVERVIEW", "PACKAGING", "SKU_LABEL", "STORAGE_LOCATION", "OTHER"];

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("stock.write");
    const { id } = await context.params;
    const photos = await prisma.stockItemPhoto.findMany({ where: { stockItemId: id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ photos });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("stock.write");
    const { id } = await context.params;
    const stockItem = await prisma.stockItem.findUnique({ where: { id } });
    if (!stockItem) return jsonError("Stock item not found.", 404);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("Photo file is required.", 400);
    const validation = validateUploadFile({ kind: "stock-photo", mimeType: file.type, fileSize: file.size });
    if (!validation.ok) return jsonError(validation.message, 400);

    const storedFilename = generateSafeFilename(file.type, "stock-photo");
    await saveUploadedFile(file, "stock", storedFilename);
    const derivative = await generateThumbnailForUpload("stock", storedFilename);
    const photoType = normalizeStockPhotoType(formData.get("photoType"));

    const photo = await prisma.stockItemPhoto.create({
      data: {
        stockItemId: id,
        photoType,
        caption: String(formData.get("caption") || "").trim() || null,
        originalFilename: file.name || null,
        storedFilename,
        filePath: publicUploadPath("stock", storedFilename),
        mimeType: file.type,
        sizeBytes: file.size,
        width: derivative.width,
        height: derivative.height,
        thumbnailFilename: derivative.thumbnailFilename,
        thumbnailPath: derivative.thumbnailPath,
        uploadedByUserId: actor.id,
        uploadedByName: actor.name,
        source: normalizePhotoSource(formData.get("source")),
      },
    });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "stock.photo_uploaded",
        entity: "StockItem",
        entityId: id,
        message: `Photo uploaded for stock item ${stockItem.name}.`,
        metadata: JSON.stringify({ photoId: photo.id, photoType }),
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function normalizeStockPhotoType(value: unknown): StockItemPhotoType {
  const text = String(value || "OTHER").toUpperCase();
  return allowedStockPhotoTypes.includes(text as StockItemPhotoType) ? (text as StockItemPhotoType) : "OTHER";
}
