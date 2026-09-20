-- AlterTable
ALTER TABLE "ProjectComment" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "predictionId" TEXT;

-- CreateTable
CREATE TABLE "ThreadLike" (
    "id" TEXT NOT NULL,
    "predictorId" TEXT NOT NULL,
    "commentId" TEXT,
    "predictionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThreadLike_commentId_idx" ON "ThreadLike"("commentId");

-- CreateIndex
CREATE INDEX "ThreadLike_predictionId_idx" ON "ThreadLike"("predictionId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadLike_predictorId_commentId_key" ON "ThreadLike"("predictorId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadLike_predictorId_predictionId_key" ON "ThreadLike"("predictorId", "predictionId");

-- CreateIndex
CREATE INDEX "ProjectComment_parentId_idx" ON "ProjectComment"("parentId");

-- CreateIndex
CREATE INDEX "ProjectComment_predictionId_idx" ON "ProjectComment"("predictionId");

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadLike" ADD CONSTRAINT "ThreadLike_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "Predictor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadLike" ADD CONSTRAINT "ThreadLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ProjectComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadLike" ADD CONSTRAINT "ThreadLike_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

