import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";
import {
  cameraSecurityMessage,
  cameraUnsupportedMessage,
  photoCompressionOptions,
  scanLookupFailureMessage,
  uploadFailureMessage,
  validateClientPhotoFile,
} from "@/lib/camera";

describe("phase 42 PWA metadata", () => {
  it("exposes an installable Warehouse IT manifest", () => {
    const data = manifest();
    expect(data.name).toBe("Warehouse IT Inventory");
    expect(data.short_name).toBe("Warehouse IT");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/dashboard");
    expect(data.icons?.some((icon) => icon.src === "/icons/warehouse-it-icon-192.png" && icon.sizes === "192x192")).toBe(true);
    expect(data.icons?.some((icon) => icon.src === "/icons/warehouse-it-icon-512.png" && icon.sizes === "512x512")).toBe(true);
    expect(data.icons?.some((icon) => icon.src === "/icons/warehouse-it-icon.svg")).toBe(true);
  });

  it("declares app manifest and mobile viewport metadata in the root layout", async () => {
    const source = await readFile(path.join(process.cwd(), "app/layout.tsx"), "utf8");
    const proxySource = await readFile(path.join(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain('manifest: "/manifest.webmanifest"');
    expect(source).toContain("appleWebApp");
    expect(source).toContain("warehouse-it-icon-192.png");
    expect(source).toContain("viewportFit");
    expect(source).toContain('themeColor: "#0f172a"');
    expect(proxySource).toContain('"/manifest.webmanifest"');
    expect(proxySource).toContain('"/icons"');
  });
});

describe("phase 42 camera helpers", () => {
  it("returns clear HTTPS and unsupported-camera messages", () => {
    expect(cameraSecurityMessage({ isSecureContext: false, hostname: "warehouse-server" })).toContain("requires HTTPS");
    expect(cameraSecurityMessage({ isSecureContext: false, hostname: "localhost" })).toBeNull();
    expect(cameraUnsupportedMessage(false)).toContain("not available");
    expect(cameraUnsupportedMessage(true)).toBeNull();
  });

  it("validates client photo files before upload", () => {
    expect(validateClientPhotoFile({ type: "image/jpeg", size: 200_000 }).ok).toBe(true);
    expect(validateClientPhotoFile({ type: "application/pdf", size: 200_000 }).ok).toBe(false);
    expect(validateClientPhotoFile({ type: "image/png", size: 10 * 1024 * 1024 }).ok).toBe(false);
  });

  it("uses higher resolution for label photos than overview photos", () => {
    expect(photoCompressionOptions("SERIAL_LABEL").maxWidth).toBe(2000);
    expect(photoCompressionOptions("ASSET_TAG").quality).toBeGreaterThan(photoCompressionOptions("OVERVIEW").quality);
    expect(photoCompressionOptions("OVERVIEW").maxWidth).toBe(1600);
  });

  it("maps network failures to warehouse-friendly messages", () => {
    expect(scanLookupFailureMessage(new TypeError("fetch failed"))).toContain("Server unavailable");
    expect(uploadFailureMessage(new TypeError("fetch failed"))).toContain("Photo was not saved");
  });
});

describe("phase 42 scanner and photo UI contracts", () => {
  it("stops the live scanner immediately on detection", async () => {
    const source = await readFile(path.join(process.cwd(), "components/camera-scanner.tsx"), "utf8");
    expect(source).toContain("controlsRef.current?.stop();");
    expect(source).toContain("track.stop()");
  });

  it("integrates shared camera capture and upload progress in asset photos", async () => {
    const source = await readFile(path.join(process.cwd(), "components/asset-photo-panel.tsx"), "utf8");
    expect(source).toContain("<CameraCapture");
    expect(source).toContain("uploadPhotoWithProgress");
    expect(source).toContain("Photo ready");
    expect(source).toContain("uploadFailureMessage");
  });
});
