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
import { PROJECT_STAGE_BY_VALUE, RESOLVED_STAGES } from "@/lib/data/taxonomies";

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

// Small, fixed, code-reviewed vocabulary — see ProjectChange.changeTypes in
// schema.prisma. Kept as a type here (not re-derived from the DB) since
// it's also what buildChangeSummary below switches on.
export type ChangeType = "new" | "advanced" | "resolved" | "fact_revised" | "new_filing" | "no_longer_reported" | "reappeared";

// Turns a bundle of changeTypes detected for one project in one run into
// the pre-rendered feed sentence stored on ProjectChange.summary — see the
// homepage changes feed. Order here is deliberately fixed (most
// significant first) rather than the order changeTypes happened to be
// pushed in, so "New project — Advanced to X" always reads the same way
// regardless of which detection branch fired first.
function buildChangeSummary(
  changeTypes: ChangeType[],
  detail: {
    previousStage: ProjectStage | null;
    newStage: ProjectStage;
    previousCapacityValue: number | null;
    newCapacityValue: number | null;
    capacityUnit: string | null;
    newFilingDescriptions: string[];
  },
): string {
  const parts: string[] = [];
  if (changeTypes.includes("new")) {
    parts.push("New project discovered");
  }
  if (changeTypes.includes("resolved")) {
    parts.push(`Resolved: ${PROJECT_STAGE_BY_VALUE[detail.newStage]}`);
  } else if (changeTypes.includes("advanced")) {
    const from = detail.previousStage ? PROJECT_STAGE_BY_VALUE[detail.previousStage] : "an earlier stage";
    parts.push(`Advanced from ${from} to ${PROJECT_STAGE_BY_VALUE[detail.newStage]}`);
  }
  if (changeTypes.includes("fact_revised")) {
    const unit = detail.capacityUnit ?? "";
    if (detail.previousCapacityValue == null && detail.newCapacityValue != null) {
      parts.push(`Capacity disclosed: ${detail.newCapacityValue.toLocaleString("en-US")} ${unit}`.trim());
    } else if (detail.newCapacityValue != null) {
      parts.push(`Capacity revised to ${detail.newCapacityValue.toLocaleString("en-US")} ${unit}`.trim());
    }
  }
  if (changeTypes.includes("new_filing")) {
    const list = detail.newFilingDescriptions.slice(0, 3).join("; ");
    parts.push(detail.newFilingDescriptions.length > 0 ? `New filing: ${list}` : "New filing added");
  }
  if (changeTypes.includes("reappeared")) {
    parts.push("Reappeared in its source's active list");
  }
  if (changeTypes.includes("no_longer_reported")) {
    parts.push("No longer appearing in its source's active list");
  }
  return parts.join("; ");
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
 * RESOLVED_STAGES: if `p.currentStage` is one of RESOLVED_STAGES
 * (approved/under construction/cancelled/completed — see taxonomies.ts),
 * this project is still written like any other, never deleted or skipped.
 * Historically (before 2026-08-25) this function deleted any existing row
 * once a project's stage transitioned into RESOLVED_STAGES, on the theory
 * that this site only tracked projects still waiting on a regulatory yes.
 * Product direction changed: the site now keeps every project regardless
 * of outcome, surfaced through the frontend's Status filter (see
 * statusBucketForStage in taxonomies.ts and src/lib/filters.ts) — "In
 * Permitting" by default (matching the old always-waiting behavior
 * exactly, so this is not a behavior change for anyone not using the new
 * filter), plus "Cancelled / Suspended" and "Permits Complete" as
 * explicit opt-in views. A resolved-stage project therefore just updates
 * (or creates) normally below, same as any other stage.
 *
 * CHANGE DETECTION (added 2026-08-25, for the homepage changes feed — see
 * ProjectChange in schema.prisma): every write here diffs the incoming
 * values against whatever `existing` held before the write, and — if
 * anything a user would actually care about changed — writes one bundled
 * ProjectChange row summarizing all of it. Deliberately NOT diffed:
 * `currentStatus` free text, `dataQualityNote`, county/coordinates being
 * filled in later, name corrections — these are usually this project's own
 * parsing improving on the same underlying filing, not the real world
 * changing, and surfacing them would make the feed noisy. Only currentStage
 * (a real transition), capacityValue (a real fact revision), new
 * milestones (a real new filing), and reappearing after having been
 * flagged noLongerReported count. A run that changes none of these writes
 * no ProjectChange row at all — this table is not a full audit log.
 *
 * `suppressNewChangeLog`: a brand new source's very first ingestion run
 * makes every one of its candidates look "new" to this diff, even though
 * they're just pre-existing dockets the site is only now starting to
 * track — not real, same-day discoveries. Left unhandled, that floods the
 * homepage changes feed with a wall of "New project discovered" cards on
 * day one, exactly the noise the feed exists to cut through.
 * `upsertNormalizedProjects` sets this whenever its source has zero
 * previously-tracked rows before the run starts (see its own comment) and
 * threads it into every project in that run; the `Project` row itself is
 * still created completely normally either way, only the `ProjectChange`
 * log entry is skipped.
 */
