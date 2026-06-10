-- CreateTable
CREATE TABLE "AssetDecommissionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "finalStatus" TEXT NOT NULL,
    "checklistJson" TEXT,
    "notes" TEXT,
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "performedByUserId" TEXT,
    "performedByName" TEXT,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetDecommissionRecord_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssetDecommissionRecord_deviceId_idx" ON "AssetDecommissionRecord"("deviceId");

-- CreateIndex
CREATE INDEX "AssetDecommissionRecord_reason_idx" ON "AssetDecommissionRecord"("reason");

-- CreateIndex
CREATE INDEX "AssetDecommissionRecord_finalStatus_idx" ON "AssetDecommissionRecord"("finalStatus");

-- CreateIndex
CREATE INDEX "AssetDecommissionRecord_performedAt_idx" ON "AssetDecommissionRecord"("performedAt");

-- CreateIndex
CREATE INDEX "AssetDecommissionRecord_performedByUserId_idx" ON "AssetDecommissionRecord"("performedByUserId");
