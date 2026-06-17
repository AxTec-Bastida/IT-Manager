-- Add optional factura XML attachment and parsed metadata fields.
ALTER TABLE "Factura" ADD COLUMN "xmlPath" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlFilename" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlOriginalName" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlMimeType" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlSizeBytes" INTEGER;
ALTER TABLE "Factura" ADD COLUMN "xmlUploadedAt" DATETIME;
ALTER TABLE "Factura" ADD COLUMN "xmlUuid" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlSerie" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlFolio" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlIssuedAt" DATETIME;
ALTER TABLE "Factura" ADD COLUMN "xmlCurrency" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlSubtotal" REAL;
ALTER TABLE "Factura" ADD COLUMN "xmlTotal" REAL;
ALTER TABLE "Factura" ADD COLUMN "xmlEmisorName" TEXT;
ALTER TABLE "Factura" ADD COLUMN "xmlEmisorRfc" TEXT;

CREATE INDEX "Factura_xmlUuid_idx" ON "Factura"("xmlUuid");
CREATE INDEX "Factura_xmlFolio_idx" ON "Factura"("xmlFolio");
CREATE INDEX "Factura_xmlUploadedAt_idx" ON "Factura"("xmlUploadedAt");
