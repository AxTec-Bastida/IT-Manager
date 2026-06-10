import type { PrismaClient } from "@prisma/client";
import { fileSizeIfExists, generateThumbnailForUpload, readUploadFile } from "@/lib/uploads";

export const RECOMMENDED_PHOTO_BYTES = 2.5 * 1024 * 1024;
export const DEFAULT_THUMBNAIL_BACKFILL_LIMIT = 100;

type AssetPhotoSummaryInput = {
  id: string;
  filePath: string;
  storedFilename: string;
  thumbnailFilename?: string | null;
  thumbnailPath?: string | null;
  fileSize?: number | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  asset?: { id: string; name: string; assetTag: string | null } | null;
};

type StockPhotoSummaryInput = {
  id: string;
  filePath: string;
  storedFilename: string;
  thumbnailFilename?: string | null;
  thumbnailPath?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  stockItem?: { id: string; name: string; sku: string | null } | null;
};

export type ThumbnailBackfillKind = "asset" | "stock";

export type ThumbnailBackfillPhoto = {
  kind: ThumbnailBackfillKind;
  id: string;
  ownerId: string;
  ownerLabel: string;
  storedFilename: string;
  thumbnailFilename?: string | null;
  thumbnailPath?: string | null;
  mimeType?: string | null;
  sizeBytes: number;
};

export type ThumbnailBackfillCandidate = ThumbnailBackfillPhoto & {
  missingThumbnailMetadata: boolean;
  thumbnailFileMissing: boolean;
};

export type ThumbnailBackfillPlan = {
  generatedAt: string;
  totalPhotos: number;
  assetPhotoCount: number;
  stockPhotoCount: number;
  candidates: ThumbnailBackfillCandidate[];
  missingOriginals: ThumbnailBackfillPhoto[];
  oversizedPhotos: ThumbnailBackfillPhoto[];
  unsupportedPhotos: ThumbnailBackfillPhoto[];
  alreadyReady: ThumbnailBackfillPhoto[];
  estimatedOutputThumbnailCount: number;
};

export type ThumbnailBackfillApplyResult = {
  plan: ThumbnailBackfillPlan;
  attempted: number;
  created: number;
  skipped: number;
  failed: Array<{ id: string; kind: ThumbnailBackfillKind; message: string }>;
  limit: number | null;
};

export function summarizePhotoStorage(input: {
  assetPhotos: AssetPhotoSummaryInput[];
  stockPhotos?: StockPhotoSummaryInput[];
  facturaFileSizes?: Array<number | null | undefined>;
  thumbnailSizes?: number[];
}) {
  const stockPhotos = input.stockPhotos ?? [];
  const allOperationalPhotos = [...input.assetPhotos, ...stockPhotos];
  const photoSize = (photo: AssetPhotoSummaryInput | StockPhotoSummaryInput) => Number(photo.sizeBytes ?? ("fileSize" in photo ? photo.fileSize : 0) ?? 0);
  const largestPhotos = [...allOperationalPhotos].sort((a, b) => photoSize(b) - photoSize(a)).slice(0, 10);
  const oversizedPhotos = allOperationalPhotos.filter((photo) => photoSize(photo) > RECOMMENDED_PHOTO_BYTES);
  const missingThumbnails = allOperationalPhotos.filter((photo) => !photo.thumbnailPath && isImageMime(photo.mimeType));
  return {
    assetPhotoCount: input.assetPhotos.length,
    stockPhotoCount: stockPhotos.length,
    totalPhotoCount: allOperationalPhotos.length,
    assetPhotoStorageBytes: input.assetPhotos.reduce((sum, photo) => sum + photoSize(photo), 0),
    stockPhotoStorageBytes: stockPhotos.reduce((sum, photo) => sum + photoSize(photo), 0),
    facturaStorageBytes: input.facturaFileSizes?.reduce<number>((sum, size) => sum + Number(size ?? 0), 0) ?? 0,
    thumbnailStorageBytes: input.thumbnailSizes?.reduce<number>((sum, size) => sum + size, 0) ?? 0,
    largestPhotos,
    oversizedPhotos,
    missingThumbnails,
  };
}

