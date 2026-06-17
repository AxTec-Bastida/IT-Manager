ALTER TABLE "MaintenanceRecord" ADD COLUMN "result" TEXT NOT NULL DEFAULT 'PASS';
ALTER TABLE "MaintenanceRecord" ADD COLUMN "vendorTicket" TEXT;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "testWeight" TEXT;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "measuredValue" TEXT;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "expectedValue" TEXT;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "resultDetails" TEXT;

CREATE INDEX "MaintenanceRecord_result_idx" ON "MaintenanceRecord"("result");
