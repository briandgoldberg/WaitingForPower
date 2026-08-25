-- AlterTable
ALTER TABLE "Project" ADD COLUMN "noLongerReported" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Project_noLongerReported_idx" ON "Project"("noLongerReported");

-- CreateTable
CREATE TABLE "ProjectChange" (
    "id" SERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "changeTypes" TEXT[],
    "previousStage" TEXT,
    "newStage" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectChange_projectId_idx" ON "ProjectChange"("projectId");

-- CreateIndex
CREATE INDEX "ProjectChange_createdAt_idx" ON "ProjectChange"("createdAt");

-- AddForeignKey
ALTER TABLE "ProjectChange" ADD CONSTRAINT "ProjectChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
