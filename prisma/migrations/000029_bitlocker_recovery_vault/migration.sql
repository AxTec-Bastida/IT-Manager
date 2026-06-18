-- CreateTable
CREATE TABLE "BitLockerRecoveryKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "recoveryKeyEncrypted" TEXT NOT NULL,
    "keyId" TEXT,
    "volumeLabel" TEXT,
    "protectorId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "lastViewedAt" DATETIME,
    "lastViewedByUserId" TEXT,
    "lastViewedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BitLockerRecoveryKey_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BitLockerRecoveryKey_deviceId_key" ON "BitLockerRecoveryKey"("deviceId");
CREATE INDEX "BitLockerRecoveryKey_keyId_idx" ON "BitLockerRecoveryKey"("keyId");
CREATE INDEX "BitLockerRecoveryKey_lastViewedAt_idx" ON "BitLockerRecoveryKey"("lastViewedAt");
CREATE INDEX "BitLockerRecoveryKey_createdAt_idx" ON "BitLockerRecoveryKey"("createdAt");
