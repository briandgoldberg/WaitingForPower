-- New nullable columns only — additive, no data loss risk.
ALTER TABLE "Project" ADD COLUMN "queueCluster" TEXT;
ALTER TABLE "Project" ADD COLUMN "pointOfInterconnection" TEXT;
