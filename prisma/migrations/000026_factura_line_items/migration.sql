CREATE TABLE "FacturaLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facturaId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "model" TEXT,
    "category" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCost" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "totalCost" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FacturaLineItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FacturaLineItemAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facturaLineItemId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "allocatedUnitCost" REAL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FacturaLineItemAsset_facturaLineItemId_fkey" FOREIGN KEY ("facturaLineItemId") REFERENCES "FacturaLineItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FacturaLineItemAsset_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FacturaLineItemAsset_facturaLineItemId_deviceId_key" ON "FacturaLineItemAsset"("facturaLineItemId", "deviceId");
CREATE INDEX "FacturaLineItem_facturaId_idx" ON "FacturaLineItem"("facturaId");
CREATE INDEX "FacturaLineItem_category_idx" ON "FacturaLineItem"("category");
CREATE INDEX "FacturaLineItem_sku_idx" ON "FacturaLineItem"("sku");
CREATE INDEX "FacturaLineItem_model_idx" ON "FacturaLineItem"("model");
CREATE INDEX "FacturaLineItemAsset_facturaLineItemId_idx" ON "FacturaLineItemAsset"("facturaLineItemId");
CREATE INDEX "FacturaLineItemAsset_deviceId_idx" ON "FacturaLineItemAsset"("deviceId");

ALTER TABLE "AssetValueProfile" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "AssetValueProfile" ADD COLUMN "sourceFacturaLineItemAssetId" TEXT REFERENCES "FacturaLineItemAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AssetValueProfile_sourceType_idx" ON "AssetValueProfile"("sourceType");
CREATE INDEX "AssetValueProfile_sourceFacturaLineItemAssetId_idx" ON "AssetValueProfile"("sourceFacturaLineItemAssetId");
