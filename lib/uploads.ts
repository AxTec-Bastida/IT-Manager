import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetPhotoType, PhotoSource } from "@prisma/client";

export const ASSET_UPLOAD_DIR = path.join(process.cwd(), "uploads", "assets");
export const FACTURA_UPLOAD_DIR = path.join(process.cwd(), "uploads", "facturas");
export const STOCK_UPLOAD_DIR = path.join(process.cwd(), "uploads", "stock");
export const MAP_UPLOAD_DIR = path.join(process.cwd(), "uploads", "maps");
export const THUMBNAIL_DIR_NAME = "thumbs";

export const MAX_ASSET_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_FACTURA_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_MAP_FILE_BYTES = 12 * 1024 * 1024;

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

export const stockPhotoMimeExtensions = assetPhotoMimeExtensions;

export const mapMimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export type UploadKind = "asset-photo" | "stock-photo" | "factura" | "map";
export type UploadFolderKind = "assets" | "stock" | "facturas" | "maps";

export type UploadValidationInput = {
  mimeType: string;
  fileSize: number;
  kind: UploadKind;
};

export function validateUploadFile({ mimeType, fileSize, kind }: UploadValidationInput) {
  const allowed = kind === "factura" ? facturaMimeExtensions : kind === "stock-photo" ? stockPhotoMimeExtensions : kind === "map" ? mapMimeExtensions : assetPhotoMimeExtensions;
  const maxBytes = kind === "factura" ? MAX_FACTURA_FILE_BYTES : kind === "map" ? MAX_MAP_FILE_BYTES : MAX_ASSET_PHOTO_BYTES;
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

export function validateMapFileBytes(mimeType: string, bytes: Buffer) {
  const validation = validateUploadFile({ mimeType, fileSize: bytes.byteLength, kind: "map" });
  if (!validation.ok) return validation;
  if (mimeType !== "image/svg+xml") return validation;
  const svg = bytes.toString("utf8").toLowerCase();
  if (svg.includes("<script") || svg.includes("<foreignobject") || /\son[a-z]+\s*=/.test(svg)) {
    return { ok: false as const, message: "SVG map contains script-like content and was rejected." };
  }
  if (/(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|javascript:|data:)/i.test(svg)) {
    return { ok: false as const, message: "SVG map contains external or unsafe references and was rejected." };
  }
  return validation;
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
  const allowed: AssetPhotoType[] = [
    "MAIN",
    "OVERVIEW",
    "ASSET_TAG",
    "SERIAL_LABEL",
    "MAC_IP_LABEL",
    "CONDITION",
    "DAMAGE",
    "ACCESSORIES",
    "LOCATION_INSTALLED",
    "FACTURA_EVIDENCE",
    "RMA_CONDITION",
    "RETURN_CONDITION",
    "OTHER",
  ];
  return allowed.includes(text as AssetPhotoType) ? (text as AssetPhotoType) : "OTHER";
}

export function normalizePhotoSource(value: unknown): PhotoSource {
  const text = String(value || "UNKNOWN").toUpperCase();
  const allowed: PhotoSource[] = ["CAMERA", "GALLERY", "IMPORT", "UNKNOWN"];
  return allowed.includes(text as PhotoSource) ? (text as PhotoSource) : "UNKNOWN";
}

export function publicUploadPath(kind: UploadFolderKind, storedFilename: string) {
  return `/uploads/${kind}/${storedFilename}`;
}

export function publicUploadThumbnailPath(kind: "assets" | "stock", storedFilename: string) {
  return `/uploads/${kind}/${THUMBNAIL_DIR_NAME}/${storedFilename}`;
}

export function isSafeUploadFilename(storedFilename: string) {
  if (!storedFilename || storedFilename !== path.basename(storedFilename)) return false;
  if (storedFilename.includes("/") || storedFilename.includes("\\") || storedFilename.includes("..")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(storedFilename);
}

export function uploadStoragePath(kind: UploadFolderKind, storedFilename: string, subfolder?: typeof THUMBNAIL_DIR_NAME) {
  if (!isSafeUploadFilename(storedFilename)) throw new Error("Invalid upload filename.");
  const baseDir = kind === "assets" ? ASSET_UPLOAD_DIR : kind === "stock" ? STOCK_UPLOAD_DIR : kind === "maps" ? MAP_UPLOAD_DIR : FACTURA_UPLOAD_DIR;
  const resolvedBase = path.resolve(baseDir);
  const resolvedParent = subfolder === THUMBNAIL_DIR_NAME ? path.resolve(resolvedBase, THUMBNAIL_DIR_NAME) : resolvedBase;
  const resolvedTarget = path.resolve(resolvedParent, storedFilename);
  if (resolvedTarget !== path.join(resolvedParent, path.basename(storedFilename))) throw new Error("Invalid upload path.");
  return resolvedTarget;
}

export function uploadContentType(mimeType: string | null | undefined, storedFilename: string, kind: UploadFolderKind) {
  const allowed = kind === "facturas" ? facturaMimeExtensions : kind === "stock" ? stockPhotoMimeExtensions : kind === "maps" ? mapMimeExtensions : assetPhotoMimeExtensions;
  if (mimeType && allowed[mimeType]) return mimeType;
  const extension = path.extname(storedFilename).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (kind === "maps" && extension === ".svg") return "image/svg+xml";
  if (kind === "facturas" && extension === ".pdf") return "application/pdf";
  return null;
}

export async function readUploadFile(kind: UploadFolderKind, storedFilename: string, subfolder?: typeof THUMBNAIL_DIR_NAME) {
  if (!isSafeUploadFilename(storedFilename)) return null;
  const filePath = uploadStoragePath(kind, storedFilename, subfolder);
  return readFile(filePath).catch(() => null);
}

export function uploadContentDisposition(originalFilename: string | null | undefined, storedFilename: string) {
  const safeName = path.basename(originalFilename || storedFilename).replace(/["\r\n]/g, "");
  return `inline; filename="${safeName || storedFilename}"`;
}

export async function saveUploadedFile(file: File, kind: UploadFolderKind, storedFilename: string) {
  const baseDir = kind === "assets" ? ASSET_UPLOAD_DIR : kind === "stock" ? STOCK_UPLOAD_DIR : kind === "maps" ? MAP_UPLOAD_DIR : FACTURA_UPLOAD_DIR;
  await mkdir(baseDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const targetPath = uploadStoragePath(kind, storedFilename);
  await writeFile(targetPath, bytes);
}

export type ImageDerivativeResult = {
  width: number | null;
  height: number | null;
  thumbnailFilename: string | null;
  thumbnailPath: string | null;
};

export async function generateThumbnailForUpload(kind: "assets" | "stock", storedFilename: string, maxWidth = 400): Promise<ImageDerivativeResult> {
  const sourcePath = uploadStoragePath(kind, storedFilename);
  const result: ImageDerivativeResult = { width: null, height: null, thumbnailFilename: null, thumbnailPath: null };
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    const source = sharp(sourcePath, { failOn: "none" });
    const metadata = await source.metadata();
    result.width = metadata.width ?? null;
    result.height = metadata.height ?? null;

    const thumbnailFilename = storedFilename.replace(/\.[^.]+$/, "") + "-thumb.jpg";
    const thumbnailDiskPath = uploadStoragePath(kind, thumbnailFilename, THUMBNAIL_DIR_NAME);
    await mkdir(path.dirname(thumbnailDiskPath), { recursive: true });
    await sharp(sourcePath, { failOn: "none" })
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(thumbnailDiskPath);
    result.thumbnailFilename = thumbnailFilename;
    result.thumbnailPath = publicUploadThumbnailPath(kind, thumbnailFilename);
  } catch {
    return result;
  }
  return result;
}

export async function fileSizeIfExists(kind: UploadFolderKind, storedFilename: string, subfolder?: typeof THUMBNAIL_DIR_NAME) {
  try {
    return (await stat(uploadStoragePath(kind, storedFilename, subfolder))).size;
  } catch {
    return 0;
  }
}
