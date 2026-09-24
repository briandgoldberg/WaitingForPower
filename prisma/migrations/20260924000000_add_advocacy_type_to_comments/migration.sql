-- AlterTable
ALTER TABLE "ProjectComment" ADD COLUMN     "advocacyType" TEXT,
ADD COLUMN     "hearingDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ProjectComment_advocacyType_createdAt_idx" ON "ProjectComment"("advocacyType", "createdAt");
