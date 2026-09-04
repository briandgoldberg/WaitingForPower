-- New nullable column only — additive, no data loss risk.
ALTER TABLE "Project" ADD COLUMN "poiCostUsd" DOUBLE PRECISION;
