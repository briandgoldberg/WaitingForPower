// EIA "Natural Gas Pipeline Projects" tracker — a curated, analyst-maintained
// list of announced/proposed/under-construction U.S. interstate and
// intrastate natural gas pipeline projects, published quarterly as an Excel
// workbook at https://www.eia.gov/naturalgas/data.php. Fills a real gap:
// pipelines were previously only covered via the Federal Permitting
// Dashboard's narrow FAST-41 "covered project" slice (permittingDashboard.ts)
// — this is EIA's own dedicated pipeline tracker, much broader.
//
// FETCHING: like LBNL Queued Up / ORNL hydropower relicensing, there's no
// single predictable "current" URL — confirmed 2026-08-16: the data.php
// landing page lists 28 past quarterly releases, and the naming convention
// itself isn't even consistent (most are
// "EIA-NaturalGasPipelineProjects_<Mon><YYYY>.xlsx" with a leading
// underscore before the month, but the current one on 2026-08-16 is
// "EIA-NaturalGasPipelineProjectsAug2026.xlsx" — no underscore; month
// abbreviations aren't consistent either, e.g. "July2019" vs "Jul2021" vs
// "March2020" vs "May2026"). Rather than guess a filename pattern,
// findCurrentWorkbookUrl() scrapes the first matching .xlsx link off the
// landing page — same "matches what a human clicking download would get"
// approach as lbnlQueuedUp.ts, and more robust here given the confirmed
// naming inconsistency. Confirmed 2026-08-16: no browser User-Agent is
// required for eia.gov (unlike emp.lbl.gov), but one is set anyway for
// consistency with the other scraped-landing-page sources.
//
// WORKBOOK STRUCTURE (confirmed 2026-08-16 against the Aug 2026 edition):
// the "Natural Gas Pipeline Projects" tab has a title row (row index 0)
// before the real header row (row index 1) — same off-by-one pattern as
// eia860mPlanned.ts's "Planned" tab. A separate "Historical Projects
// (1996-2024)" tab exists but isn't read here — this module only tracks
// currently-live (non-historical) rows, which already include every status
// from "Announced" through "Completed"/"Cancelled". The workbook's own
// "Definitions" tab documents every Status value and confirms EIA uses the
// sentinel strings "na" (not available) and "-" (unknown) in place of a
// real blank cell — CLEAN_SENTINELS below normalizes both to null so they
// don't leak into the UI as literal text.
//
// STATUS -> STAGE MAPPING (from the workbook's own Definitions tab):
//   Announced, Proposed          -> planned_pre_filing (not yet filed with FERC)
//   Pre-applied, Applied         -> agency_permitting (active FERC docket)
//   On Hold                      -> agency_permitting ("not moving forward,
//                                    but sponsor hasn't announced cancellation" —
//                                    genuinely still stuck, not resolved)
//   Approved                     -> approved_awaiting_construction (RESOLVED_STAGES)
//   Construction, Part Completed -> under_construction (RESOLVED_STAGES)
//   Completed                    -> completed (RESOLVED_STAGES)
//   Denied, Cancelled            -> cancelled (RESOLVED_STAGES) — "Denied" never
//                                    seen in the live data as of 2026-08-16, but
//                                    the workbook's own Definitions tab documents
//                                    it as a real value, so it's handled rather
//                                    than left to fall through to a guessed default.
// Status cells have inconsistent trailing whitespace in the live workbook
// (e.g. "Approved " vs "Approved", "Completed " vs "Completed") — trimmed
// before matching.
//
// Every recognized status (including RESOLVED_STAGES ones) is normalized
// and passed to upsertNormalizedProjects, same pattern as
// eia860mPlanned.ts and permittingDashboard.ts: the shared RESOLVED_STAGES
// guard (common.ts) deletes a project this module previously tracked as
// waiting once EIA reports it approved/built/cancelled, rather than
// leaving a stale row. Only a genuinely unrecognized status string is
// dropped without ever reaching upsert.
//
// NO CAPACITY FLOOR: unlike eia860mPlanned.ts / lbnlQueuedUp.ts (both
// floored at 250 MW), this module applies no capacity floor — per explicit
// product decision, same reasoning already applied to the Permitting
// Dashboard's pipeline rows: this workbook is itself a curated list of
// analyst-tracked major projects (137 live rows total as of 2026-08-16),
// not a raw firehose that needs floor-filtering, and its capacity field
// ("Additional Capacity (MMcf/d)") is a different unit dimension than the
// MW floor used elsewhere anyway.
//
// NO GEOCODING: pipelines span multiple states with no single site — this
// source publishes a State(s) list (e.g. "NY,CT,MA,RI"), not coordinates,
// stored as-is in the `state` field. lat/lon are always null; these
// projects won't appear on the map, only in the list/table view — same
// documented limitation as some Permitting Dashboard rows.
//
// CAPACITY UNIT: "Additional Capacity (MMcf/d)" is natural gas throughput,
// not MW — stored with capacityUnit "MMcf/d" so it's correctly excluded
// from the site's MW-based "Capacity waiting" sum (see stats.ts, which
// only sums capacityValue when capacityUnit === "MW"), same precedent as
// LNG's MTPA already documented in prisma/schema.prisma.
//
// NO APPLICATION-FILED DATE: this workbook publishes "Last Updated Date"
// (when EIA last touched the record, not a filing date) and "Year In
// Service Date" (a target date, like EIA-860M's planned-operation date) —
// neither is an application-filed date, so applicationFiledDate is always
// null here, same limitation as eia860mPlanned.ts.
//
// CAUSE CATEGORY: not assigned — same as EIA-860M, the Permitting
// Dashboard, and ORNL hydropower relicensing; this source doesn't publish
// why a project is delayed.
//
// Runs on a weekly cron (src/app/api/cron/ingest-eia-pipelines) in
// production, same "cheap weekly check of a quarterly source" rationale as
// the other non-weekly-published sources. Run
// `npx tsx src/lib/ingest/eiaPipelineProjects.ts` (or `npm run
// ingest:eia-pipelines`) for a manual pull; pass a local file path as
// argv[1] to parse an already-downloaded workbook instead of fetching.

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const DATA_LANDING_PAGE_URL = "https://www.eia.gov/naturalgas/data.php";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const SHEET_NAME_CANDIDATES = ["Natural Gas Pipeline Projects"];