export async function getPhotoStorageSummary(prisma: PrismaClient) {
  const [assetPhotos, stockPhotos, facturas] = await Promise.all([
    prisma.assetPhoto.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filePath: true,
        storedFilename: true,
        thumbnailFilename: true,
        thumbnailPath: true,
        fileSize: true,
        sizeBytes: true,
        mimeType: true,
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    }),
    prisma.stockItemPhoto.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filePath: true,
        storedFilename: true,
        thumbnailFilename: true,
        thumbnailPath: true,
        sizeBytes: true,
        mimeType: true,
        stockItem: { select: { id: true, name: true, sku: true } },
      },
    }),
    prisma.factura.findMany({ where: { filePath: { not: null } }, select: { fileSize: true } }),
  ]);

  const thumbnailSizes = await Promise.all([
    ...assetPhotos.map((photo) => (photo.thumbnailFilename ? fileSizeIfExists("assets", photo.thumbnailFilename, "thumbs") : Promise.resolve(0))),
    ...stockPhotos.map((photo) => (photo.thumbnailFilename ? fileSizeIfExists("stock", photo.thumbnailFilename, "thumbs") : Promise.resolve(0))),
  ]);
  return summarizePhotoStorage({
    assetPhotos,
    stockPhotos,
    facturaFileSizes: facturas.map((factura) => factura.fileSize),
    thumbnailSizes,
  });
}

export async function buildThumbnailBackfillPlan(prisma: PrismaClient): Promise<ThumbnailBackfillPlan> {
  const [assetPhotos, stockPhotos] = await Promise.all([
    prisma.assetPhoto.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        storedFilename: true,
        thumbnailFilename: true,
        thumbnailPath: true,
        mimeType: true,
        fileSize: true,
        sizeBytes: true,
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    }),
    prisma.stockItemPhoto.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        storedFilename: true,
        thumbnailFilename: true,
        thumbnailPath: true,
        mimeType: true,
        sizeBytes: true,
        stockItem: { select: { id: true, name: true, sku: true } },
      },
    }),
  ]);

  const photos: ThumbnailBackfillPhoto[] = [
    ...assetPhotos.map((photo) => ({
      kind: "asset" as const,
      id: photo.id,
      ownerId: photo.asset.id,
      ownerLabel: photo.asset.assetTag ? `${photo.asset.assetTag} / ${photo.asset.name}` : photo.asset.name,
      storedFilename: photo.storedFilename,
      thumbnailFilename: photo.thumbnailFilename,
      thumbnailPath: photo.thumbnailPath,
      mimeType: photo.mimeType,
      sizeBytes: Number(photo.sizeBytes ?? photo.fileSize ?? 0),
    })),
    ...stockPhotos.map((photo) => ({
      kind: "stock" as const,
      id: photo.id,
      ownerId: photo.stockItem.id,
      ownerLabel: photo.stockItem.sku ? `${photo.stockItem.sku} / ${photo.stockItem.name}` : photo.stockItem.name,
      storedFilename: photo.storedFilename,
      thumbnailFilename: photo.thumbnailFilename,
      thumbnailPath: photo.thumbnailPath,
      mimeType: photo.mimeType,
      sizeBytes: Number(photo.sizeBytes ?? 0),
    })),
  ];

  const checks = await Promise.all(photos.map(async (photo) => {
    const folder = photo.kind === "asset" ? "assets" : "stock";
    const originalExists = Boolean(await readUploadFile(folder, photo.storedFilename));
    const thumbnailExists = photo.thumbnailFilename ? Boolean(await readUploadFile(folder, photo.thumbnailFilename, "thumbs")) : false;
    return { photo, originalExists, thumbnailExists };
  }));

  const missingOriginals = checks.filter((check) => !check.originalExists).map((check) => check.photo);
  const unsupportedPhotos = checks.filter((check) => check.originalExists && !isImageMime(check.photo.mimeType)).map((check) => check.photo);
  const oversizedPhotos = checks.filter((check) => check.photo.sizeBytes > RECOMMENDED_PHOTO_BYTES).map((check) => check.photo);
  const candidates = checks
    .filter((check) => check.originalExists && isImageMime(check.photo.mimeType))
    .filter((check) => !check.photo.thumbnailPath || !check.photo.thumbnailFilename || !check.thumbnailExists)
    .map((check) => ({
      ...check.photo,
      missingThumbnailMetadata: !check.photo.thumbnailPath || !check.photo.thumbnailFilename,
      thumbnailFileMissing: Boolean(check.photo.thumbnailFilename || check.photo.thumbnailPath) && !check.thumbnailExists,
    }));
  const alreadyReady = checks
    .filter((check) => check.originalExists && isImageMime(check.photo.mimeType) && check.photo.thumbnailPath && check.photo.thumbnailFilename && check.thumbnailExists)
    .map((check) => check.photo);

  return {
    generatedAt: new Date().toISOString(),
    totalPhotos: photos.length,
    assetPhotoCount: assetPhotos.length,
    stockPhotoCount: stockPhotos.length,
    candidates,
    missingOriginals,
    oversizedPhotos,
    unsupportedPhotos,
    alreadyReady,
    estimatedOutputThumbnailCount: candidates.length,
  };
}

