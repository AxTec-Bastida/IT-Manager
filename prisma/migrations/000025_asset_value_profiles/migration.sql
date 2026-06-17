CREATE TABLE "AssetValueProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "purchaseValue" REAL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "purchaseDate" DATETIME,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "usefulLifeMonths" INTEGER,
    "residualPercent" REAL NOT NULL DEFAULT 30,
    "residualValue" REAL,
    "currentEstimatedValue" REAL,
    "lastCalculatedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetValueProfile_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AssetValueProfile_deviceId_key" ON "AssetValueProfile"("deviceId");
CREATE INDEX "AssetValueProfile_currency_idx" ON "AssetValueProfile"("currency");
CREATE INDEX "AssetValueProfile_purchaseDate_idx" ON "AssetValueProfile"("purchaseDate");

ALTER TABLE "AssetDecommissionRecord" ADD COLUMN "estimatedValueAtDecommission" REAL;
ALTER TABLE "AssetDecommissionRecord" ADD COLUMN "estimatedValueCurrency" TEXT;
