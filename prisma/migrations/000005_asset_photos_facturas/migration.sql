-- Purchase/factura records store metadata only. Uploaded files live on disk.
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facturaNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorRfc" TEXT,
    "purchaseDate" DATETIME,
    "receivedDate" DATETIME,
    "poNumber" TEXT,
    "totalAmount" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "warrantyStartAt" DATETIME,
    "warrantyEndAt" DATETIME,
    "notes" TEXT,
    "originalFilename" TEXT,
    "storedFilename" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "Factura_facturaNumber_idx" ON "Factura"("facturaNumber");
CREATE INDEX "Factura_vendorName_idx" ON "Factura"("vendorName");
CREATE INDEX "Factura_poNumber_idx" ON "Factura"("poNumber");
CREATE INDEX "Factura_purchaseDate_idx" ON "Factura"("purchaseDate");

CREATE TABLE "AssetPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "photoType" TEXT NOT NULL DEFAULT 'OTHER',
    "caption" TEXT,
    "originalFilename" TEXT,
    "storedFilename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetPhoto_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AssetPhoto_assetId_idx" ON "AssetPhoto"("assetId");
CREATE INDEX "AssetPhoto_photoType_idx" ON "AssetPhoto"("photoType");
CREATE INDEX "AssetPhoto_isPrimary_idx" ON "AssetPhoto"("isPrimary");

ALTER TABLE "Device" ADD COLUMN "facturaId" TEXT;
CREATE INDEX "Device_facturaId_idx" ON "Device"("facturaId");

ALTER TABLE "StockItem" ADD COLUMN "facturaId" TEXT;
CREATE INDEX "StockItem_facturaId_idx" ON "StockItem"("facturaId");

ALTER TABLE "StockMovement" ADD COLUMN "facturaId" TEXT;
CREATE INDEX "StockMovement_facturaId_idx" ON "StockMovement"("facturaId");
