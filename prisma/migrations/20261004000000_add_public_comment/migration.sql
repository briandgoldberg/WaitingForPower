-- CreateTable
CREATE TABLE "PublicComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filedDate" TIMESTAMP(3) NOT NULL,
    "filerName" TEXT,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "docketLabel" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicComment_projectId_sourceUrl_key" ON "PublicComment"("projectId", "sourceUrl");

-- CreateIndex
CREATE INDEX "PublicComment_projectId_filedDate_idx" ON "PublicComment"("projectId", "filedDate");

-- CreateIndex
CREATE INDEX "PublicComment_filedDate_idx" ON "PublicComment"("filedDate");

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
