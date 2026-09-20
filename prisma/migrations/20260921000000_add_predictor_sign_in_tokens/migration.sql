-- CreateTable
CREATE TABLE "PredictorSignInToken" (
    "id" TEXT NOT NULL,
    "predictorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PredictorSignInToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PredictorSignInToken_token_key" ON "PredictorSignInToken"("token");

-- CreateIndex
CREATE INDEX "PredictorSignInToken_predictorId_createdAt_idx" ON "PredictorSignInToken"("predictorId", "createdAt");

-- AddForeignKey
ALTER TABLE "PredictorSignInToken" ADD CONSTRAINT "PredictorSignInToken_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "Predictor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

