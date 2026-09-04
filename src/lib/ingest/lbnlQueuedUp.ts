// LBNL "Queued Up" ingestion — the most comprehensive U.S. interconnection
// queue dataset (aggregated from 50+ ISOs/utilities), published annually as
// a downloadable Excel workbook, currently linked from
// https://emp.lbl.gov/queues. This is the only currently-ingested source
// that publishes a real per-project "date entered queue" — see
// applicationFiledDate below — so it's the fix for projects site-wide
// showing no waiting time (see README).
//
// FETCHING: unlike EIA-860M, there's no predictable filename pattern to
// guess (confirmed 2026-08-15: this year's file is
// /sites/default/files/2026-05/LBNL_Ix_Queue_Data_File_thru2025.xlsx — the
// year-month upload folder and the "thru<year>" suffix both change on every
// annual release). Instead, findCurrentWorkbookUrl() fetches the queues
// landing page and scrapes the .xlsx attachment link out of the HTML, same
// as a human clicking "download" would. Confirmed 2026-08-15: emp.lbl.gov
// 403s any request without a browser-like User-Agent header (plain
// `fetch()` with no headers gets blocked; a Chrome UA string is not) — both
// requests below (the landing page and the workbook itself) set one.
//
// WORKBOOK STRUCTURE (confirmed 2026-08-15 against the 2026-edition file,
// not guessed from memory): the ~40-tab workbook's actual project-level data
// lives on the sheet named "03. Complete Queue Data" (SHEET_NAME_CANDIDATES
// below), not a sheet literally named "data" as an earlier, never-actually-
// run version of this module assumed. That sheet also has an extra
// "RETURN TO CONTENTS" link row above the real header row, so the header is
// row index 1 (0-based), not row 0 — see parseWorkbookBuffer. Real column
// names (from the "04. Data Codebook" tab) are seeded as the primary
// candidates in FIELD_CANDIDATES; kept as a resolved-from-header-row lookup
// rather than hardcoded indices in case LBNL renames columns in a future
// edition, per the same defensive pattern as eia860mPlanned.ts.
//
// IDENTITY: the codebook explicitly says q_id alone isn't unique — combine
// with `entity`. matchKey below does that. Checked for collisions within the
// filtered set actually ingested (active, >=250MW): zero duplicates as of
// the 2026 edition, though ~38k un-filtered rows contain 135 (from
// long-since-operational/withdrawn duplicate entries this module never
// ingests anyway).
//
// FILTERS (explicit product decisions, confirmed with the site owner
// 2026-08-15 and reconfirmed 2026-08-21, re-run any time — upserts are
// idempotent by entity+q_id):
//   - q_status: "active" only. The raw file also has withdrawn (24,221),
//     operational (4,789), suspended (668), and unknown (10) rows —
//     withdrawn/operational aren't "waiting" on anything anymore, and
//     "suspended" is excluded too, per explicit 2026-08-21 product decision
//     (stricter than the Permitting Dashboard's treatment of "Paused" as
//     still-waiting: a suspended interconnection request isn't "waiting" on
//     this site's terms either). As of 2026-08-21 this module now normalizes
//     every non-active row too (previously it silently skipped them
//     pre-normalize) so RESOLVED_STAGES cleanup in common.ts can delete a
//     previously-tracked project the moment a later edition reports it
//     withdrawn/suspended/operational, instead of it freezing in a stale
//     "still waiting" state — see normalizeQueuedUpRow and README open
//     question #9, now resolved for this source specifically.
//   - mw_1 >= MIN_CAPACITY_MW (250): matches the site-wide 250 MW capacity
//     floor also used by EIA-860M (see that module) — a deliberate,
//     documented curation decision, not a technical limit, to keep every
//     source consistent about what counts as a tracked "project." Only
//     rows with a *known* mw_1 below this floor are dropped — a missing
//     value is kept, not treated as evidence of a small project.
//
// GEOCODING: this dataset publishes county + state + a 5-digit FIPS code but
// no lat/lon or street address (same limitation already documented for the
// Permitting Dashboard). Rather than leave these ungeocoded — which turned
// out to be a real bug, not just a cosmetic gap: filtering by "length of
// delay" narrows the result set to almost entirely LBNL-sourced projects
// (the only source with real dates), and every one of them was being
// silently dropped by the map (Map.tsx skips markers with no lat/lon),
// making the map go empty under that filter — this module looks up each
// row's FIPS code against src/lib/data/countyCentroids.json (from the U.S.
// Census Bureau's public-domain 2025 Gazetteer county file, keyed by
// 5-digit GEOID) and places a pin at the county's centroid. Confirmed the
// raw fips_code cell comes through as a number with leading zeros stripped
// for low-numbered state FIPS codes (e.g. Arizona's 04005 reads as 4005) —
// COUNTY_CENTROIDS lookup below re-pads before matching. This is a real
// county center, not the project's actual site — dataQualityNote says so.
//
// LICENSE / REDISTRIBUTION: resolved, unlike the earlier version of this
// file's flagged-as-open-question note — the source page states the Queued
// Up data file is licensed CC BY 4.0 (confirmed 2026-08-15, emp.lbl.gov/
// queues), attribution to "Lawrence Berkeley National Laboratory &
// GridTracker" required. `sources` below carries that attribution and a
// link back to the source page.
//
// Runs on a weekly cron (src/app/api/cron/ingest-lbnl) in production, same
// as the other sources — even though LBNL only republishes this file
// annually, checking weekly costs one cheap HTML fetch on the weeks nothing's
// changed, and picks up a new edition within a week of publication with
// no manual step. Run `npx tsx src/lib/ingest/lbnlQueuedUp.ts` (or
// `npm run ingest:lbnl`) yourself for a manual pull; pass a local file path
// as argv[1] to parse an already-downloaded workbook instead of fetching.
export const MIN_CAPACITY_MW = 250;

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject, type NormalizedMilestone } from "@/lib/ingest/common";
import countyCentroidsData from "@/lib/data/countyCentroids.json";

