-- CreateTable
CREATE TABLE "IngestSourceBackfill" (
    "sourcePrefix" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestSourceBackfill_pkey" PRIMARY KEY ("sourcePrefix")
);