const FIELD_CANDIDATES: Record<string, string[]> = {
  projectName: ["Project Name"],
  operator: ["Pipeline Operator Name"],
  projectType: ["Project Type"],
  status: ["Status"],
  yearInServiceDate: ["Year In Service Date"],
  states: ["State(s)"],
  costMillions: ["Cost (millions)"],
  miles: ["Miles"],
  capacityMmcfd: ["Additional Capacity (MMcf/d)"],
  pipelineType: ["Pipeline Type"],
  authority: ["Authority"],
  docketNumber: ["Docket/Permit Number"],
  demandServed: ["Demand Served"],
  website: ["Website"],
};

type FieldMap = Record<keyof typeof FIELD_CANDIDATES, string | undefined>;

// EIA's own header cell has a double space ("Docket/Permit  Number") —
// collapse repeated whitespace before matching so FIELD_CANDIDATES above
// can stay written the normal way rather than embedding that quirk.
function normalizeHeaderCell(h: unknown): string {
  return h?.toString().replace(/\s+/g, " ").trim() ?? "";
}

function resolveFieldMap(headerRow: string[]): FieldMap {
  const normalized = headerRow.map(normalizeHeaderCell);
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
      `EIA pipeline projects parser could not find columns for: ${missing.join(", ")}. ` +
        `EIA has changed column names before — open the downloaded workbook's real header row ` +
        `(row 2) and update FIELD_CANDIDATES in src/lib/ingest/eiaPipelineProjects.ts.`,
    );
  }

  return map;
}

