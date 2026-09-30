-- CreateTable
CREATE TABLE "ProjectOpposition" (
    "id" SERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "sourceLabel" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "verifiedOn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOpposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectOpposition_projectId_idx" ON "ProjectOpposition"("projectId");

-- CreateIndex
CREATE INDEX "ProjectOpposition_kind_idx" ON "ProjectOpposition"("kind");

-- AddForeignKey
ALTER TABLE "ProjectOpposition" ADD CONSTRAINT "ProjectOpposition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing local_state_opposition tag was an ingest default meaning
-- "before a state or local regulator", not evidence of opposition. Retag
-- them now rather than waiting for each source's next run.
UPDATE "ProjectCause" SET "causeSlug" = 'state_local_review' WHERE "causeSlug" = 'local_state_opposition';
