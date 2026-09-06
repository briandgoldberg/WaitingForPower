-- Replaces the single commentPeriodStart/commentPeriodEnd fields with a
-- proper one-to-many ProjectHearing table (a project can genuinely have
-- more than one real upcoming hearing — see schema.prisma comments) and
-- renames commentLink to hearingDetailsLink to match the site's new
-- "hearing details" framing (see product decision: most sources' links are
-- hearing logistics, not an online comment-submission form).
ALTER TABLE "Project" RENAME COLUMN "commentLink" TO "hearingDetailsLink";
ALTER TABLE "Project" DROP COLUMN "commentPeriodStart";
ALTER TABLE "Project" DROP COLUMN "commentPeriodEnd";

CREATE TABLE "ProjectHearing" (
  "id" SERIAL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "label" TEXT,
  CONSTRAINT "ProjectHearing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectHearing_projectId_idx" ON "ProjectHearing"("projectId");
CREATE INDEX "ProjectHearing_date_idx" ON "ProjectHearing"("date");
