-- Add printer maintenance fields to serialized assets.
ALTER TABLE "Device" ADD COLUMN "blackTonerLevel" INTEGER;
ALTER TABLE "Device" ADD COLUMN "cyanTonerLevel" INTEGER;
ALTER TABLE "Device" ADD COLUMN "magentaTonerLevel" INTEGER;
ALTER TABLE "Device" ADD COLUMN "yellowTonerLevel" INTEGER;
ALTER TABLE "Device" ADD COLUMN "drumLevel" INTEGER;
ALTER TABLE "Device" ADD COLUMN "fuserStatus" TEXT;
ALTER TABLE "Device" ADD COLUMN "pageCount" INTEGER;
ALTER TABLE "Device" ADD COLUMN "lastSupplyReplacementAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "lowSupplyThreshold" INTEGER;
ALTER TABLE "Device" ADD COLUMN "lastCleanedAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "cleaningIntervalDays" INTEGER;
ALTER TABLE "Device" ADD COLUMN "lastPrintheadReplacementAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "lastPlatenRollerReplacementAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "lastCutterReplacementAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "estimatedPrintheadLife" INTEGER;
ALTER TABLE "Device" ADD COLUMN "maintenanceDueAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "maintenanceNotes" TEXT;

-- Local quantity-tracked consumables, peripherals, supplies, and maintenance parts.
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "compatibleAssetCategory" TEXT,
    "compatibleModels" TEXT,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "minimumQuantity" INTEGER NOT NULL DEFAULT 0,
    "reorderQuantity" INTEGER,
    "unitCost" REAL,
    "currency" TEXT DEFAULT 'USD',
    "vendorName" TEXT,
    "storageLocation" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "StockItem_sku_key" ON "StockItem"("sku");
CREATE INDEX "StockItem_name_idx" ON "StockItem"("name");
CREATE INDEX "StockItem_sku_idx" ON "StockItem"("sku");
CREATE INDEX "StockItem_category_idx" ON "StockItem"("category");
CREATE INDEX "StockItem_itemType_idx" ON "StockItem"("itemType");
CREATE INDEX "StockItem_active_idx" ON "StockItem"("active");

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockItemId" TEXT NOT NULL,
    "assetId" TEXT,
    "employeeId" TEXT,
    "movementType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "StockMovement_stockItemId_idx" ON "StockMovement"("stockItemId");
CREATE INDEX "StockMovement_assetId_idx" ON "StockMovement"("assetId");
CREATE INDEX "StockMovement_employeeId_idx" ON "StockMovement"("employeeId");
CREATE INDEX "StockMovement_movementType_idx" ON "StockMovement"("movementType");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "notes" TEXT,
    "stockItemId" TEXT,
    "quantityUsed" INTEGER,
    "partSerialNumber" TEXT,
    "previousPartInfo" TEXT,
    "newPartInfo" TEXT,
    "cost" REAL,
    "currency" TEXT DEFAULT 'USD',
    "nextDueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRecord_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MaintenanceRecord_assetId_idx" ON "MaintenanceRecord"("assetId");
CREATE INDEX "MaintenanceRecord_stockItemId_idx" ON "MaintenanceRecord"("stockItemId");
CREATE INDEX "MaintenanceRecord_maintenanceType_idx" ON "MaintenanceRecord"("maintenanceType");
CREATE INDEX "MaintenanceRecord_performedAt_idx" ON "MaintenanceRecord"("performedAt");
CREATE INDEX "MaintenanceRecord_nextDueAt_idx" ON "MaintenanceRecord"("nextDueAt");

CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "assetId" TEXT,
    "stockItemId" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Alert_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Alert_type_idx" ON "Alert"("type");
CREATE INDEX "Alert_status_idx" ON "Alert"("status");
CREATE INDEX "Alert_assetId_idx" ON "Alert"("assetId");
CREATE INDEX "Alert_stockItemId_idx" ON "Alert"("stockItemId");
CREATE INDEX "Alert_lastSeenAt_idx" ON "Alert"("lastSeenAt");

ALTER TABLE "AppSettings" ADD COLUMN "defaultLowStockThreshold" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "AppSettings" ADD COLUMN "defaultThermalCleaningIntervalDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "AppSettings" ADD COLUMN "defaultMfpLowSupplyThreshold" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "AppSettings" ADD COLUMN "enablePrinterMaintenanceAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN "enableLowStockAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN "alertDuplicateSuppressionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'USD';
