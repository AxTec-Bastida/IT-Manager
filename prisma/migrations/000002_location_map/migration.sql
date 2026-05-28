CREATE TABLE "WarehouseMap" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "floorName" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AccessPointMapLocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "apName" TEXT NOT NULL,
  "apMac" TEXT NOT NULL,
  "unifiDeviceId" TEXT,
  "locationLabel" TEXT NOT NULL,
  "floorName" TEXT,
  "mapName" TEXT,
  "x" REAL NOT NULL,
  "y" REAL NOT NULL,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "mapId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AccessPointMapLocation_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "WarehouseMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AssetLocationHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assetId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'UNIFI',
  "apName" TEXT NOT NULL,
  "apMac" TEXT NOT NULL,
  "locationLabel" TEXT NOT NULL,
  "x" REAL NOT NULL,
  "y" REAL NOT NULL,
  "ipAddress" TEXT,
  "signalStrength" INTEGER,
  "seenAt" DATETIME NOT NULL,
  "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "apMapLocationId" TEXT,
  CONSTRAINT "AssetLocationHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssetLocationHistory_apMapLocationId_fkey" FOREIGN KEY ("apMapLocationId") REFERENCES "AccessPointMapLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "UnifiClientSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assetId" TEXT,
  "clientMac" TEXT NOT NULL,
  "ipAddress" TEXT,
  "hostname" TEXT,
  "name" TEXT,
  "apName" TEXT,
  "apMac" TEXT,
  "unifiApId" TEXT,
  "online" BOOLEAN NOT NULL DEFAULT false,
  "signalStrength" INTEGER,
  "lastSeenAt" DATETIME,
  "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "raw" TEXT,
  CONSTRAINT "UnifiClientSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WarehouseMap_active_idx" ON "WarehouseMap"("active");
CREATE INDEX "AccessPointMapLocation_apMac_idx" ON "AccessPointMapLocation"("apMac");
CREATE INDEX "AccessPointMapLocation_active_idx" ON "AccessPointMapLocation"("active");
CREATE INDEX "AccessPointMapLocation_mapId_idx" ON "AccessPointMapLocation"("mapId");
CREATE INDEX "AssetLocationHistory_assetId_seenAt_idx" ON "AssetLocationHistory"("assetId", "seenAt");
CREATE INDEX "AssetLocationHistory_apMac_idx" ON "AssetLocationHistory"("apMac");
CREATE INDEX "AssetLocationHistory_source_idx" ON "AssetLocationHistory"("source");
CREATE INDEX "UnifiClientSnapshot_clientMac_idx" ON "UnifiClientSnapshot"("clientMac");
CREATE INDEX "UnifiClientSnapshot_assetId_idx" ON "UnifiClientSnapshot"("assetId");
CREATE INDEX "UnifiClientSnapshot_online_idx" ON "UnifiClientSnapshot"("online");