export async function upsertNormalizedProject(p: NormalizedProject, options: { suppressNewChangeLog?: boolean } = {}) {
  // Slug is only computed once, at creation, from whichever source's
  // normalizeX() call happens to create the row first; it deliberately
  // never changes after that so a project's URL stays stable even as later
  // updates (from the same source, or a different source sharing its
  // matchKey) change its display name.
  const slug = slugify(p.name, p.matchKey);

  const existing =
    (await prisma.project.findUnique({ where: { matchKey: p.matchKey } })) ??
    (await prisma.project.findUnique({ where: { slug } }));

  // Captured BEFORE the milestone deleteMany/createMany below overwrites
  // them, so "new_filing" can be detected by diffing descriptions.
  const existingMilestoneDescriptions = existing
    ? new Set((await prisma.milestone.findMany({ where: { projectId: existing.id }, select: { description: true } })).map((m) => m.description))
    : new Set<string>();

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
    // Being upserted at all means this run's source DID see this project —
    // always reset the flag, whether or not it was previously set (that's
    // exactly the "reappeared" case).
    noLongerReported: false,
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

  // See CHANGE DETECTION above.
  const isNew = existing == null;
  const changeTypes: ChangeType[] = [];
  if (isNew) {
    if (!options.suppressNewChangeLog) changeTypes.push("new");
  } else {
    if (existing.currentStage !== p.currentStage) {
      changeTypes.push(RESOLVED_STAGES.includes(p.currentStage) ? "resolved" : "advanced");
    }
    if ((existing.capacityValue ?? null) !== (p.capacityValue ?? null)) {
      changeTypes.push("fact_revised");
    }
    if (existing.noLongerReported) {
      changeTypes.push("reappeared");
    }
  }
  const newFilingDescriptions = !isNew && p.milestones ? p.milestones.map((m) => m.description).filter((d) => !existingMilestoneDescriptions.has(d)) : [];
  if (newFilingDescriptions.length > 0) changeTypes.push("new_filing");

  if (changeTypes.length > 0) {
    await prisma.projectChange.create({
      data: {
        projectId: project.id,
        changeTypes,
        previousStage: existing?.currentStage ?? null,
        newStage: p.currentStage,
        summary: buildChangeSummary(changeTypes, {
          previousStage: (existing?.currentStage as ProjectStage | undefined) ?? null,
          newStage: p.currentStage,
          previousCapacityValue: existing?.capacityValue ?? null,
          newCapacityValue: p.capacityValue ?? null,
          capacityUnit: p.capacityUnit ?? null,
          newFilingDescriptions,
        }),
      },
    });
  }

  return project;
}

