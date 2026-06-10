ALTER TABLE "StockItem" ADD COLUMN "barcodeValue" TEXT;

CREATE TABLE "TemporaryBorrower" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tempId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department" TEXT,
  "area" TEXT,
  "supervisorName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "StockIssue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "issueNumber" TEXT,
  "stockItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
  "issueType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "employeeId" TEXT,
  "temporaryBorrowerId" TEXT,
  "issuedBy" TEXT,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" DATETIME,
  "returnedAt" DATETIME,
  "conditionOut" TEXT,
  "conditionIn" TEXT,
  "returnNotes" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StockIssue_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockIssue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StockIssue_temporaryBorrowerId_fkey" FOREIGN KEY ("temporaryBorrowerId") REFERENCES "TemporaryBorrower" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_StockMovement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stockItemId" TEXT NOT NULL,
  "assetId" TEXT,
  "employeeId" TEXT,
  "temporaryBorrowerId" TEXT,
  "stockIssueId" TEXT,
  "movementType" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "previousQuantity" INTEGER NOT NULL,
  "newQuantity" INTEGER NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "performedBy" TEXT,
  "facturaId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_temporaryBorrowerId_fkey" FOREIGN KEY ("temporaryBorrowerId") REFERENCES "TemporaryBorrower" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_stockIssueId_fkey" FOREIGN KEY ("stockIssueId") REFERENCES "StockIssue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_StockMovement" ("assetId", "createdAt", "employeeId", "facturaId", "id", "movementType", "newQuantity", "notes", "performedBy", "previousQuantity", "quantity", "reason", "stockItemId")
SELECT "assetId", "createdAt", "employeeId", "facturaId", "id", "movementType", "newQuantity", "notes", "performedBy", "previousQuantity", "quantity", "reason", "stockItemId"
FROM "StockMovement";

DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "StockItem_barcodeValue_key" ON "StockItem" ("barcodeValue");
CREATE INDEX "StockItem_barcodeValue_idx" ON "StockItem" ("barcodeValue");

CREATE UNIQUE INDEX "TemporaryBorrower_tempId_key" ON "TemporaryBorrower" ("tempId");
CREATE INDEX "TemporaryBorrower_tempId_idx" ON "TemporaryBorrower" ("tempId");
CREATE INDEX "TemporaryBorrower_name_idx" ON "TemporaryBorrower" ("name");
CREATE INDEX "TemporaryBorrower_department_idx" ON "TemporaryBorrower" ("department");
CREATE INDEX "TemporaryBorrower_area_idx" ON "TemporaryBorrower" ("area");
CREATE INDEX "TemporaryBorrower_active_idx" ON "TemporaryBorrower" ("active");

CREATE UNIQUE INDEX "StockIssue_issueNumber_key" ON "StockIssue" ("issueNumber");
CREATE INDEX "StockIssue_stockItemId_idx" ON "StockIssue" ("stockItemId");
CREATE INDEX "StockIssue_issueType_idx" ON "StockIssue" ("issueType");
CREATE INDEX "StockIssue_status_idx" ON "StockIssue" ("status");
CREATE INDEX "StockIssue_employeeId_idx" ON "StockIssue" ("employeeId");
CREATE INDEX "StockIssue_temporaryBorrowerId_idx" ON "StockIssue" ("temporaryBorrowerId");
CREATE INDEX "StockIssue_issuedAt_idx" ON "StockIssue" ("issuedAt");
CREATE INDEX "StockIssue_expectedReturnAt_idx" ON "StockIssue" ("expectedReturnAt");

CREATE INDEX "StockMovement_stockItemId_idx" ON "StockMovement" ("stockItemId");
CREATE INDEX "StockMovement_assetId_idx" ON "StockMovement" ("assetId");
CREATE INDEX "StockMovement_employeeId_idx" ON "StockMovement" ("employeeId");
CREATE INDEX "StockMovement_temporaryBorrowerId_idx" ON "StockMovement" ("temporaryBorrowerId");
CREATE INDEX "StockMovement_stockIssueId_idx" ON "StockMovement" ("stockIssueId");
CREATE INDEX "StockMovement_movementType_idx" ON "StockMovement" ("movementType");
CREATE INDEX "StockMovement_facturaId_idx" ON "StockMovement" ("facturaId");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement" ("createdAt");