// Per the workbook's own "Definitions" tab: "na" = not available, "-" =
// unknown. Neither is real content — normalize both (and blank strings) to
// null so they don't leak into the UI as literal text.
function cleanCell(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "na" || s === "-") return null;
  return s;
}

// See module header STATUS -> STAGE MAPPING for the full reasoning.
function statusToStage(status: string): ProjectStage {
  const s = status.trim().toLowerCase();
  switch (s) {
    case "announced":
    case "proposed":
      return "planned_pre_filing";
    case "pre-applied":
    case "applied":
    case "on hold":
      return "agency_permitting";
    case "approved":
      return "approved_awaiting_construction";
    case "construction":
    case "part completed":
      return "under_construction";
    case "completed":
      return "completed";
    case "denied":
    case "cancelled":
      return "cancelled";
    default:
      return "agency_permitting";
  }
}

interface PipelineRow {
  [column: string]: string | number | null;
}

export function parseWorkbookBuffer(buf: Buffer): PipelineRow[] {
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((n) =>
    SHEET_NAME_CANDIDATES.some((c) => n.toLowerCase() === c.toLowerCase()),
  );
  if (!sheetName) {
    throw new Error(
      `Could not find a sheet among candidates [${SHEET_NAME_CANDIDATES.join(", ")}]. ` +
        `Sheets in this workbook: ${workbook.SheetNames.join(", ")}`,
    );
  }
  const sheet = workbook.Sheets[sheetName];
  // Row 0 is a title cell, not data — the real header is row index 1. See
  // module header.
  const rows = XLSX.utils.sheet_to_json<PipelineRow>(sheet, { defval: null, range: 1 });
  return rows;
}

export function parseWorkbook(filePath: string): PipelineRow[] {
  return parseWorkbookBuffer(readFileSync(filePath));
}

export function normalizePipelineRow(row: PipelineRow, fieldMap: FieldMap): NormalizedProject | null {
  const get = (field: keyof typeof FIELD_CANDIDATES) => {
    const col = fieldMap[field];
    return col ? cleanCell(row[col]) : null;
  };

  const rawStatus = get("status");
  if (!rawStatus) return null; // genuinely blank/unrecognized — see module header

  const projectName = get("projectName") ?? "Unnamed pipeline project";
  const operator = get("operator") ?? "";
  const docketNumber = get("docketNumber");
  // Docket number is the natural stable ID when published, but it's often
  // null (pre-FERC-filing projects don't have one yet) — fall back to
  // operator+name, matching the identity-key pattern used by every other
  // module in this directory when a source-native ID isn't reliably present.
  const idBasis = docketNumber ?? `${operator}-${projectName}`;
  const matchKey = resolveMatchKey("eiaPipelines", idBasis);

  const capacityRaw = get("capacityMmcfd");
  const capacityValue = capacityRaw != null ? Number(capacityRaw) : NaN;

  const milesRaw = get("miles");
  const costRaw = get("costMillions");
  const yearInService = get("yearInServiceDate");

  const noteParts = [
    "No application-filed date is published by this source, only a target Year In Service " +
      `(${yearInService ?? "unknown"}) — days/years waiting cannot be computed for this project.`,
  ];
  if (milesRaw) noteParts.push(`Project length: ${milesRaw} miles.`);
  if (costRaw) noteParts.push(`Estimated cost: $${costRaw} million.`);

  const causeSlugs: CauseSlug[] = []; // see module header: this source doesn't publish why a project is delayed

  return {
    matchKey,
    name: operator ? `${projectName} (${operator})` : projectName,
    projectType: "pipeline",
    fuelType: "pipeline",
    lat: null,
    lon: null,
    state: get("states"),
    county: null,
    capacityValue: Number.isFinite(capacityValue) ? capacityValue : null,
    capacityUnit: "MMcf/d",
    applicationFiledDate: null,
    dateConfidence: "approximate",
    currentStatus: `EIA pipeline tracker: ${rawStatus}${get("pipelineType") ? ` (${get("pipelineType")} pipeline)` : ""}`,
    currentStage: statusToStage(rawStatus),
    causeSlugs,
    causeDetail:
      'Imported from EIA\'s "Natural Gas Pipeline Projects" tracker. Cause category not yet determined — this source doesn\'t publish why a project is delayed; needs manual review.',
    dataQualityNote: noteParts.join(" "),
    sources: [
      {
        label: "EIA Natural Gas Pipeline Projects tracker",
        url: DATA_LANDING_PAGE_URL,
      },
    ],
    externalIds: { eiaPipelines: idBasis },
  };
}