// The part of a matchKey before its first ":" — `${source}:${sourceId}` by
// default (see resolveMatchKey in manualOverrides.ts). Used only to scope
// vanished-detection to "other rows this same source has previously
// tracked," so a manually-overridden shared matchKey (no ":"-prefixed
// source segment at all, or a different one than either source's own
// default) simply won't match anything and that row is silently excluded
// from vanished-detection — an accepted, documented gap for the rare
// human-curated-merge case, not a correctness bug for the vast majority of
// unmerged rows.
function sourcePrefixOf(matchKey: string): string {
  const i = matchKey.indexOf(":");
  return i === -1 ? matchKey : matchKey.slice(0, i);
}

/**
 * VANISHED-DETECTION (added 2026-08-25, replacing the old per-module
 * "vanished-candidate fix" pattern retired the same day — see each
 * module's own header for that history): after upserting this run's real
 * candidates, any OTHER project previously tracked from the same source
 * (same matchKey prefix) that is still non-resolved and not already
 * flagged is marked Project.noLongerReported=true, with a ProjectChange
 * row logged. This runs centrally here, once, generically for every
 * source — not duplicated per-module — so there's exactly one
 * implementation to get right instead of ~40.
 *
 * `sourcePrefix` is inferred from the first candidate's own matchKey when
 * omitted, which is correct for the overwhelmingly common case (one
 * module, one source, one call). It must be passed explicitly for a
 * source whose real population can legitimately be zero on a given run
 * (e.g. tnTpucDockets.ts) — with an empty `projects` array there's nothing
 * to infer a prefix from, and vanished-detection is silently skipped for
 * that run rather than guessed at.
 *
 * Callers with a `MAX_CANDIDATES`-style recency cap (most state modules —
 * see each one's own top-N-by-recency `.slice(...)` before calling
 * upsertNormalizedProjects) must NOT run this when that cap actually bound
 * this run (`wasCapped` in the caller below): once a source has more real
 * active dockets than its own cap, a capped run's candidate set is only
 * the *most recent* N, not the source's full active list, so anything
 * older that's still genuinely open would look "not seen this run" and
 * get wrongly flagged vanished — confirmed live 2026-08-27: NY DPS's
 * cap of 60 left exactly 39 real, still-open older dockets (99 tracked
 * total) flagged noLongerReported, none of which had a chance to
 * "reappear" since every later run hits the same cap and excludes them
 * again. Skipping vanished-detection entirely on a capped run is safe: it
 * just leaves those older rows in their last-known state until the source
 * catches back up under its cap, same as this function already does for a
 * source with no candidates at all.
 */
async function markVanished(sourcePrefix: string, seenMatchKeys: Set<string>): Promise<number> {
  const previouslyTracked = await prisma.project.findMany({
    where: {
      matchKey: { startsWith: `${sourcePrefix}:` },
      currentStage: { notIn: RESOLVED_STAGES },
      noLongerReported: false,
    },
    select: { id: true, matchKey: true, currentStage: true },
  });

  const vanished = previouslyTracked.filter((row) => row.matchKey && !seenMatchKeys.has(row.matchKey));
  for (const row of vanished) {
    await prisma.project.update({ where: { id: row.id }, data: { noLongerReported: true } });
    await prisma.projectChange.create({
      data: {
        projectId: row.id,
        changeTypes: ["no_longer_reported"],
        previousStage: row.currentStage,
        newStage: row.currentStage,
        summary: buildChangeSummary(["no_longer_reported"], {
          previousStage: row.currentStage as ProjectStage,
          newStage: row.currentStage as ProjectStage,
          previousCapacityValue: null,
          newCapacityValue: null,
          capacityUnit: null,
          newFilingDescriptions: [],
        }),
      },
    });
  }
  return vanished.length;
}

