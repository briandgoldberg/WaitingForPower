-- New nullable columns only — additive, no data loss risk. Applied by hand
-- via `prisma db execute` + `prisma migrate resolve --applied` rather than
-- `prisma migrate dev`, since this shared dev+prod database has known drift
-- against the local migration history (a pre-existing gap, not caused by
-- this change) that makes `migrate dev` want to reset the whole schema.
ALTER TABLE "Project" ADD COLUMN "balancingAuthority" TEXT;
ALTER TABLE "Project" ADD COLUMN "ownerSector" TEXT;
ALTER TABLE "Project" ADD COLUMN "netSummerCapacityMw" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "netWinterCapacityMw" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "primeMoverCode" TEXT;