const COUNTY_CENTROIDS = countyCentroidsData as unknown as Record<string, [number, number]>;

function countyCentroid(fipsRaw: string | number | null | undefined): { lat: number; lon: number } | null {
  if (fipsRaw == null || fipsRaw === "") return null;
  const fips = String(fipsRaw).trim().padStart(5, "0");
  const hit = COUNTY_CENTROIDS[fips];
  return hit ? { lat: hit[0], lon: hit[1] } : null;
}

const LANDING_PAGE_URL = "https://emp.lbl.gov/queues";

// A browser UA is required — see module header. Not spoofing anything else
// (no cookies/referer needed), just avoiding the default Node fetch UA that
// gets blocked outright.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const SHEET_NAME_CANDIDATES = ["03. Complete Queue Data", "data", "Queued Up Data", "Interconnection Requests"];

const FIELD_CANDIDATES: Record<string, string[]> = {
  queueId: ["q_id", "queue_id", "project_id"],
  status: ["q_status", "queue_status", "status"],
  entity: ["entity", "utility", "balancing_authority", "iso_rto"],
  state: ["state", "state_poi"],
  county: ["county", "county_1"],
  fipsCode: ["fips_code", "fips", "county_fips"],
  resourceType: ["type_clean", "resource_type", "fuel", "type"],
  capacityMw: ["mw_1", "mw1", "capacity_mw", "mw_total"],
  storageCapacityMw: ["mw_2", "mw2", "storage_mw"],
  queueDate: ["q_date", "queue_date", "date_submitted", "date_entered_queue"],
  withdrawnDate: ["wd_date", "withdrawn_date", "date_withdrawn"],
  iaDate: ["ia_date", "date_ia_executed"],
  codDate: ["on_date", "cod", "cod_date", "estimated_cod"],
  iaPhase: ["IA_phase_clean", "ia_phase_clean", "ia_phase"],
  region: ["region"],
  cluster: ["cluster"],
  poiName: ["poi_name"],
  developer: ["developer"],
};

type FieldMap = Record<keyof typeof FIELD_CANDIDATES, string | undefined>;

