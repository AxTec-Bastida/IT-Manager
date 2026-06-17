CREATE TABLE "FacturaExtractionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facturaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "createdLineItemCount" INTEGER NOT NULL DEFAULT 0,
    "warningsJson" TEXT,
    "performedByUserId" TEXT,
    "performedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacturaExtractionAttempt_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FacturaExtractionAttempt_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "AppUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "FacturaExtractionAttempt_facturaId_idx" ON "FacturaExtractionAttempt"("facturaId");
CREATE INDEX "FacturaExtractionAttempt_status_idx" ON "FacturaExtractionAttempt"("status");
CREATE INDEX "FacturaExtractionAttempt_performedByUserId_idx" ON "FacturaExtractionAttempt"("performedByUserId");
CREATE INDEX "FacturaExtractionAttempt_createdAt_idx" ON "FacturaExtractionAttempt"("createdAt");
