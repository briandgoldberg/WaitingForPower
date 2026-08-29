// Manual/CSV override path for cases where automated cross-source project
// identity matching fails (see common.ts header comment). Each row declares
// that a specific source record should adopt a shared `matchKey` instead of
// its default `${source}:${sourceId}` key, so it merges with the same
// physical project ingested from another source.
//
// File format (see manualOverrides.example.csv):
//   source,sourceId,matchKey
//   eia,6121-1,grain-belt-express-phase-1
//   permittingDashboard,71536,grain-belt-express-phase-1
//
// This is intentionally a human-curated file, not a fuzzy-matching
// algorithm — project identity claims ("these two records are the same
// physical thing") are exactly the kind of claim that should have a name
// attached, not a similarity score.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export interface ManualOverrideRow {
  source: string;
  sourceId: string;
  matchKey: string;
}

const OVERRIDES_PATH = path.join(process.cwd(), "src/lib/ingest/manualOverrides.csv");

let cache: ManualOverrideRow[] | null = null;

export function loadManualOverrides(): ManualOverrideRow[] {
  if (cache) return cache;
  if (!existsSync(OVERRIDES_PATH)) {
    cache = [];
    return cache;
  }
  const raw = readFileSync(OVERRIDES_PATH, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [, ...rows] = lines; // skip header
  cache = rows.map((line) => {
    const [source, sourceId, matchKey] = line.split(",").map((s) => s.trim());
    return { source, sourceId, matchKey };
  });
  return cache;
}

export function resolveMatchKey(source: string, sourceId: string): string {
  const override = loadManualOverrides().find(
    (o) => o.source === source && o.sourceId === sourceId,
  );
  return override ? override.matchKey : `${source}:${sourceId}`;
}

/**
 * True if this (source, sourceId) row has been manually merged into a
 * matchKey that ALSO has a row from a different source — i.e. a human has
 * declared this project is the same physical thing also tracked
 * elsewhere. permittingDashboard.ts uses this to stop contributing
 * currentStage/currentStatus once a genuinely granular state-level
 * tracker exists for the same project.
 *
 * Confirmed live 2026-08-28: Grain Belt Express (merged between
 * permittingDashboard and il-icc via manualOverrides.csv) oscillated
 * between "Agency permitting" and "Local/state review" once per day for
 * several days straight. Root cause: both sources' crons upsert the same
 * merged Project row, and upsertNormalizedProject has no concept of which
 * source should "win" a stage disagreement — it's a plain last-write-wins
 * overwrite. Permitting Dashboard's own statusToStage is an admitted
 * best-effort default (see that module's OPEN QUESTIONS: no structured
 * status/cause field on its API at all), while a state docket source like
 * il-icc parses the real regulatory status directly — so once a project
 * is confirmed merged with a real state-level tracker, Permitting
 * Dashboard should defer to it entirely rather than fight over the stage
 * once a day.
 */
export function isMergedWithAnotherSource(source: string, sourceId: string): boolean {
  const overrides = loadManualOverrides();
  const mine = overrides.find((o) => o.source === source && o.sourceId === sourceId);
  if (!mine) return false;
  return overrides.some((o) => o.matchKey === mine.matchKey && o.source !== source);
}

/**
 * True if this matchKey is shared by 2+ distinct sources in
 * manualOverrides.csv — i.e. a human has declared this one physical
 * project is tracked by more than one source. Used by
 * upsertNormalizedProject (common.ts) to decide whether a null/unknown
 * value from one source is allowed to erase a known value already
 * contributed by the other — see MERGED-FIELD NULL SAFETY there for the
 * incident this fixes (confirmed live 2026-08-28: Cascade Renewable
 * Transmission's capacity flapped between 320 kV and unknown every day,
 * because Washington EFSEC and Oregon EFSC — both legitimate, equally
 * authoritative sources for their own state's siting process on the same
 * physical line — disagree on whether capacity is published, and neither
 * is "wrong" the way Permitting Dashboard's stage guess was, so there's no
 * single source to defer to the way permittingDashboard.ts now does).
 */
export function isMergedMatchKey(matchKey: string): boolean {
  const overrides = loadManualOverrides();
  const sources = new Set(overrides.filter((o) => o.matchKey === matchKey).map((o) => o.source));
  return sources.size >= 2;
}
