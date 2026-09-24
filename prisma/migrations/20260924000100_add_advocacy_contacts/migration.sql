-- CreateTable
CREATE TABLE "AdvocacyContact" (
    "id" TEXT NOT NULL,
    "predictorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "targetName" TEXT,
    "issues" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvocacyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvocacyContact_predictorId_createdAt_idx" ON "AdvocacyContact"("predictorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvocacyContact_createdAt_idx" ON "AdvocacyContact"("createdAt");

-- AddForeignKey
ALTER TABLE "AdvocacyContact" ADD CONSTRAINT "AdvocacyContact_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "Predictor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
