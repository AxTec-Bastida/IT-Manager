-- SQLite stores Prisma enum values as TEXT. PhotoSource and StockItemPhotoType
-- do not require enum DDL.

ALTER TABLE "AssetPhoto" ADD COLUMN "sizeBytes" INTEGER;
ALTER TABLE "AssetPhoto" ADD COLUMN "thumbnailFilename" TEXT;
ALTER TABLE "AssetPhoto" ADD COLUMN "thumbnailPath" TEXT;
ALTER TABLE "AssetPhoto" ADD COLUMN "optimizedFilename" TEXT;
ALTER TABLE "AssetPhoto" ADD COLUMN "optimizedPath" TEXT;
ALTER TABLE "AssetPhoto" ADD COLUMN "uploadedByUserId" TEXT;
ALTER TABLE "AssetPhoto" ADD COLUMN "uploadedByName" TEXT;
ALTER TABLE "AssetPhoto" ADD COLUMN "compressionApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssetPhoto" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'UNKNOWN';

CREATE TABLE "StockItemPhoto" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stockItemId" TEXT NOT NULL,
  "photoType" TEXT NOT NULL DEFAULT 'OTHER',
  "caption" TEXT,
  "originalFilename" TEXT,
  "storedFilename" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "thumbnailFilename" TEXT,
  "thumbnailPath" TEXT,
  "uploadedByUserId" TEXT,
  "uploadedByName" TEXT,
  "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StockItemPhoto_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockItemPhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AssetPhoto_uploadedByUserId_idx" ON "AssetPhoto"("uploadedByUserId");
CREATE INDEX "AssetPhoto_source_idx" ON "AssetPhoto"("source");
CREATE INDEX "StockItemPhoto_stockItemId_idx" ON "StockItemPhoto"("stockItemId");
CREATE INDEX "StockItemPhoto_photoType_idx" ON "StockItemPhoto"("photoType");
CREATE INDEX "StockItemPhoto_uploadedByUserId_idx" ON "StockItemPhoto"("uploadedByUserId");
