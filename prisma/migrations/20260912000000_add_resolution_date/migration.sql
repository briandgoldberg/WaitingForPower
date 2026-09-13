-- Real, source-extracted resolution date (approval/cancellation/etc.),
-- distinct from ProjectChange.createdAt which only records when our own
-- cron run happened to notice the change. Null until an ingest module is
-- wired to extract one for that project's source.
ALTER TABLE "Project" ADD COLUMN "resolutionDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "resolutionDateConfidence" TEXT;
