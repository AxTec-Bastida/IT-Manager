-- CreateTable
CREATE TABLE "AssetLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanNumber" TEXT NOT NULL,
    "employeeId" TEXT,
    "temporaryBorrowerId" TEXT,
    "loanedBy" TEXT,
    "loanStartAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnAt" DATETIME NOT NULL,
    "actualReturnAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "signatureData" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "termsText" TEXT,
    "checkoutNotes" TEXT,
    "returnNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetLoan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssetLoan_temporaryBorrowerId_fkey" FOREIGN KEY ("temporaryBorrowerId") REFERENCES "TemporaryBorrower" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetLoanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "conditionOut" TEXT,
    "conditionIn" TEXT,
    "accessoriesOut" TEXT,
    "accessoriesReturned" TEXT,
    "returnStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "returnNotes" TEXT,
    "returnedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetLoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "AssetLoan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetLoanItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetLoan_loanNumber_key" ON "AssetLoan"("loanNumber");
CREATE INDEX "AssetLoan_loanNumber_idx" ON "AssetLoan"("loanNumber");
CREATE INDEX "AssetLoan_employeeId_idx" ON "AssetLoan"("employeeId");
CREATE INDEX "AssetLoan_temporaryBorrowerId_idx" ON "AssetLoan"("temporaryBorrowerId");
CREATE INDEX "AssetLoan_status_idx" ON "AssetLoan"("status");
CREATE INDEX "AssetLoan_loanStartAt_idx" ON "AssetLoan"("loanStartAt");
CREATE INDEX "AssetLoan_expectedReturnAt_idx" ON "AssetLoan"("expectedReturnAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLoanItem_loanId_deviceId_key" ON "AssetLoanItem"("loanId", "deviceId");
CREATE INDEX "AssetLoanItem_loanId_idx" ON "AssetLoanItem"("loanId");
CREATE INDEX "AssetLoanItem_deviceId_idx" ON "AssetLoanItem"("deviceId");
CREATE INDEX "AssetLoanItem_returnStatus_idx" ON "AssetLoanItem"("returnStatus");
CREATE INDEX "AssetLoanItem_returnedAt_idx" ON "AssetLoanItem"("returnedAt");
