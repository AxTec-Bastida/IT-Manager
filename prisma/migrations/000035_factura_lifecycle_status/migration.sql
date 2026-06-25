-- Add a safe lifecycle state for hiding broken/test/invalid facturas without deleting linked history.
ALTER TABLE "Factura" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX "Factura_status_idx" ON "Factura"("status");
