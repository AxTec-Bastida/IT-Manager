CREATE TABLE "Device" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "macAddress" TEXT,
  "vlan" INTEGER NOT NULL,
  "location" TEXT,
  "brand" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "assignedTo" TEXT,
  "notes" TEXT,
  "lastSeenAt" DATETIME,
  "ipRangeId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Device_ipRangeId_fkey" FOREIGN KEY ("ipRangeId") REFERENCES "IpRange" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "IpRange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "vlan" INTEGER NOT NULL,
  "subnet" TEXT,
  "startIp" TEXT NOT NULL,
  "endIp" TEXT NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ScanRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rangeId" TEXT,
  "rangeName" TEXT NOT NULL,
  "startIp" TEXT NOT NULL,
  "endIp" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "message" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME
);

CREATE TABLE "ScanResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scanRunId" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "reachable" BOOLEAN NOT NULL,
  "macAddress" TEXT,
  "hostname" TEXT,
  "note" TEXT,
  "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanResult_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "ScanRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Conflict" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "affectedDeviceIds" TEXT,
  "affectedIps" TEXT,
  "suggestedFix" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "message" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AppSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "defaultVlan" INTEGER NOT NULL DEFAULT 10,
  "defaultCategory" TEXT NOT NULL DEFAULT 'OTHER',
  "maxScanSize" INTEGER NOT NULL DEFAULT 64,
  "pingTimeoutMs" INTEGER NOT NULL DEFAULT 800,
  "autoSaveScanResults" BOOLEAN NOT NULL DEFAULT true,
  "siteName" TEXT NOT NULL DEFAULT 'Warehouse IPAM',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "Device_ipAddress_idx" ON "Device"("ipAddress");
CREATE INDEX "Device_macAddress_idx" ON "Device"("macAddress");
CREATE INDEX "Device_category_idx" ON "Device"("category");
CREATE INDEX "Device_status_idx" ON "Device"("status");
CREATE INDEX "Device_vlan_idx" ON "Device"("vlan");
CREATE INDEX "IpRange_category_idx" ON "IpRange"("category");
CREATE INDEX "IpRange_vlan_idx" ON "IpRange"("vlan");
CREATE INDEX "IpRange_active_idx" ON "IpRange"("active");
CREATE INDEX "ScanResult_ipAddress_idx" ON "ScanResult"("ipAddress");
CREATE INDEX "ScanResult_macAddress_idx" ON "ScanResult"("macAddress");
CREATE INDEX "Conflict_type_idx" ON "Conflict"("type");
CREATE INDEX "Conflict_severity_idx" ON "Conflict"("severity");
CREATE INDEX "Conflict_resolved_idx" ON "Conflict"("resolved");
CREATE INDEX "ActivityLog_entity_idx" ON "ActivityLog"("entity");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
