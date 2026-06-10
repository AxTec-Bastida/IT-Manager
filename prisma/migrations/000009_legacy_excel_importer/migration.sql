-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'LEGACY_XLSX',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "summaryJson" TEXT,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "ImportRowError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importRunId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRowError_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportRun_sourceType_idx" ON "ImportRun"("sourceType");

-- CreateIndex
CREATE INDEX "ImportRun_status_idx" ON "ImportRun"("status");

-- CreateIndex
CREATE INDEX "ImportRun_startedAt_idx" ON "ImportRun"("startedAt");

-- CreateIndex
CREATE INDEX "ImportRowError_importRunId_idx" ON "ImportRowError"("importRunId");

-- CreateIndex
CREATE INDEX "ImportRowError_sheetName_idx" ON "ImportRowError"("sheetName");

-- CreateIndex
CREATE INDEX "ImportRowError_errorType_idx" ON "ImportRowError"("errorType");
