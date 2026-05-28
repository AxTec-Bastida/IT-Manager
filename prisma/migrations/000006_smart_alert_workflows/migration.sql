ALTER TABLE "Alert" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "Alert" ADD COLUMN "acknowledgedAt" DATETIME;
ALTER TABLE "Alert" ADD COLUMN "ignoredAt" DATETIME;
ALTER TABLE "Alert" ADD COLUMN "resolutionNote" TEXT;
CREATE INDEX "Alert_source_idx" ON "Alert"("source");

CREATE TABLE "LocationZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "floorName" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mapId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocationZone_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "WarehouseMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LocationZone_name_idx" ON "LocationZone"("name");
CREATE INDEX "LocationZone_active_idx" ON "LocationZone"("active");
CREATE INDEX "LocationZone_mapId_idx" ON "LocationZone"("mapId");

ALTER TABLE "AccessPointMapLocation" ADD COLUMN "locationZoneId" TEXT;
ALTER TABLE "AccessPointMapLocation" ADD COLUMN "zoneOrder" INTEGER;
CREATE INDEX "AccessPointMapLocation_locationZoneId_idx" ON "AccessPointMapLocation"("locationZoneId");

ALTER TABLE "Device" ADD COLUMN "isFixedAsset" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Device" ADD COLUMN "usesStaticIp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Device" ADD COLUMN "expectedLocationZoneId" TEXT;
ALTER TABLE "Device" ADD COLUMN "movementAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Device" ADD COLUMN "allowedZoneDistance" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Device_expectedLocationZoneId_idx" ON "Device"("expectedLocationZoneId");

ALTER TABLE "AppSettings" ADD COLUMN "enableConflictAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN "enableWarrantyAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN "warrantyAlertThresholdDays" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "AppSettings" ADD COLUMN "enableMovementAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN "defaultAllowedZoneDistance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppSettings" ADD COLUMN "autoResolveMovementAlerts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "enableMissingAssetSeenOnlineAlerts" BOOLEAN NOT NULL DEFAULT true;
