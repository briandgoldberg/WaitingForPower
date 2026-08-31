-- AlterTable
ALTER TABLE "Project" ADD COLUMN "applicant" TEXT;
ALTER TABLE "Project" ADD COLUMN "expectedOnlineDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "expectedOnlineDateConfidence" TEXT;
