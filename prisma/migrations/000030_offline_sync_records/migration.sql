-- SQLite stores Prisma enum values as TEXT, so adding OfflineActionType and OfflineSyncStatus requires no enum DDL.

CREATE TABLE "OfflineSyncRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientActionId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorName" TEXT,
  "payloadSummary" TEXT,
  "resultSummary" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" DATETIME,
  CONSTRAINT "OfflineSyncRecord_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OfflineSyncRecord_clientActionId_key" ON "OfflineSyncRecord"("clientActionId");
CREATE INDEX "OfflineSyncRecord_actionType_idx" ON "OfflineSyncRecord"("actionType");
CREATE INDEX "OfflineSyncRecord_status_idx" ON "OfflineSyncRecord"("status");
CREATE INDEX "OfflineSyncRecord_actorUserId_idx" ON "OfflineSyncRecord"("actorUserId");
CREATE INDEX "OfflineSyncRecord_createdAt_idx" ON "OfflineSyncRecord"("createdAt");
CREATE INDEX "OfflineSyncRecord_processedAt_idx" ON "OfflineSyncRecord"("processedAt");
