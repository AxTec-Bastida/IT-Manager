-- SQLite stores Prisma enum values as TEXT, so adding OfflineResolutionStatus requires no enum DDL.

ALTER TABLE "OfflineSyncRecord" ADD COLUMN "resolutionStatus" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "OfflineSyncRecord" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "OfflineSyncRecord" ADD COLUMN "reviewedByUserId" TEXT;
ALTER TABLE "OfflineSyncRecord" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "OfflineSyncRecord" ADD COLUMN "conflictCode" TEXT;
ALTER TABLE "OfflineSyncRecord" ADD COLUMN "entityType" TEXT;
ALTER TABLE "OfflineSyncRecord" ADD COLUMN "entityId" TEXT;
ALTER TABLE "OfflineSyncRecord" ADD COLUMN "entityLabel" TEXT;

UPDATE "OfflineSyncRecord"
SET "resolutionStatus" = 'RESOLVED'
WHERE "status" = 'SYNCED';

UPDATE "OfflineSyncRecord"
SET "resolutionStatus" = 'CANCELLED'
WHERE "status" = 'CANCELLED';

CREATE INDEX "OfflineSyncRecord_resolutionStatus_idx" ON "OfflineSyncRecord"("resolutionStatus");
CREATE INDEX "OfflineSyncRecord_reviewedByUserId_idx" ON "OfflineSyncRecord"("reviewedByUserId");
CREATE INDEX "OfflineSyncRecord_conflictCode_idx" ON "OfflineSyncRecord"("conflictCode");
CREATE INDEX "OfflineSyncRecord_entityType_entityId_idx" ON "OfflineSyncRecord"("entityType", "entityId");
