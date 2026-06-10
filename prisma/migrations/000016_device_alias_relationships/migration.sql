-- Device aliases and safe asset-to-asset relationships for legacy mobile imports.
CREATE TABLE "DeviceAlias" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL,
  "aliasType" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sourceSheet" TEXT,
  "sourceColumn" TEXT,
  "sourceRow" INTEGER,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DeviceAlias_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceAlias_deviceId_aliasType_value_key" ON "DeviceAlias"("deviceId", "aliasType", "value");
CREATE INDEX "DeviceAlias_deviceId_idx" ON "DeviceAlias"("deviceId");
CREATE INDEX "DeviceAlias_aliasType_idx" ON "DeviceAlias"("aliasType");
CREATE INDEX "DeviceAlias_value_idx" ON "DeviceAlias"("value");
CREATE INDEX "DeviceAlias_sourceSheet_sourceRow_idx" ON "DeviceAlias"("sourceSheet", "sourceRow");

CREATE TABLE "DeviceRelationship" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceDeviceId" TEXT NOT NULL,
  "targetDeviceId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "sourceReference" TEXT,
  "confidence" REAL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DeviceRelationship_sourceDeviceId_fkey" FOREIGN KEY ("sourceDeviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeviceRelationship_targetDeviceId_fkey" FOREIGN KEY ("targetDeviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceRelationship_sourceDeviceId_targetDeviceId_relationshipType_key" ON "DeviceRelationship"("sourceDeviceId", "targetDeviceId", "relationshipType");
CREATE INDEX "DeviceRelationship_sourceDeviceId_idx" ON "DeviceRelationship"("sourceDeviceId");
CREATE INDEX "DeviceRelationship_targetDeviceId_idx" ON "DeviceRelationship"("targetDeviceId");
CREATE INDEX "DeviceRelationship_relationshipType_idx" ON "DeviceRelationship"("relationshipType");
CREATE INDEX "DeviceRelationship_status_idx" ON "DeviceRelationship"("status");