export interface IngestSummary {
  upserted: number;
  skippedNotWaiting: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
  sourceFileUrl?: string;
}

export async function ingestPipelineProjectsBuffer(buf: Buffer): Promise<IngestSummary> {
  const rows = parseWorkbookBuffer(buf);
  if (rows.length === 0) {
    return { upserted: 0, skippedNotWaiting: 0, removedResolved: 0, errors: [] };
  }
  const headerRow = Object.keys(rows[0]);
  const fieldMap = resolveFieldMap(headerRow);

  let skippedNotWaiting = 0;
  const toUpsert: NormalizedProject[] = [];

  for (const row of rows) {
    const normalized = normalizePipelineRow(row, fieldMap);
    if (!normalized) {
      skippedNotWaiting += 1;
      continue;
    }
    toUpsert.push(normalized);
  }

  const { upserted, removedResolved, errors } = await upsertNormalizedProjects(toUpsert);

  return { upserted, skippedNotWaiting, removedResolved, errors };
}

export async function ingestPipelineProjects(filePath: string): Promise<IngestSummary> {
  return ingestPipelineProjectsBuffer(readFileSync(filePath));
}

// Scrapes the most recent .xlsx link off the landing page rather than
// guessing a filename — see module header for why the naming convention
// itself isn't predictable enough to construct.
export async function findCurrentWorkbookUrl(): Promise<string> {
  const res = await fetch(DATA_LANDING_PAGE_URL, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${DATA_LANDING_PAGE_URL}: ${res.status}`);
  }
  const html = await res.text();
  const match = /href="([^"]*NaturalGasPipelineProjects[^"]*\.xlsx)"/i.exec(html);
  if (!match) {
    throw new Error(
      `Could not find a NaturalGasPipelineProjects .xlsx link on ${DATA_LANDING_PAGE_URL} — ` +
        `EIA may have restructured the page.`,
    );
  }
  const href = match[1];
  return href.startsWith("http") ? href : new URL(href, DATA_LANDING_PAGE_URL).toString();
}

export async function fetchAndIngestCurrentWorkbook(): Promise<IngestSummary> {
  const url = await findCurrentWorkbookUrl();
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const summary = await ingestPipelineProjectsBuffer(buf);
  return { ...summary, sourceFileUrl: url };
}

if (require.main === module) {
  const filePath = process.argv[2] ?? process.env.EIA_PIPELINES_XLSX_PATH;
  const run = filePath ? ingestPipelineProjects(filePath) : fetchAndIngestCurrentWorkbook();
  run
    .then((summary) => {
      console.log(
        `EIA pipeline projects ingestion complete: upserted ${summary.upserted} projects ` +
          `(${summary.skippedNotWaiting} unrecognized-status rows, ` +
          `excluded/removed ${summary.removedResolved} approved/under-construction/completed/cancelled rows, ` +
          `${summary.errors.length} errors).` + (summary.sourceFileUrl ? ` Source: ${summary.sourceFileUrl}` : ""),
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