export async function applyThumbnailBackfill(
  prisma: PrismaClient,
  options: { confirmed?: boolean; limit?: number | null; force?: boolean } = {},
): Promise<ThumbnailBackfillApplyResult> {
  if (!options.confirmed) {
    throw new Error("Thumbnail backfill apply requires confirmation. Run dry-run first, run npm run backup, then pass --confirm or set CONFIRM_PHOTO_BACKFILL=true.");
  }
  const plan = await buildThumbnailBackfillPlan(prisma);
  const limit = normalizeBackfillLimit(options.limit);
  const candidates = plan.candidates
    .filter((candidate) => options.force || !candidate.thumbnailFilename || !candidate.thumbnailPath || candidate.thumbnailFileMissing)
    .slice(0, limit ?? undefined);
  const failed: ThumbnailBackfillApplyResult["failed"] = [];
  let created = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      const folder = candidate.kind === "asset" ? "assets" : "stock";
      const derivative = await generateThumbnailForUpload(folder, candidate.storedFilename);
      if (!derivative.thumbnailFilename || !derivative.thumbnailPath) {
        skipped += 1;
        continue;
      }
      if (candidate.kind === "asset") {
        await prisma.assetPhoto.update({
          where: { id: candidate.id },
          data: {
            thumbnailFilename: derivative.thumbnailFilename,
            thumbnailPath: derivative.thumbnailPath,
            width: derivative.width,
            height: derivative.height,
            sizeBytes: candidate.sizeBytes || undefined,
          },
        });
      } else {
        await prisma.stockItemPhoto.update({
          where: { id: candidate.id },
          data: {
            thumbnailFilename: derivative.thumbnailFilename,
            thumbnailPath: derivative.thumbnailPath,
            width: derivative.width,
            height: derivative.height,
          },
        });
      }
      created += 1;
    } catch (error) {
      failed.push({ id: candidate.id, kind: candidate.kind, message: error instanceof Error ? error.message : "Unknown thumbnail error." });
    }
  }

  return { plan, attempted: candidates.length, created, skipped, failed, limit };
}

export function normalizeBackfillLimit(value?: number | null) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_THUMBNAIL_BACKFILL_LIMIT;
  return Math.floor(value);
}

function isImageMime(mimeType?: string | null) {
  return Boolean(mimeType?.startsWith("image/"));
}
