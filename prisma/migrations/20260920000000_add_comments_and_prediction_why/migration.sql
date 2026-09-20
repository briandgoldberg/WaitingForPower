-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "why" TEXT;

-- CreateTable
CREATE TABLE "ProjectComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "predictorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectComment_projectId_createdAt_idx" ON "ProjectComment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectComment_createdAt_idx" ON "ProjectComment"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectComment_predictorId_createdAt_idx" ON "ProjectComment"("predictorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "Predictor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

