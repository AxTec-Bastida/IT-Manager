CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "running" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT,
    "type" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "summaryJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ScheduledJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ScheduledJob_type_idx" ON "ScheduledJob"("type");
CREATE INDEX "ScheduledJob_enabled_idx" ON "ScheduledJob"("enabled");
CREATE INDEX "ScheduledJob_nextRunAt_idx" ON "ScheduledJob"("nextRunAt");
CREATE INDEX "ScheduledJob_running_idx" ON "ScheduledJob"("running");
CREATE INDEX "JobRun_scheduleId_idx" ON "JobRun"("scheduleId");
CREATE INDEX "JobRun_type_idx" ON "JobRun"("type");
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");
