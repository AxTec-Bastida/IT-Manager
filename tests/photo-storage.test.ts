import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPhotoChecklist } from "@/lib/photo-compliance";
import { ASSET_UPLOAD_DIR, STOCK_UPLOAD_DIR, THUMBNAIL_DIR_NAME } from "@/lib/uploads";
import { applyThumbnailBackfill, buildThumbnailBackfillPlan, RECOMMENDED_PHOTO_BYTES, summarizePhotoStorage } from "@/lib/photo-storage";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((filePath) => rm(filePath, { force: true })));
});

describe("photo compliance and storage helpers", () => {
  it("requires location-installed photos for fixed assets without blocking normal serialized assets", () => {
    const laptop = buildPhotoChecklist({
      category: "LAPTOP",
      photos: [{ photoType: "OVERVIEW" }, { photoType: "ASSET_TAG" }, { photoType: "SERIAL_LABEL" }, { photoType: "CONDITION" }],
    });
    const scale = buildPhotoChecklist({
      category: "SCALE",
      isFixedAsset: true,
      photos: [{ photoType: "OVERVIEW" }, { photoType: "ASSET_TAG" }, { photoType: "SERIAL_LABEL" }, { photoType: "CONDITION" }],
    });

    expect(laptop.missing).toEqual([]);
    expect(scale.missing).toEqual(["LOCATION_INSTALLED"]);
  });

  it("summarizes thumbnail gaps, oversized photos, and stock photos", () => {
    const summary = summarizePhotoStorage({
      assetPhotos: [
        {
          id: "asset-photo-1",
          filePath: "/uploads/assets/full.jpg",
          storedFilename: "full.jpg",
          thumbnailPath: "/uploads/assets/thumbs/full-thumb.jpg",
          fileSize: 500_000,
          mimeType: "image/jpeg",
        },
        {
          id: "asset-photo-2",
          filePath: "/uploads/assets/large.jpg",
          storedFilename: "large.jpg",
          fileSize: RECOMMENDED_PHOTO_BYTES + 1,
          mimeType: "image/jpeg",
        },
      ],
      stockPhotos: [
        {
          id: "stock-photo-1",
          filePath: "/uploads/stock/packaging.jpg",
          storedFilename: "packaging.jpg",
          sizeBytes: 100_000,
          mimeType: "image/jpeg",
        },
      ],
      facturaFileSizes: [200_000],
      thumbnailSizes: [20_000],
    });

    expect(summary.assetPhotoCount).toBe(2);
    expect(summary.stockPhotoCount).toBe(1);
    expect(summary.thumbnailStorageBytes).toBe(20_000);
    expect(summary.oversizedPhotos.map((photo) => photo.id)).toEqual(["asset-photo-2"]);
    expect(summary.missingThumbnails.map((photo) => photo.id)).toEqual(["asset-photo-2", "stock-photo-1"]);
  });

  it("dry-run detects asset and stock photos that need thumbnail backfill", async () => {
    await writeFixture(ASSET_UPLOAD_DIR, "phase45-asset-dryrun.jpg");
    await writeFixture(STOCK_UPLOAD_DIR, "phase45-stock-dryrun.jpg");
    const prisma = createPrismaMock({
      assetPhotos: [assetPhoto({ id: "asset-dryrun", storedFilename: "phase45-asset-dryrun.jpg" })],
      stockPhotos: [stockPhoto({ id: "stock-dryrun", storedFilename: "phase45-stock-dryrun.jpg" })],
    });

    const plan = await buildThumbnailBackfillPlan(prisma);

    expect(plan.candidates.map((photo) => photo.id)).toEqual(["asset-dryrun", "stock-dryrun"]);
    expect(plan.missingOriginals).toEqual([]);
    expect(prisma.assetPhoto.update).not.toHaveBeenCalled();
    expect(prisma.stockItemPhoto.update).not.toHaveBeenCalled();
  });

  it("dry-run reports missing originals without creating candidates", async () => {
    const prisma = createPrismaMock({
      assetPhotos: [assetPhoto({ id: "asset-missing", storedFilename: "phase45-missing-original.jpg" })],
    });

    const plan = await buildThumbnailBackfillPlan(prisma);

    expect(plan.missingOriginals.map((photo) => photo.id)).toEqual(["asset-missing"]);
    expect(plan.candidates).toEqual([]);
  });

  it("apply requires explicit confirmation", async () => {
    await expect(applyThumbnailBackfill(createPrismaMock(), { confirmed: false })).rejects.toThrow(/requires confirmation/i);
  });

  it("apply creates a missing asset thumbnail and updates metadata only", async () => {
    await writeFixture(ASSET_UPLOAD_DIR, "phase45-asset-apply.jpg");
    const prisma = createPrismaMock({
      assetPhotos: [assetPhoto({ id: "asset-apply", storedFilename: "phase45-asset-apply.jpg", sizeBytes: 118 })],
    });

    const result = await applyThumbnailBackfill(prisma, { confirmed: true, limit: 1 });

    expect(result.created).toBe(1);
    expect(prisma.assetPhoto.update).toHaveBeenCalledWith({
      where: { id: "asset-apply" },
      data: expect.objectContaining({
        thumbnailFilename: "phase45-asset-apply-thumb.jpg",
        thumbnailPath: "/uploads/assets/thumbs/phase45-asset-apply-thumb.jpg",
        width: expect.any(Number),
        height: expect.any(Number),
        sizeBytes: 118,
      }),
    });
    track(path.join(ASSET_UPLOAD_DIR, THUMBNAIL_DIR_NAME, "phase45-asset-apply-thumb.jpg"));
  });

  it("apply does not rewrite already-ready thumbnail records by default", async () => {
    await writeFixture(ASSET_UPLOAD_DIR, "phase45-ready.jpg");
    await writeFixture(path.join(ASSET_UPLOAD_DIR, THUMBNAIL_DIR_NAME), "phase45-ready-thumb.jpg");
    const prisma = createPrismaMock({
      assetPhotos: [
        assetPhoto({
          id: "asset-ready",
          storedFilename: "phase45-ready.jpg",
          thumbnailFilename: "phase45-ready-thumb.jpg",
          thumbnailPath: "/uploads/assets/thumbs/phase45-ready-thumb.jpg",
        }),
      ],
    });

    const result = await applyThumbnailBackfill(prisma, { confirmed: true, limit: 1 });

    expect(result.attempted).toBe(0);
    expect(result.created).toBe(0);
    expect(prisma.assetPhoto.update).not.toHaveBeenCalled();
  });

  it("skips unsupported files instead of trying to thumbnail them", async () => {
    await writeRawFixture(ASSET_UPLOAD_DIR, "phase45-photo-note.pdf", "%PDF-1.4\n");
    const prisma = createPrismaMock({
      assetPhotos: [assetPhoto({ id: "asset-pdf", storedFilename: "phase45-photo-note.pdf", mimeType: "application/pdf" })],
    });

    const plan = await buildThumbnailBackfillPlan(prisma);
    const result = await applyThumbnailBackfill(prisma, { confirmed: true });

    expect(plan.unsupportedPhotos.map((photo) => photo.id)).toEqual(["asset-pdf"]);
    expect(result.attempted).toBe(0);
    expect(prisma.assetPhoto.update).not.toHaveBeenCalled();
  });
});

