import type { PrismaClient } from "@prisma/client";
import { makeActivityActor, type AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateSafeFilename,
  generateThumbnailForUpload,
  normalizePhotoSource,
  normalizePhotoType,
  publicUploadPath,
  saveUploadedFile,
  shouldSetPrimaryPhoto,
  validateUploadFile,
} from "@/lib/uploads";

export type AssetPhotoUploadInput = {
  assetId: string;
  file: File;
  actor: AuthUser;
  photoType?: unknown;
  caption?: unknown;
  source?: unknown;
  compressionApplied?: unknown;
  isPrimary?: unknown;
  uploadedBy?: unknown;
  clientActionId?: string | null;
  offlineSync?: boolean;
  client?: PrismaClient;
};

export async function createAssetPhotoUpload(input: AssetPhotoUploadInput) {
  const client = input.client ?? prisma;
  const asset = await client.device.findUnique({ where: { id: input.assetId } });
  if (!asset) return { ok: false as const, status: 404, message: "Asset not found." };

  const validation = validateUploadFile({ kind: "asset-photo", mimeType: input.file.type, fileSize: input.file.size });
  if (!validation.ok) return { ok: false as const, status: 400, message: validation.message };

  const storedFilename = generateSafeFilename(input.file.type, "asset-photo");
  await saveUploadedFile(input.file, "assets", storedFilename);
  const derivative = await generateThumbnailForUpload("assets", storedFilename);

  const existingPrimaryCount = await client.assetPhoto.count({ where: { assetId: input.assetId, isPrimary: true } });
  const requestedPrimary = input.isPrimary === "on" || input.isPrimary === "true" || input.isPrimary === true;
  const isPrimary = shouldSetPrimaryPhoto(existingPrimaryCount, requestedPrimary);
  if (isPrimary) {
    await client.assetPhoto.updateMany({ where: { assetId: input.assetId }, data: { isPrimary: false } });
  }

  const caption = typeof input.caption === "string" ? input.caption.trim() : "";
  const uploadedBy = typeof input.uploadedBy === "string" ? input.uploadedBy.trim() : "";
  const photo = await client.assetPhoto.create({
    data: {
      assetId: input.assetId,
      photoType: normalizePhotoType(input.photoType),
      caption: caption || null,
      originalFilename: input.file.name || null,
      storedFilename,
      filePath: publicUploadPath("assets", storedFilename),
      mimeType: input.file.type,
      fileSize: input.file.size,
      sizeBytes: input.file.size,
      width: derivative.width,
      height: derivative.height,
      thumbnailFilename: derivative.thumbnailFilename,
      thumbnailPath: derivative.thumbnailPath,
      optimizedFilename: storedFilename,
      optimizedPath: publicUploadPath("assets", storedFilename),
      uploadedByUserId: input.actor.id,
      uploadedByName: input.actor.name,
      compressionApplied: input.compressionApplied === "true" || input.compressionApplied === true,
      source: normalizePhotoSource(input.source),
      isPrimary,
      uploadedBy: uploadedBy || null,
    },
  });

  await client.activityLog.create({
    data: {
      ...makeActivityActor(input.actor),
      action: input.offlineSync ? "asset.photo_uploaded_offline_sync" : "asset.photo_uploaded",
      entity: "device",
      entityId: input.assetId,
      message: input.offlineSync ? `Offline photo uploaded for ${asset.name}.` : `Photo uploaded for ${asset.name}.`,
      metadata: JSON.stringify({
        photoId: photo.id,
        photoType: photo.photoType,
        isPrimary,
        offlineSync: Boolean(input.offlineSync),
        clientActionId: input.clientActionId ?? null,
      }),
    },
  });

  return { ok: true as const, asset, photo, isPrimary };
}
