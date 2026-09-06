-- Tracks which real-world hearings have already been auto-posted to which
-- social platform. Keyed on (projectId, date, platform) rather than a
-- ProjectHearing row's own id, since that id isn't stable across
-- ingestion runs (see schema.prisma's HearingSocialPost comment).
CREATE TABLE "HearingSocialPost" (
  "id" SERIAL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "platform" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HearingSocialPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "HearingSocialPost_projectId_date_platform_key" ON "HearingSocialPost"("projectId", "date", "platform");
CREATE INDEX "HearingSocialPost_projectId_idx" ON "HearingSocialPost"("projectId");
