-- Adds one-time LLM-researched fields (see Project model comments in
-- schema.prisma): reasons for/against building the project, the most
-- recently on-record public comment window, how to submit a comment, and a
-- researchedAt gate that keeps the research cron from ever re-running once
-- a project has been processed.
ALTER TABLE "Project"
  ADD COLUMN "reasonsFor" JSONB,
  ADD COLUMN "reasonsAgainst" JSONB,
  ADD COLUMN "commentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "commentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "commentLink" TEXT,
  ADD COLUMN "researchedAt" TIMESTAMP(3);

CREATE INDEX "Project_researchedAt_idx" ON "Project"("researchedAt");
