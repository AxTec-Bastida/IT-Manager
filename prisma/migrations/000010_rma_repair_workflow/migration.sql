-- CreateTable
CREATE TABLE "RmaCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rmaNumber" TEXT NOT NULL,
    "title" TEXT,
    "destination" TEXT NOT NULL,
    "vendorName" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "sentAt" DATETIME,
    "expectedFollowUpAt" DATETIME,
    "reminderAfterDays" INTEGER NOT NULL DEFAULT 7,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RmaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rmaCaseId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "issueDescription" TEXT,
    "conditionSent" TEXT,
    "accessoriesSent" TEXT,
    "sentAt" DATETIME,
    "returnedAt" DATETIME,
    "returnCondition" TEXT,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "replacementDeviceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RmaItem_rmaCaseId_fkey" FOREIGN KEY ("rmaCaseId") REFERENCES "RmaCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RmaItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RmaItem_replacementDeviceId_fkey" FOREIGN KEY ("replacementDeviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RmaCase_rmaNumber_idx" ON "RmaCase"("rmaNumber");

-- CreateIndex
CREATE INDEX "RmaCase_status_idx" ON "RmaCase"("status");

-- CreateIndex
CREATE INDEX "RmaCase_destination_idx" ON "RmaCase"("destination");

-- CreateIndex
CREATE INDEX "RmaCase_vendorName_idx" ON "RmaCase"("vendorName");

-- CreateIndex
CREATE INDEX "RmaCase_sentAt_idx" ON "RmaCase"("sentAt");

-- CreateIndex
CREATE INDEX "RmaCase_expectedFollowUpAt_idx" ON "RmaCase"("expectedFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "RmaItem_rmaCaseId_deviceId_key" ON "RmaItem"("rmaCaseId", "deviceId");

-- CreateIndex
CREATE INDEX "RmaItem_rmaCaseId_idx" ON "RmaItem"("rmaCaseId");

-- CreateIndex
CREATE INDEX "RmaItem_deviceId_idx" ON "RmaItem"("deviceId");

-- CreateIndex
CREATE INDEX "RmaItem_replacementDeviceId_idx" ON "RmaItem"("replacementDeviceId");

-- CreateIndex
CREATE INDEX "RmaItem_result_idx" ON "RmaItem"("result");

-- CreateIndex
CREATE INDEX "RmaItem_returnedAt_idx" ON "RmaItem"("returnedAt");