/**
 * Upserts many projects with limited concurrency instead of one at a time.
 * `upsertNormalizedProject` does ~5 sequential DB round trips per project;
 * run fully sequentially, a few hundred projects takes minutes — too slow
 * for a serverless function's execution time limit (see the EIA-860M cron
 * route, src/app/api/cron/ingest-eia/route.ts). Running a bounded number of
 * projects concurrently instead cuts that to seconds, without opening so
 * many connections at once that the database chokes.
 *
 * `removedResolved` is a legacy field name kept for interface stability
 * across every ingestion module's own `IngestSummary` type and console
 * logging (dozens of call sites) rather than mechanically renamed — since
 * RESOLVED_STAGES projects are no longer deleted (see
 * upsertNormalizedProject), it no longer counts something disjoint from
 * `upserted`; it's now a *subset* count of how many of this run's
 * successful writes carried a resolved stage (approved/under
 * construction/cancelled/completed), for the same "how many resolved
 * this run" signal each module's own CLI summary line already reports.
 *
 * See markVanished above for `sourcePrefix` and the noLongerReported side
 * effect this now also has — a purely additive behavior change from this
 * function's prior signature, so every existing call site
 * (`upsertNormalizedProjects(toUpsert)`) keeps working unchanged.
 *
 * BACKFILL DETECTION (revised 2026-08-27 — see IngestSourceBackfill in
 * schema.prisma for the incident this fixed): whether to suppress this
 * run's "new" logging is no longer inferred from "does this source
 * currently have zero rows," because that signal is silently defeated by
 * any out-of-band write against the same database — most notably a
 * developer running `npm run ingest:<source>` by hand (see each module's
 * own `require.main === module` block) before that source's cron has ever
 * fired for real. Two rules instead:
 *   1. A run NOT triggered by the live Vercel cron (`isLiveCronRun` below)
 *      never marks a source's backfill complete and always suppresses its
 *      own "new" logging — a manual/local run should never itself produce
 *      real feed events, so it can't burn the one true backfill exemption
 *      the source's actual first cron run is entitled to.
 *   2. A cron-triggered run suppresses "new" logging exactly until an
 *      IngestSourceBackfill row exists for this sourcePrefix, and writes
 *      that row itself once such a run completes — so the exemption is
 *      spent by the real first cron run, not by whichever run happens to
 *      find zero rows first.
 */
export async function upsertNormalizedProjects(
  projects: NormalizedProject[],
  options: { sourcePrefix?: string; concurrency?: number; wasCapped?: boolean } = {},
): Promise<{ upserted: number; removedResolved: number; vanished: number; errors: { matchKey: string; message: string }[] }> {
  const concurrency = options.concurrency ?? 40;
  let upserted = 0;
  let removedResolved = 0;
  const errors: { matchKey: string; message: string }[] = [];

  const sourcePrefix = options.sourcePrefix ?? sourcePrefixOf(projects[0]?.matchKey ?? "");

  // Vercel sets VERCEL=1 in every deployed function (build, preview, and
  // production runtime alike) but never in a plain local `tsx` invocation —
  // see BACKFILL DETECTION above.
  const isLiveCronRun = process.env.VERCEL === "1";
  const backfillRecord =
    sourcePrefix !== "" ? await prisma.ingestSourceBackfill.findUnique({ where: { sourcePrefix } }) : null;
  const suppressNewChangeLog = !isLiveCronRun || !backfillRecord;

  for (let i = 0; i < projects.length; i += concurrency) {
    const batch = projects.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((p) => upsertNormalizedProject(p, { suppressNewChangeLog })),
    );
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        upserted += 1;
        if (RESOLVED_STAGES.includes(batch[j].currentStage)) removedResolved += 1;
      } else {
        errors.push({ matchKey: batch[j].matchKey, message: String(result.reason) });
      }
    }
  }

  if (isLiveCronRun && !backfillRecord && sourcePrefix !== "") {
    // Race-safe: two overlapping cron invocations for the same source would
    // otherwise both try to create this row.
    await prisma.ingestSourceBackfill
      .create({ data: { sourcePrefix } })
      .catch(() => {});
  }

  const vanished =
    sourcePrefix && !options.wasCapped ? await markVanished(sourcePrefix, new Set(projects.map((p) => p.matchKey))) : 0;

  return { upserted, removedResolved, vanished, errors };
}
