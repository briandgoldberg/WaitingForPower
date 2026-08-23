// Shared types and helpers for all ingestion modules. Each module in this
// directory normalizes one external data source into `NormalizedProject`,
// which `upsertNormalizedProject` then writes into the Prisma schema.
//
// IDENTITY MATCHING (the hardest part, per the project brief): EIA, the
// Permitting Dashboard, and LBNL each use their own project names/IDs for
// what may be the same physical project (e.g. a transmission line might be
// "Grain Belt Express Transmission - Phase 1" on the Permitting Dashboard
// and something else entirely in an ISO interconnection queue). v1 does NOT
// attempt automated fuzzy-matching/deduplication across sources — that's
// flagged as an open question in README.md rather than guessed at with a
// name-similarity heuristic that would silently merge or split real
// projects incorrectly. Instead:
//   - Each source's ingestion module tags every project with its own
//     `externalIds` (source name + source's own ID) so matches can be added
//     deliberately later.
//   - `manualOverrides.ts` (CSV or inline) lets a human explicitly declare
//     "EIA plant 12345 generator 1 == Permitting Dashboard project 71536 ==
//     LBNL queue id Q4821" via a shared `matchKey`. Only projects sharing a
//     manually-assigned `matchKey` are ever merged into one Project row.

import { prisma } from "@/lib/db";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { RESOLVED_STAGES } from "@/lib/data/taxonomies";

export interface NormalizedSource {
  label: string;
  url: string;
}

export interface NormalizedMilestone {
  date: Date;
  dateConfidence?: "exact" | "approximate";
  stage: string;
  description: string;
}

export interface NormalizedProject {
  /**
   * Stable identity key for this project. If a manual override maps this
   * source record to a shared `matchKey`, use that; otherwise fall back to
   * `${sourceName}:${sourceId}` so records from a single source are at
   * least internally deduplicated across repeated ingestion runs.
   */
  matchKey: string;
  name: string;
  projectType: ProjectType;
  fuelType: FuelType;
  lat?: number | null;
  lon?: number | null;
  state?: string | null;
  county?: string | null;
  capacityValue?: number | null;
  capacityUnit?: string | null;
  applicationFiledDate?: Date | null;
  dateConfidence?: "exact" | "approximate";
  currentStatus: string;
  currentStage: ProjectStage;
  causeSlugs: CauseSlug[];
  causeDetail: string;
  /** Interconnection-queue-source-specific stage detail — see schema.prisma. */
  interconnectionQueueStage?: string | null;
  /** Preliminary network-upgrade cost estimate in USD — see schema.prisma. */
  networkUpgradeCostUsd?: number | null;
  isAggregateExample?: boolean;
  estimatedMwDelayed?: number | null;
  dataQualityNote?: string | null;
  sources: NormalizedSource[];
  milestones?: NormalizedMilestone[];
  /** e.g. { eia: "plantid-generatorid", permittingDashboard: "71536" } */
  externalIds: Record<string, string>;
}

// The suffix (derived from matchKey) is what actually guarantees
// uniqueness when two projects share a name — it must never be truncated
// away. Confirmed live 2026-08-15: LBNL entity names can be full utility
// legal names (e.g. "Southern Indiana Gas & Electric Company d/b/a Vectren
// Energy Delivery of Indiana, Inc."), long enough that the old
// `${base}-${suffix}`.slice(0, 90) truncated the suffix off entirely,
// collapsing every interconnection request for that entity onto one slug —
// concurrent upserts for the "same" (colliding) project then raced on the
// cause-tags delete/insert step and silently overwrote each other's data.
// Reserve room for the suffix first, then fit as much of the base as
// remains.
function slugify(name: string, matchKey: string): string {
  const suffix = matchKey.slice(-6).replace(/[^a-z0-9]/gi, "");
  const maxBaseLength = Math.max(90 - 1 - suffix.length, 1);
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, maxBaseLength);
  return `${base}-${suffix}`;
}

/**
 * Upserts a normalized project keyed by `matchKey` — the real cross-source
 * identity (see the Project.matchKey schema comment): `${source}:${sourceId}`
 * by default, or a shared value manualOverrides.csv assigns when two
 * different sources track the same physical project, in which case both
 * sources' calls land on the same row. Verified/ingested projects always
 * get verificationStatus="verified" — this path is never used for user
 * submissions (see src/app/api/submissions).
 *
 * LEGACY-ROW FALLBACK: every project ingested before the matchKey column
 * existed has matchKey=NULL in the database — a plain matchKey lookup can
 * never find them, and naively falling through to `create` would collide
 * with that row's already-existing `slug` (a real bug hit and fixed
 * 2026-08-23: re-running permittingDashboard.ts against the live DB right
 * after adding this column threw a unique-constraint error on `slug` for
 * every one of its ~33 previously-tracked projects). There's no reliable
 * way to reconstruct a legacy row's original matchKey from what's stored
 * (externalIds was never persisted to the Project table), so instead: fall
 * back to a slug lookup, and if that finds the row, adopt it by writing its
 * real matchKey for the first time. This makes every previously-tracked
 * project self-heal exactly once, the next time its own source naturally
 * re-ingests it, without a separate backfill migration script.
 *
 * RESOLVED_STAGES ENFORCEMENT: if `p.currentStage` is one of
 * RESOLVED_STAGES (approved/under construction/cancelled/completed — see
 * taxonomies.ts), this site doesn't track it. Rather than silently
 * declining to create it (which would leave a stale row behind for a
 * project a *previous* ingestion run had tracked as still-waiting, now
 * that it's cleared/cancelled/finished), this deletes any existing row
 * (matched the same matchKey-then-slug-fallback way as above) and returns
 * null without creating a new one — so a project that transitions out of
 * "waiting" between ingestion runs disappears from the site rather than
 * freezing in its last-known waiting state.
 */
