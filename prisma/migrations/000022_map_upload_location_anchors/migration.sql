-- Add uploaded map metadata and location-anchor support without changing existing records.
ALTER TABLE "WarehouseMap" ADD COLUMN "uploadedOriginalFilename" TEXT;
ALTER TABLE "WarehouseMap" ADD COLUMN "uploadedStoredFilename" TEXT;
ALTER TABLE "WarehouseMap" ADD COLUMN "uploadedMimeType" TEXT;
ALTER TABLE "WarehouseMap" ADD COLUMN "uploadedSizeBytes" INTEGER;
ALTER TABLE "WarehouseMap" ADD COLUMN "uploadedBy" TEXT;
ALTER TABLE "WarehouseMap" ADD COLUMN "uploadedAt" DATETIME;

ALTER TABLE "AccessPointMapLocation" ADD COLUMN "area" TEXT;
ALTER TABLE "AccessPointMapLocation" ADD COLUMN "department" TEXT;
ALTER TABLE "AccessPointMapLocation" ADD COLUMN "station" TEXT;
ALTER TABLE "AccessPointMapLocation" ADD COLUMN "displayPath" TEXT;

ALTER TABLE "Device" ADD COLUMN "currentMapAnchorId" TEXT;

CREATE INDEX "WarehouseMap_uploadedStoredFilename_idx" ON "WarehouseMap"("uploadedStoredFilename");
CREATE INDEX "AccessPointMapLocation_area_idx" ON "AccessPointMapLocation"("area");
CREATE INDEX "AccessPointMapLocation_department_idx" ON "AccessPointMapLocation"("department");
CREATE INDEX "Device_currentMapAnchorId_idx" ON "Device"("currentMapAnchorId");
