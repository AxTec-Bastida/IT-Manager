import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetPhotoType } from "@prisma/client";

export const ASSET_UPLOAD_DIR = path.join(process.cwd(), "uploads", "assets");
export const FACTURA_UPLOAD_DIR = path.join(process.cwd(), "uploads", "facturas");

export const MAX_ASSET_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_FACTURA_FILE_BYTES = 15 * 1024 * 1024;

export const assetPhotoMimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export const facturaMimeExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadKind = "asset-photo" | "factura";

export type UploadValidationInput = {
  mimeType: string;
  fileSize: number;
  kind: UploadKind;
};

export function validateUploadFile({ mimeType, fileSize, kind }: UploadValidationInput) {
  const allowed = kind === "asset-photo" ? assetPhotoMimeExtensions : facturaMimeExtensions;
  const maxBytes = kind === "asset-photo" ? MAX_ASSET_PHOTO_BYTES : MAX_FACTURA_FILE_BYTES;
  if (!allowed[mimeType]) {
    return { ok: false as const, message: `Unsupported file type: ${mimeType || "unknown"}.` };
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false as const, message: "Upload file is empty." };
  }
  if (fileSize > maxBytes) {
    return { ok: false as const, message: `Upload is too large. Max size is ${Math.floor(maxBytes / 1024 / 1024)} MB.` };
  }
  return { ok: true as const, extension: allowed[mimeType] };
}

export function generateSafeFilename(mimeType: string, kind: UploadKind, now = new Date()) {
  const validation = validateUploadFile({ mimeType, fileSize: 1, kind });
  if (!validation.ok) throw new Error(validation.message);
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `${datePart}-${randomUUID()}.${validation.extension}`;
}

export function shouldSetPrimaryPhoto(existingPrimaryCount: number, requestedPrimary: boolean) {
  return requestedPrimary || existingPrimaryCount === 0;
}

export function normalizePhotoType(value: unknown): AssetPhotoType {
  const text = String(value || "OTHER").toUpperCase();
  const allowed: AssetPhotoType[] = ["MAIN", "SERIAL_LABEL", "MAC_IP_LABEL", "CONDITION", "DAMAGE", "ACCESSORIES", "RETURN_CONDITION", "OTHER"];
  return allowed.includes(text as AssetPhotoType) ? (text as AssetPhotoType) : "OTHER";
}

export function publicUploadPath(kind: "assets" | "facturas", storedFilename: string) {
  return `/uploads/${kind}/${storedFilename}`;
}

export function uploadStoragePath(kind: "assets" | "facturas", storedFilename: string) {
  const baseDir = kind === "assets" ? ASSET_UPLOAD_DIR : FACTURA_UPLOAD_DIR;
  return path.join(baseDir, storedFilename);
}

export async function saveUploadedFile(file: File, kind: "assets" | "facturas", storedFilename: string) {
  const baseDir = kind === "assets" ? ASSET_UPLOAD_DIR : FACTURA_UPLOAD_DIR;
  await mkdir(baseDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const targetPath = uploadStoragePath(kind, storedFilename);
  if (!targetPath.startsWith(baseDir)) throw new Error("Invalid upload path.");
  await writeFile(targetPath, bytes);
}
