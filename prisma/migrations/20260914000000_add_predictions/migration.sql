-- Prediction game: humans (anonymous key, upgradeable to a verified email)
-- and agents (self-declared name via MCP) guess when a project will
-- resolve. See schema.prisma model comments for the full design.

CREATE TABLE "Predictor" (
    "id" TEXT NOT NULL,
    "anonymousKey" TEXT,
    "agentName" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Predictor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Predictor_identity_check" CHECK ("anonymousKey" IS NOT NULL OR "agentName" IS NOT NULL)
);

CREATE UNIQUE INDEX "Predictor_anonymousKey_key" ON "Predictor"("anonymousKey");
CREATE UNIQUE INDEX "Predictor_agentName_key" ON "Predictor"("agentName");
CREATE UNIQUE INDEX "Predictor_email_key" ON "Predictor"("email");
CREATE INDEX "Predictor_email_idx" ON "Predictor"("email");

CREATE TABLE "PredictorEmailVerification" (
    "id" TEXT NOT NULL,
    "predictorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "PredictorEmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredictorEmailVerification_token_key" ON "PredictorEmailVerification"("token");
CREATE INDEX "PredictorEmailVerification_predictorId_idx" ON "PredictorEmailVerification"("predictorId");

ALTER TABLE "PredictorEmailVerification" ADD CONSTRAINT "PredictorEmailVerification_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "Predictor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "predictorId" TEXT NOT NULL,
    "predictedDate" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "daysOff" INTEGER,
    "scoredAt" TIMESTAMP(3),

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Prediction_projectId_predictorId_key" ON "Prediction"("projectId", "predictorId");
CREATE INDEX "Prediction_projectId_idx" ON "Prediction"("projectId");
CREATE INDEX "Prediction_predictorId_idx" ON "Prediction"("predictorId");

ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "Predictor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
