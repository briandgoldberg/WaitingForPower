-- Reverts the LLM-synthesized reasonsFor/reasonsAgainst fields and the
-- researchedAt one-time gate (see prior migration
-- 20260904170000_add_project_research) — no rows ever had real data in
-- these (no ANTHROPIC_API_KEY was ever configured), and the approach was
-- dropped in favor of free, structured per-source extraction instead.
-- commentPeriodStart/commentPeriodEnd/commentLink are kept — see
-- schema.prisma's updated Project model comments for their new sourcing.
DROP INDEX IF EXISTS "Project_researchedAt_idx";

ALTER TABLE "Project"
  DROP COLUMN "reasonsFor",
  DROP COLUMN "reasonsAgainst",
  DROP COLUMN "researchedAt";
