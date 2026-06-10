-- Physical inventory audit / cycle count workflow.
CREATE TABLE "InventoryAuditSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "auditNumber" TEXT,
  "title" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "area" TEXT,
  "department" TEXT,
  "location" TEXT,
  "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "createdBy" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "InventoryAuditSession_auditNumber_key" ON "InventoryAuditSession"("auditNumber");
CREATE INDEX "InventoryAuditSession_auditNumber_idx" ON "InventoryAuditSession"("auditNumber");
CREATE INDEX "InventoryAuditSession_status_idx" ON "InventoryAuditSession"("status");
CREATE INDEX "InventoryAuditSession_scopeType_idx" ON "InventoryAuditSession"("scopeType");
CREATE INDEX "InventoryAuditSession_area_idx" ON "InventoryAuditSession"("area");
CREATE INDEX "InventoryAuditSession_department_idx" ON "InventoryAuditSession"("department");
CREATE INDEX "InventoryAuditSession_location_idx" ON "InventoryAuditSession"("location");
CREATE INDEX "InventoryAuditSession_category_idx" ON "InventoryAuditSession"("category");
CREATE INDEX "InventoryAuditSession_startedAt_idx" ON "InventoryAuditSession"("startedAt");

CREATE TABLE "InventoryAuditExpectedItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "auditSessionId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "expectedAssetTag" TEXT,
  "expectedDisplayName" TEXT NOT NULL,
  "expectedCategory" TEXT NOT NULL,
  "expectedLocation" TEXT,
  "expectedStatus" TEXT NOT NULL,
  "resultStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InventoryAuditExpectedItem_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "InventoryAuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryAuditExpectedItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InventoryAuditExpectedItem_auditSessionId_deviceId_key" ON "InventoryAuditExpectedItem"("auditSessionId", "deviceId");
CREATE INDEX "InventoryAuditExpectedItem_auditSessionId_idx" ON "InventoryAuditExpectedItem"("auditSessionId");
CREATE INDEX "InventoryAuditExpectedItem_deviceId_idx" ON "InventoryAuditExpectedItem"("deviceId");
CREATE INDEX "InventoryAuditExpectedItem_resultStatus_idx" ON "InventoryAuditExpectedItem"("resultStatus");
CREATE INDEX "InventoryAuditExpectedItem_expectedCategory_idx" ON "InventoryAuditExpectedItem"("expectedCategory");

CREATE TABLE "InventoryAuditScan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "auditSessionId" TEXT NOT NULL,
  "scannedValue" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "matchedDeviceId" TEXT,
  "resultType" TEXT NOT NULL,
  "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAuditScan_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "InventoryAuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryAuditScan_matchedDeviceId_fkey" FOREIGN KEY ("matchedDeviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InventoryAuditScan_auditSessionId_idx" ON "InventoryAuditScan"("auditSessionId");
CREATE INDEX "InventoryAuditScan_matchedDeviceId_idx" ON "InventoryAuditScan"("matchedDeviceId");
CREATE INDEX "InventoryAuditScan_resultType_idx" ON "InventoryAuditScan"("resultType");
CREATE INDEX "InventoryAuditScan_normalizedValue_idx" ON "InventoryAuditScan"("normalizedValue");
CREATE INDEX "InventoryAuditScan_scannedAt_idx" ON "InventoryAuditScan"("scannedAt");