function resolveFieldMap(headerRow: string[]): FieldMap {
  const normalized = headerRow.map((h) => h?.toString().trim());
  const map = {} as FieldMap;
  const missing: string[] = [];

  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES)) {
    const idx = normalized.findIndex((h) => candidates.includes(h));
    if (idx === -1) {
      missing.push(field);
      continue;
    }
    map[field as keyof typeof FIELD_CANDIDATES] = headerRow[idx];
  }

  if (missing.length > 0) {
    throw new Error(
      `LBNL Queued Up parser could not find columns for: ${missing.join(", ")}. ` +
        `Open the workbook's "04. Data Codebook" tab, find the real column names, and add them ` +
        `to FIELD_CANDIDATES in src/lib/ingest/lbnlQueuedUp.ts.`,
    );
  }

  return map;
}

const RESOURCE_TYPE_TO_FUEL: [RegExp, FuelType][] = [
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/solar/i, "solar"],
  [/battery|storage/i, "storage"],
  [/\bgas\b/i, "gas"],
  [/nuclear/i, "nuclear"],
  [/hydro/i, "hydro"],
  [/geothermal/i, "geothermal"],
];

// type_clean can be a hybrid string like "Solar+Battery" — match the first
// recognized keyword. Coal/Diesel/Oil/Hydrogen (real values in this
// dataset) have no dedicated FuelType on this site and fall through to
// "other".
function resourceTypeToFuel(resourceType: string): FuelType {
  for (const [re, fuel] of RESOURCE_TYPE_TO_FUEL) {
    if (re.test(resourceType)) return fuel;
  }
  return "other";
}

// IA_phase_clean gives real study-phase granularity this site's other two
// sources can't (they default every project to "agency_permitting") — see
// FIELD_CANDIDATES.iaPhase. Only called for q_status === "active" rows (see
// STATUS_TO_RESOLVED_STAGE for everything else). Rows whose phase is
// "Construction", "IA Executed", or "IA Pending" resolve to a
// RESOLVED_STAGES value here on purpose — per explicit product decision, an
// executed/pending interconnection agreement means the project has already
// cleared the permitting/interconnection process this site is about, so
// common.ts's shared guard deletes any previously-tracked row for it rather
// than this module normalizing it as still "waiting."
//
// "Suspended" is also caught here, separately from q_status — confirmed
// 2026-08-21 against a live row (Los Angeles DWP interconnection request
// Q97): IA_phase_clean can read "Suspended" even while q_status itself is
// still "active" (the overall queue request is active, but its *study* is
// paused). Per the same "suspended isn't waiting" product decision as
// STATUS_TO_RESOLVED_STAGE, this must be excluded here too, not just at the
// q_status level, or a paused study silently displays as "waiting."
function iaPhaseToStage(phase: string): ProjectStage {
  const p = phase.toLowerCase();
  if (p.includes("construction")) return "under_construction";
  if (p.includes("ia executed")) return "approved_awaiting_construction";
  if (p.includes("ia pending")) return "approved_awaiting_construction";
  if (p.includes("suspended")) return "cancelled";
  return "interconnection_study";
}

// Maps every non-"active" q_status to a RESOLVED_STAGES value purely so
// common.ts's shared guard deletes any previously-tracked row for it — the
// exact stage chosen here is never actually persisted (upsertNormalizedProject
// returns early for any RESOLVED_STAGES project without writing currentStage),
// so these are picked for readability, not semantic precision. "suspended"
// intentionally lands here too: per 2026-08-21 product decision a suspended
// interconnection request isn't "waiting" on this site's terms.
const STATUS_TO_RESOLVED_STAGE: Record<string, ProjectStage> = {
  withdrawn: "cancelled",
  suspended: "cancelled",
  unknown: "cancelled",
  operational: "completed",
};

