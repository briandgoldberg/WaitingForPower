-- AlterTable
ALTER TABLE "Predictor" ADD COLUMN     "nameChosenAt" TIMESTAMP(3);


-- Existing people who already chose a name keep it.
UPDATE "Predictor" SET "nameChosenAt" = "createdAt" WHERE "displayName" IS NOT NULL AND "agentName" IS NULL;
