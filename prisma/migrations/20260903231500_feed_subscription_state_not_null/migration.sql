-- FeedSubscription.state was created nullable moments ago (previous
-- migration, still 0 rows, never shipped) but Prisma's generated
-- findUnique/upsert input for the compound @@unique([email, state]) rejects
-- null for a nullable field in that key — Postgres unique indexes don't
-- treat multiple NULLs as duplicates, so a "unique" lookup by null isn't
-- reliable. Using "" as the "every state" sentinel instead.
UPDATE "FeedSubscription" SET "state" = '' WHERE "state" IS NULL;
ALTER TABLE "FeedSubscription" ALTER COLUMN "state" SET NOT NULL;
ALTER TABLE "FeedSubscription" ALTER COLUMN "state" SET DEFAULT '';