// Excel stores dates as a day count from a Dec-30-1899 epoch (with a
// well-known off-by-one leap-year quirk baked into the format). This
// workbook's date columns come through sheet_to_json as raw numbers (e.g.
// 43511), not JS Date objects — confirmed 2026-08-15 against the actual
// file — so convert explicitly rather than relying on `new Date(number)`,
// which would misinterpret the number as a millisecond timestamp.
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface QueuedUpRow {
  [column: string]: string | number | null;
}

export function parseWorkbookBuffer(buf: Buffer): QueuedUpRow[] {
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((n) =>
    SHEET_NAME_CANDIDATES.some((c) => n.toLowerCase() === c.toLowerCase()),
  );
  if (!sheetName) {
    throw new Error(
      `Could not find a data sheet among candidates [${SHEET_NAME_CANDIDATES.join(", ")}]. ` +
        `Sheets in this workbook: ${workbook.SheetNames.join(", ")}`,
    );
  }
  const sheet = workbook.Sheets[sheetName];
  // Row 0 is a "RETURN TO CONTENTS" link cell, not data — the real header is
  // row index 1. See module header.
  const rows = XLSX.utils.sheet_to_json<QueuedUpRow>(sheet, { defval: null, range: 1 });
  return rows;
}

export function parseWorkbook(filePath: string): QueuedUpRow[] {
  return parseWorkbookBuffer(readFileSync(filePath));
}

export function normalizeQueuedUpRow(row: QueuedUpRow, fieldMap: FieldMap): NormalizedProject {
  const get = (field: keyof typeof FIELD_CANDIDATES) => {
    const col = fieldMap[field];
    return col ? row[col] : undefined;
  };

  const queueId = String(get("queueId") ?? "");
  const entity = String(get("entity") ?? "");
  const matchKey = resolveMatchKey("lbnl", `${entity}-${queueId}`);
  const resourceType = String(get("resourceType") ?? "");
  const fuelType = resourceTypeToFuel(resourceType);
  const capacityMw = Number(get("capacityMw") ?? NaN);
  const queueDateRaw = get("queueDate");
  const queueDate =
    typeof queueDateRaw === "number"
      ? excelSerialToDate(queueDateRaw)
      : queueDateRaw
        ? new Date(queueDateRaw as string)
        : null;
  const codDateRaw = get("codDate");
  const codDate =
    typeof codDateRaw === "number"
      ? excelSerialToDate(codDateRaw)
      : codDateRaw
        ? new Date(codDateRaw as string)
        : null;
  // withdrawnDate/iaDate were fetched into FIELD_CANDIDATES before now but
  // never actually used — real milestone dates worth surfacing rather than
  // discarding, now that the site keeps every project regardless of
  // resolved outcome (see upsertNormalizedProject's RESOLVED_STAGES note).
  const parseLbnlDate = (raw: unknown): Date | null =>
    typeof raw === "number" ? excelSerialToDate(raw) : raw ? new Date(raw as string) : null;
  const withdrawnDate = parseLbnlDate(get("withdrawnDate"));
  const iaDate = parseLbnlDate(get("iaDate"));
  const status = String(get("status") ?? "").toLowerCase();
  const iaPhase = String(get("iaPhase") ?? "");
  const state = get("state") ? String(get("state")) : null;
  const county = get("county") ? String(get("county")) : null;
  const region = get("region") ? String(get("region")) : null;
  const cluster = get("cluster") != null && String(get("cluster")).trim() !== "" ? String(get("cluster")) : null;
  const poiName = get("poiName") ? String(get("poiName")) : null;
  const developer = get("developer") ? String(get("developer")) : null;
  const centroid = countyCentroid(get("fipsCode") as string | number | null | undefined);

  const causeSlugs: CauseSlug[] = ["interconnection_queue_backlog"];

  const milestones: NormalizedMilestone[] = [];
  if (iaDate) {
    milestones.push({ date: iaDate, dateConfidence: "exact", stage: "Interconnection agreement", description: "Interconnection agreement executed" });
  }
  if (withdrawnDate) {
    milestones.push({ date: withdrawnDate, dateConfidence: "exact", stage: "Withdrawn", description: "Withdrawn from the interconnection queue" });
  }

  // See STATUS_TO_RESOLVED_STAGE and iaPhaseToStage: for a non-active row,
  // or an active row whose IA phase already cleared the process, this
  // resolves to a RESOLVED_STAGES value so common.ts deletes any
  // previously-tracked row rather than this module normalizing it as
  // "waiting."
  const currentStage: ProjectStage =
    status === "active" ? iaPhaseToStage(iaPhase) : (STATUS_TO_RESOLVED_STAGE[status] ?? "cancelled");

  return {
    matchKey,
    name: `${entity} Interconnection Request ${queueId}${resourceType ? ` (${resourceType})` : ""}`,
    projectType: fuelType === "storage" ? "storage" : "generation",
    fuelType,
    // County-centroid approximation, not the project's exact site — see
    // GEOCODING in the module header.
    lat: centroid?.lat ?? null,
    lon: centroid?.lon ?? null,
    state,
    county,
    capacityValue: Number.isFinite(capacityMw) ? capacityMw : null,
    capacityUnit: "MW",
    applicationFiledDate: queueDate,
    dateConfidence: "exact",
    // LBNL's own estimated COD, refreshed by developers as a project moves
    // through the queue — a real projection, not a firm commitment, hence
    // "approximate" even though the underlying value is a specific date.
    expectedOnlineDate: codDate,
    expectedOnlineDateConfidence: "approximate",
    currentStatus: `Interconnection queue status: ${status || "unknown"}${iaPhase ? ` (${iaPhase})` : ""}${region ? `, ${region} region` : ""}`,
    currentStage,
    causeSlugs,
    causeDetail:
      "Sourced from LBNL's Queued Up interconnection queue dataset — this project is waiting on its grid operator's interconnection study/agreement process.",
    // Only meaningful for rows that actually get persisted (status ===
    // "active" and not already-cleared) — see interconnectionQueueStage's
    // schema.prisma comment.
    interconnectionQueueStage: status === "active" ? iaPhase || null : null,
    balancingAuthority: region,
    queueCluster: cluster,
    pointOfInterconnection: poiName,
    applicant: developer,
    milestones,
    dataQualityNote: centroid
      ? "No exact site address is published in this dataset — the map pin is placed at the project's county centroid, not its actual site."
      : "No exact site address/lat-lon is published in this dataset, and this project's county couldn't be matched to a centroid (missing or unrecognized FIPS code); it will not appear on the map until geocoded another way.",
    sources: [
      {
        label: "LBNL Queued Up (interconnection queue dataset)",
        url: LANDING_PAGE_URL,
      },
    ],
    externalIds: { lbnl: `${entity}-${queueId}` },
  };
}

