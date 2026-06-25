-- Phase 90B: Admin Center / Master Data / Controlled Lists
-- ControlledValue table was applied directly to dev.db during Phase 90B schema generation.
-- This migration records the schema additions for audit trail and production deploy.

CREATE TABLE IF NOT EXISTS "ControlledValue" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "type"           TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description"    TEXT,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"      INTEGER,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlledValue_type_normalizedName_key" ON "ControlledValue"("type", "normalizedName");
CREATE INDEX IF NOT EXISTS "ControlledValue_type_idx" ON "ControlledValue"("type");
CREATE INDEX IF NOT EXISTS "ControlledValue_isActive_idx" ON "ControlledValue"("isActive");

-- ToolLink: requiresCredentials field (already in dev.db via Phase 90B generate)
-- SQLite does not support IF NOT EXISTS on ALTER TABLE ADD COLUMN.
-- This column is already present in dev.db. Production deploy uses safe ADD COLUMN.
ALTER TABLE "ToolLink" ADD COLUMN "requiresCredentials" BOOLEAN NOT NULL DEFAULT false;