async function writeFixture(folder: string, filename: string) {
  await mkdir(folder, { recursive: true });
  const filePath = path.join(folder, filename);
  await sharp({ create: { width: 16, height: 12, channels: 3, background: "#2563eb" } }).jpeg().toFile(filePath);
  track(filePath);
}

async function writeRawFixture(folder: string, filename: string, content: string) {
  await mkdir(folder, { recursive: true });
  const filePath = path.join(folder, filename);
  await writeFile(filePath, content);
  track(filePath);
}

function track(filePath: string) {
  cleanupPaths.push(filePath);
}

function createPrismaMock({ assetPhotos = [], stockPhotos = [] }: { assetPhotos?: unknown[]; stockPhotos?: unknown[] } = {}) {
  const mock = {
    assetPhoto: {
      findMany: vi.fn().mockResolvedValue(assetPhotos),
      update: vi.fn().mockResolvedValue({}),
    },
    stockItemPhoto: {
      findMany: vi.fn().mockResolvedValue(stockPhotos),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return mock as unknown as PrismaClient & typeof mock;
}

function assetPhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-photo",
    storedFilename: "phase45-asset.jpg",
    thumbnailFilename: null,
    thumbnailPath: null,
    mimeType: "image/jpeg",
    fileSize: 100,
    sizeBytes: 100,
    asset: { id: "device-1", name: "Test Asset", assetTag: "QA-ASSET-1" },
    ...overrides,
  };
}

function stockPhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: "stock-photo",
    storedFilename: "phase45-stock.jpg",
    thumbnailFilename: null,
    thumbnailPath: null,
    mimeType: "image/jpeg",
    sizeBytes: 100,
    stockItem: { id: "stock-1", name: "Test Stock", sku: "QA-STOCK-1" },
    ...overrides,
  };
}
