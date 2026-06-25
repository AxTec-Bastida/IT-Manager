-- Phase 90C: Inventory Intake / Charger Tracking
-- Adds chargerIncluded Boolean? to Device.
-- Nullable with no default: existing records get NULL (unset).
-- Intake form sets true for LAPTOP by default; user can uncheck.

ALTER TABLE "Device" ADD COLUMN "chargerIncluded" BOOLEAN;
