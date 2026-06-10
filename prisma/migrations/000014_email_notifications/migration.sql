-- SQLite stores Prisma enum values as TEXT, so adding EmailLog enums requires no enum DDL.

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "messageId" TEXT,
    "relatedDeviceId" TEXT,
    "assignmentId" TEXT,
    "assetLoanId" TEXT,
    "stockIssueId" TEXT,
    "rmaCaseId" TEXT,
    "alertId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_relatedDeviceId_fkey" FOREIGN KEY ("relatedDeviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_assetLoanId_fkey" FOREIGN KEY ("assetLoanId") REFERENCES "AssetLoan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_stockIssueId_fkey" FOREIGN KEY ("stockIssueId") REFERENCES "StockIssue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_rmaCaseId_fkey" FOREIGN KEY ("rmaCaseId") REFERENCES "RmaCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EmailLog_type_idx" ON "EmailLog"("type");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_recipient_idx" ON "EmailLog"("recipient");
CREATE INDEX "EmailLog_relatedDeviceId_idx" ON "EmailLog"("relatedDeviceId");
CREATE INDEX "EmailLog_assignmentId_idx" ON "EmailLog"("assignmentId");
CREATE INDEX "EmailLog_assetLoanId_idx" ON "EmailLog"("assetLoanId");
CREATE INDEX "EmailLog_stockIssueId_idx" ON "EmailLog"("stockIssueId");
CREATE INDEX "EmailLog_rmaCaseId_idx" ON "EmailLog"("rmaCaseId");
CREATE INDEX "EmailLog_alertId_idx" ON "EmailLog"("alertId");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

ALTER TABLE "AppSettings" ADD COLUMN "autoSendAssignmentReceipts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "autoSendAssetLoanReceipts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "autoSendStockIssueReceipts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "autoSendRmaEmails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "autoSendReturnConfirmations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "autoSendOverdueReminderEmails" BOOLEAN NOT NULL DEFAULT false;
