-- AlterTable
ALTER TABLE "Predictor" ADD COLUMN     "identityDecidedAt" TIMESTAMP(3);


-- Everyone who has already posted keeps their posts public.
UPDATE "Predictor" SET "identityDecidedAt" = "createdAt" WHERE "agentName" IS NULL;