export async function upsertNormalizedProject(p: NormalizedProject) {
  // Slug is only computed once, at creation, from whichever source's
  // normalizeX() call happens to create the row first; it deliberately
  // never changes after that so a project's URL stays stable even as later
  // updates (from the same source, or a different source sharing its
  // matchKey) change its display name.
  const slug = slugify(p.name, p.matchKey);

  const existing =
    (await prisma.project.findUnique({ where: { matchKey: p.matchKey } })) ??
    (await prisma.project.findUnique({ where: { slug } }));

  if (RESOLVED_STAGES.includes(p.currentStage)) {
    if (existing) await prisma.project.delete({ where: { id: existing.id } });
    return null;
  }

  const fields = {
    name: p.name,
    projectType: p.projectType,
    fuelType: p.fuelType,
    lat: p.lat ?? null,
    lon: p.lon ?? null,
    state: p.state ?? null,
    county: p.county ?? null,
    capacityValue: p.capacityValue ?? null,
    capacityUnit: p.capacityUnit ?? null,
    applicationFiledDate: p.applicationFiledDate ?? null,
    dateConfidence: p.dateConfidence ?? "exact",
    currentStatus: p.currentStatus,
    currentStage: p.currentStage,
    causeDetail: p.causeDetail,
    interconnectionQueueStage: p.interconnectionQueueStage ?? null,
    networkUpgradeCostUsd: p.networkUpgradeCostUsd ?? null,
    isAggregateExample: p.isAggregateExample ?? false,
    estimatedMwDelayed: p.estimatedMwDelayed ?? null,
    dataQualityNote: p.dataQualityNote ?? null,
  };

  const project = existing
    ? await prisma.project.update({
        where: { id: existing.id },
        data: { ...fields, matchKey: p.matchKey },
      })
    : await prisma.project.create({
        data: { ...fields, slug, matchKey: p.matchKey, verificationStatus: "verified" },
      });

  await prisma.projectCause.deleteMany({ where: { projectId: project.id } });
  await prisma.projectCause.createMany({
    data: p.causeSlugs.map((causeSlug) => ({ projectId: project.id, causeSlug })),
  });

  // Upsert-by-(projectId, label) rather than delete-all-then-recreate: when
  // two different ingestion sources share a matchKey (manualOverrides.csv —
  // the same physical project tracked by two agencies), each source's own
  // update run must only touch its OWN source link, not wipe the other
  // source's link that a prior run already wrote. A single source's own
  // repeated runs still correctly update (not duplicate) its one link,
  // since its own label is stable across runs.
  for (const s of p.sources) {
    await prisma.projectSource.upsert({
      where: { projectId_label: { projectId: project.id, label: s.label } },
      create: { projectId: project.id, label: s.label, url: s.url },
      update: { url: s.url },
    });
  }

  if (p.milestones && p.milestones.length > 0) {
    await prisma.milestone.deleteMany({ where: { projectId: project.id } });
    await prisma.milestone.createMany({
      data: p.milestones.map((m) => ({
        projectId: project.id,
        date: m.date,
        dateConfidence: m.dateConfidence ?? "exact",
        stage: m.stage,
        description: m.description,
      })),
    });
  }

  return project;
}

/**
 * Upserts many projects with limited concurrency instead of one at a time.
 * `upsertNormalizedProject` does ~5 sequential DB round trips per project;
 * run fully sequentially, a few hundred projects takes minutes — too slow
 * for a serverless function's execution time limit (see the EIA-860M cron
 * route, src/app/api/cron/ingest-eia/route.ts). Running a bounded number of
 * projects concurrently instead cuts that to seconds, without opening so
 * many connections at once that the database chokes.
 */
export async function upsertNormalizedProjects(
  projects: NormalizedProject[],
  concurrency = 40,
): Promise<{ upserted: number; removedResolved: number; errors: { matchKey: string; message: string }[] }> {
  let upserted = 0;
  let removedResolved = 0;
  const errors: { matchKey: string; message: string }[] = [];

  for (let i = 0; i < projects.length; i += concurrency) {
    const batch = projects.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((p) => upsertNormalizedProject(p)));
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        // null means RESOLVED_STAGES caught this one — see
        // upsertNormalizedProject: it was deleted (or never existed), not
        // created/updated, so it shouldn't count toward "upserted".
        if (result.value === null) {
          removedResolved += 1;
        } else {
          upserted += 1;
        }
      } else {
        errors.push({ matchKey: batch[j].matchKey, message: String(result.reason) });
      }
    }
  }

  return { upserted, removedResolved, errors };
}
