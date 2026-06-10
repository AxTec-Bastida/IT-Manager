import type { AssetPhotoType } from "@prisma/client";

export const MAX_CLIENT_PHOTO_BYTES = 8 * 1024 * 1024;

export type ClientPhotoValidationInput = {
  type?: string;
  size?: number;
};

export function isLocalCameraHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

export function cameraSecurityMessage(input: { isSecureContext: boolean; hostname: string }) {
  if (input.isSecureContext || isLocalCameraHost(input.hostname)) return null;
  return "Phone camera access requires HTTPS. Open this app through HTTPS on the warehouse network, or use the photo/manual fallback below.";
}

export function cameraUnsupportedMessage(hasMediaDevices: boolean) {
  return hasMediaDevices ? null : "Camera access is not available in this browser. Use HTTPS or localhost and allow camera permissions.";
}

export function scanLookupFailureMessage(error?: unknown) {
  if (error instanceof TypeError) return "Server unavailable. Check Wi-Fi/VPN/server and try again.";
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|network|load failed|server unavailable/i.test(message)) {
    return "Server unavailable. Check Wi-Fi/VPN/server and try again.";
  }
  return "Could not look up this scan. Try again, or use manual search.";
}

export function uploadFailureMessage(error?: unknown) {
  if (error instanceof TypeError) return "Upload failed. Photo was not saved. Check Wi-Fi/VPN/server and try again.";
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|network|load failed|server unavailable/i.test(message)) {
    return "Upload failed. Photo was not saved. Check Wi-Fi/VPN/server and try again.";
  }
  return "Upload failed. Photo was not saved.";
}

export function validateClientPhotoFile(file: ClientPhotoValidationInput) {
  if (!file.type || !file.type.startsWith("image/")) {
    return { ok: false as const, message: "Unsupported file type. Use a photo image file." };
  }
  if (!Number.isFinite(file.size) || Number(file.size) <= 0) {
    return { ok: false as const, message: "Photo file is empty." };
  }
  if (Number(file.size) > MAX_CLIENT_PHOTO_BYTES) {
    return { ok: false as const, message: "Photo is too large. Use a smaller image or retake the photo closer to the asset." };
  }
  return { ok: true as const };
}

export function photoCompressionOptions(photoType: AssetPhotoType | string) {
  const labelLikeTypes = new Set(["ASSET_TAG", "SERIAL_LABEL", "MAC_IP_LABEL", "RMA_CONDITION", "RETURN_CONDITION"]);
  return {
    maxWidth: labelLikeTypes.has(String(photoType)) ? 2000 : 1600,
    quality: labelLikeTypes.has(String(photoType)) ? 0.85 : 0.8,
    mimeType: "image/jpeg",
  };
}

export async function resizeImageFile(file: File, photoType: AssetPhotoType | string): Promise<File> {
  const options = photoCompressionOptions(photoType);
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return file;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, options.maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && file.size <= MAX_CLIENT_PHOTO_BYTES * 0.65) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.mimeType, options.quality));
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "asset-photo";
    return new File([blob], `${baseName}.jpg`, { type: options.mimeType, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
