-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "mergedIntoId" TEXT;

-- CreateIndex
CREATE INDEX "Project_mergedIntoId_idx" ON "Project"("mergedIntoId");
