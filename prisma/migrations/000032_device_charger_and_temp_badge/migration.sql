ALTER TABLE "Device" ADD COLUMN "chargerStatus" TEXT DEFAULT 'HEALTHY';
ALTER TABLE "Device" ADD COLUMN "chargerNotes" TEXT;

ALTER TABLE "TemporaryBorrower" ADD COLUMN "badgeId" TEXT;
ALTER TABLE "TemporaryBorrower" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "TemporaryBorrower_badgeId_idx" ON "TemporaryBorrower"("badgeId");