export interface IngestSummary {
  upserted: number;
  // Previously-tracked projects removed because a newer edition reports
  // them withdrawn/suspended/operational, or their IA phase already cleared
  // the interconnection process — see STATUS_TO_RESOLVED_STAGE and
  // iaPhaseToStage. Was silently dropped (never counted) before 2026-08-21.
  removedResolved: number;
  skippedBelowFloor: number;
  errors: { matchKey: string; message: string }[];
  sourceFileUrl?: string;
}

export async function ingestLbnlQueuedUpBuffer(
  buf: Buffer,
  minCapacityMw = MIN_CAPACITY_MW,
): Promise<IngestSummary> {
  const rows = parseWorkbookBuffer(buf);
  if (rows.length === 0) {
    return { upserted: 0, removedResolved: 0, skippedBelowFloor: 0, errors: [] };
  }
  const headerRow = Object.keys(rows[0]);
  const fieldMap = resolveFieldMap(headerRow);

  let skippedBelowFloor = 0;
  const toUpsert: NormalizedProject[] = [];

  // As of 2026-08-21 every row is normalized and handed to
  // upsertNormalizedProjects, not just "active" ones — a withdrawn,
  // suspended, operational, or already-cleared-phase row still needs to run
  // through normalizeQueuedUpRow so its RESOLVED_STAGES-mapped currentStage
  // lets common.ts's shared guard delete any project a previous run had
  // tracked as still-waiting. See module header and normalizeQueuedUpRow.
  for (const row of rows) {
    const status = String(row[fieldMap.status!] ?? "").toLowerCase();
    const capacity = Number(row[fieldMap.capacityMw!] ?? NaN);
    // Only drop *actively-waiting* rows clearly below the floor — see the
    // matching comment in eia860mPlanned.ts. A withdrawn/suspended/
    // operational row must still flow through regardless of capacity so any
    // previously-tracked project gets cleaned up; a project could only have
    // been created in the first place while active and >= the floor, so
    // skipping it here for a non-active row never leaves a stale one behind.
    if (status === "active" && Number.isFinite(capacity) && capacity < minCapacityMw) {
      skippedBelowFloor += 1;
      continue;
    }
    toUpsert.push(normalizeQueuedUpRow(row, fieldMap));
  }

  const { upserted, removedResolved, errors } = await upsertNormalizedProjects(toUpsert);

  return { upserted, removedResolved, skippedBelowFloor, errors };
}

export async function ingestLbnlQueuedUp(filePath: string, minCapacityMw = MIN_CAPACITY_MW): Promise<IngestSummary> {
  return ingestLbnlQueuedUpBuffer(readFileSync(filePath), minCapacityMw);
}

// emp.lbl.gov's bot-protection intermittently 403s a request that would
// otherwise succeed — confirmed live 2026-09-04: repeated identical requests
// to the same URL, seconds apart, returned 403/200/403/200 with no header
// or timing difference explaining which — this reads as a WAF sampling a
// fraction of non-browser requests, not a hard per-client block (a genuine
// TLS-fingerprint block would be consistent, and wasn't). A single failed
// fetch here previously aborted the whole ingestion run — very likely why
// this source's live cron backfill has never completed (see
// IngestSourceBackfill in schema.prisma, and every currently-tracked LBNL
// project's matchKey still being null as of 2026-09-04). Retrying a few
// times with a short delay costs nothing on the weeks it isn't needed and
// turns a per-request failure rate that isn't even reliably reproducible
// into a very low per-run one.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastError = new Error(`Failed to fetch ${url}: ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw lastError;
}

// Scrapes the current .xlsx attachment link off the queues landing page —
// see module header for why this can't be a predictable static URL.
export async function findCurrentWorkbookUrl(): Promise<string> {
  const res = await fetchWithRetry(LANDING_PAGE_URL, { headers: BROWSER_HEADERS });
  const html = await res.text();
  const match = /href="([^"]+\.xlsx)"/i.exec(html);
  if (!match) {
    throw new Error(
      `Could not find a .xlsx attachment link on ${LANDING_PAGE_URL} — LBNL may have restructured the page.`,
    );
  }
  const href = match[1];
  return href.startsWith("http") ? href : new URL(href, LANDING_PAGE_URL).toString();
}

export async function fetchAndIngestCurrentWorkbook(minCapacityMw = MIN_CAPACITY_MW): Promise<IngestSummary> {
  const url = await findCurrentWorkbookUrl();
  const res = await fetchWithRetry(url, { headers: BROWSER_HEADERS });
  const buf = Buffer.from(await res.arrayBuffer());
  const summary = await ingestLbnlQueuedUpBuffer(buf, minCapacityMw);
  return { ...summary, sourceFileUrl: url };
}

if (require.main === module) {
  const filePath = process.argv[2] ?? process.env.LBNL_QUEUED_UP_XLSX_PATH;
  const run = filePath ? ingestLbnlQueuedUp(filePath) : fetchAndIngestCurrentWorkbook();
  run
    .then((summary) => {
      console.log(
        `LBNL Queued Up ingestion complete: upserted ${summary.upserted} projects ` +
          `(removed ${summary.removedResolved} previously-tracked projects now withdrawn/suspended/operational/cleared-permitting, ` +
          `skipped ${summary.skippedBelowFloor} below the ${MIN_CAPACITY_MW} MW floor, ` +
          `${summary.errors.length} errors).` +
          (summary.sourceFileUrl ? ` Source: ${summary.sourceFileUrl}` : ""),
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
