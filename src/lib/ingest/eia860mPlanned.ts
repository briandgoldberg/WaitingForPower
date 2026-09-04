// EIA-860M "Planned" generators — the backbone list of proposed U.S.
// generation/storage projects nationally.
//
// SUPERSEDES eia.ts. That module queried the EIA API v2
// `electricity/operating-generator-capacity` route, which — confirmed live
// on 2026-08-14 by querying its `/facet/status/` endpoint — only has four
// status values: OP (Operating), OS/OA (out of service), SB (standby). None
// of those are "planned." There is no API v2 route anywhere (checked every
// route under every top-level namespace, not just `electricity`) that
// exposes planned/proposed generators. EIA only publishes that data as the
// "Planned" tab of the monthly EIA-860M Excel workbook — this module reads
// that file instead, using the same download-and-parse pattern as
// lbnlQueuedUp.ts. eia.ts is left in place for its EIA-860M-status-code
// research value but should not be run — it will always return 0 rows for
// "proposed" and either nothing or already-built plants for anything else.
//
// GETTING THE FILE: https://www.eia.gov/electricity/data/eia860m/ lists a
// full year of month names as links, but most of them 200-OK to a small
// (~15KB) `text/html` "not found yet" page, not the real file — only the
// most recently actually-released month returns the real
// `.xlsx`/`spreadsheetml` file (confirmed 2026-08-14: only
// `xls/june_generator2026.xlsx` was real; every "newer"-sounding month name
// listed on the page was the soft-404 page). `findCurrentWorkbookUrl` below
// checks Content-Type, not just HTTP status, and walks backward from the
// current month to find the most recent real file. There is roughly a
// 2-month publication lag.
//
// CAPACITY FLOOR: the Planned tab is generator-level, not project-level,
// and includes everything from multi-hundred-MW power plants down to
// ~1 MW single-building rooftop solar arrays (e.g. individual Prologis
// warehouse rooftops, confirmed in the 2026-06 file). Importing all ~2,300
// rows unfiltered would flood the map with distributed generation that
// doesn't match this site's "energy project" framing and would dilute the
// individually-cited seed projects already in the database. MIN_CAPACITY_MW
// below is a deliberate, documented judgment call, not a technical limit —
// raise or lower it and re-run any time; upserts are idempotent by
// plant+generator ID either way. Only rows with a *known* capacity below
// this floor are dropped — a missing/unparseable capacity figure isn't
// evidence a project is small, so it's kept rather than excluded (per
// explicit product decision, matching how the Permitting Dashboard, which
// never publishes capacity at all, was never floor-filtered either).
export const MIN_CAPACITY_MW = 250;

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const SHEET_NAME_CANDIDATES = ["Planned"];

const FIELD_CANDIDATES: Record<string, string[]> = {
  entityId: ["Entity ID"],
  entityName: ["Entity Name"],
  plantId: ["Plant ID"],
  plantName: ["Plant Name"],
  state: ["Plant State", "State"],
  county: ["County"],
  balancingAuthorityCode: ["Balancing Authority Code"],
  sector: ["Sector"],
  generatorId: ["Generator ID"],
  nameplateCapacityMw: ["Nameplate Capacity (MW)"],
  netSummerCapacityMw: ["Net Summer Capacity (MW)"],
  netWinterCapacityMw: ["Net Winter Capacity (MW)"],
  technology: ["Technology"],
  energySourceCode: ["Energy Source Code"],
  primeMoverCode: ["Prime Mover Code"],
  plannedOperationMonth: ["Planned Operation Month"],
  plannedOperationYear: ["Planned Operation Year"],
  status: ["Status"],
  latitude: ["Latitude"],
  longitude: ["Longitude"],
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
      `EIA-860M Planned-tab parser could not find columns for: ${missing.join(", ")}. ` +
        `EIA has changed column names between editions before — open the downloaded workbook ` +
        `and update FIELD_CANDIDATES in src/lib/ingest/eia860mPlanned.ts.`,
    );
  }

  return map;
}

// Same fuel-type mapping as eia.ts (kept independent rather than shared —
// see that module for the offshore-wind/storage reclassification note).
const ENERGY_SOURCE_TO_FUEL_TYPE: Record<string, FuelType> = {
  SUN: "solar",
  WND: "wind_onshore",
  NG: "gas",
  NUC: "nuclear",
  WAT: "hydro",
  GEO: "geothermal",
  MWH: "storage",
  BAT: "storage",
};

function reclassifyFuelType(energySourceCode: string, technology: string): FuelType {
  if (/offshore/i.test(technology)) return "wind_offshore";
  if (/battery|storage/i.test(technology)) return "storage";
  return ENERGY_SOURCE_TO_FUEL_TYPE[energySourceCode] ?? "other";
}

// Status cells look like "(P) Planned for installation, but regulatory
// approvals not initiated" — pull the parenthesized code out.
function extractStatusCode(status: string): string {
  const m = /^\(([A-Z]+)\)/.exec(status ?? "");
  return m ? m[1] : "";
}

// EIA-860M's own status codes already distinguish exactly where a project
// sits — (P) not yet filed, (L) "Category L" (approvals pending, not under
// construction), (T) approvals received but not yet building, (U)/(V)
// under construction at different completion thresholds, (TS) construction
// complete but not yet in commercial operation, (OP) operating — so map
// every recognized code straight through instead of collapsing them into
// one generic "agency_permitting" bucket. Confirmed 2026-08-15: prior to
// this, every EIA-sourced row landed in agency_permitting regardless of
// P/L/T, which is exactly why the Stage column/filter were pulled from the
// UI as low-signal (see git history on ProjectList.tsx / filters.ts) —
// this restores real signal. T/U/V/TS/OP all map to one of
// RESOLVED_STAGES (taxonomies.ts) — see normalizeEiaPlannedRow for why
// they're passed through rather than silently dropped: the shared
// upsertNormalizedProject guard needs to see a project's real current
// stage to delete a stale "still waiting" row once a project it used to
// track has since been approved, started construction, or gone live. Any
// other/unrecognized code still falls back to agency_permitting rather
// than guessing.
function statusToStage(code: string): ProjectStage {
  switch (code) {
    case "P":
      return "planned_pre_filing";
    case "L":
      return "regulatory_approvals_pending";
    case "T":
      return "approved_awaiting_construction";
    case "U":
    case "V":
      return "under_construction";
    case "TS":
    case "OP":
      return "completed";
    default:
      return "agency_permitting";
  }
}

interface PlannedRow {
  [column: string]: string | number | null;
}

export function parseWorkbookBuffer(buf: Buffer): PlannedRow[] {
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
  // EIA-860M's Planned tab has a two-row title/blank header before the real
  // column-name row (row index 2, 0-based) — confirmed in the 2026-06 file.
  const rows = XLSX.utils.sheet_to_json<PlannedRow>(sheet, { defval: null, raw: false, range: 2 });
  return rows;
}

export function parseWorkbook(filePath: string): PlannedRow[] {
  return parseWorkbookBuffer(readFileSync(filePath));
}

export function normalizeEiaPlannedRow(row: PlannedRow, fieldMap: FieldMap): NormalizedProject | null {
  const get = (field: keyof typeof FIELD_CANDIDATES) => {
    const col = fieldMap[field];
    return col ? row[col] : undefined;
  };

  const statusCode = extractStatusCode(String(get("status") ?? ""));
  // Only drop rows with no recognized status at all — everything else
  // (including already-operating/under-construction/approved rows) is
  // normalized with its real stage below and left for the shared
  // upsertNormalizedProject guard (RESOLVED_STAGES, src/lib/ingest/common.ts)
  // to exclude/delete. This site tracks projects "waiting for approval,"
  // and a project mid-construction (or already operating) has cleared that
  // hurdle even if it still faces other real delays — but returning null
  // here instead of letting the shared guard handle it would silently skip
  // re-touching that row forever, leaving a stale "still waiting" project
  // on the site even after the real project moved on. EIA-860M's "Planned"
  // tab includes the whole pipeline from not-yet-started through
  // construction-complete-not-yet-online, so this isn't an edge case —
  // roughly 30% of EIA-sourced rows at the 250 MW floor were U/V/TS as of
  // 2026-08-15.
  if (!statusCode) {
    return null;
  }

  const plantId = String(get("plantId") ?? "");
  const generatorId = String(get("generatorId") ?? "");
  const matchKey = resolveMatchKey("eia", `${plantId}-${generatorId}`);
  const plantName = String(get("plantName") ?? "Unnamed plant");
  const fuelType = reclassifyFuelType(String(get("energySourceCode") ?? ""), String(get("technology") ?? ""));

  const lat = get("latitude") ? Number(get("latitude")) : null;
  const lon = get("longitude") ? Number(get("longitude")) : null;
  const opMonth = get("plannedOperationMonth");
  const opYear = get("plannedOperationYear");
  const plannedOperation =
    opMonth && opYear ? `${String(opMonth).trim()}/${String(opYear).trim()}` : opYear ? String(opYear) : "unknown";
  // EIA-860M publishes month as a 1-12 number and year as a 4-digit number —
  // confirmed against real rows (e.g. the "(2/2027)" example this module's
  // dataQualityNote below cites). Stored as the 1st of that month; year-only
  // rows (no month published) fall back to January 1st of that year — both
  // cases are "approximate" by construction, never "exact".
  const opMonthNum = opMonth ? Number(opMonth) : null;
  const opYearNum = opYear ? Number(opYear) : null;
  const expectedOnlineDate =
    opYearNum && Number.isFinite(opYearNum)
      ? new Date(opYearNum, (opMonthNum && Number.isFinite(opMonthNum) ? opMonthNum : 1) - 1, 1)
      : null;

  const causeSlugs: CauseSlug[] = []; // see module header: this source alone doesn't tell us why

  return {
    matchKey,
    name: `${plantName} (Unit ${generatorId || "?"})`,
    projectType: fuelType === "storage" ? "storage" : "generation",
    fuelType,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    state: get("state") ? String(get("state")) : null,
    county: get("county") ? String(get("county")) : null,
    capacityValue: Number(get("nameplateCapacityMw") ?? NaN) || null,
    capacityUnit: "MW",
    applicationFiledDate: null, // EIA-860M publishes planned in-service date, not an application-filed date
    dateConfidence: "approximate",
    expectedOnlineDate,
    expectedOnlineDateConfidence: "approximate",
    currentStatus: String(get("status") ?? ""),
    currentStage: statusToStage(statusCode),
    causeSlugs,
    causeDetail:
      "Imported from the EIA-860M \"Planned\" generator inventory. Cause category not yet determined — cross-reference with the Permitting Dashboard, LBNL Queued Up, or manual review before attributing this project's delay to a specific bottleneck.",
    dataQualityNote: `No application-filed date is published by EIA-860M, so days/years waiting cannot be computed until one is added via manual override — only a planned operation date (${plannedOperation}) is available.`,
    // The owning utility/developer — see Project.applicant's schema comment.
    applicant: get("entityName") ? String(get("entityName")) : null,
    balancingAuthority: get("balancingAuthorityCode") ? String(get("balancingAuthorityCode")) : null,
    ownerSector: get("sector") ? String(get("sector")) : null,
    netSummerCapacityMw: Number(get("netSummerCapacityMw") ?? NaN) || null,
    netWinterCapacityMw: Number(get("netWinterCapacityMw") ?? NaN) || null,
    primeMoverCode: get("primeMoverCode") ? String(get("primeMoverCode")) : null,
    sources: [
      {
        label: "EIA-860M \"Planned\" generator inventory",
        url: "https://www.eia.gov/electricity/data/eia860m/",
      },
    ],
    externalIds: { eia: `${plantId}-${generatorId}` },
  };
}

export interface IngestSummary {
  upserted: number;
  skippedBelowFloor: number;
  // Rows with no recognized status code at all — everything else
  // (including already-operating/under-construction/approved rows) is
  // normalized and handled by removedResolved below, not skipped here.
  skippedNotWaiting: number;
  // Rows whose real stage is one of RESOLVED_STAGES (taxonomies.ts) —
  // excluded from the site, and any previously-tracked row for the same
  // project deleted. See upsertNormalizedProject in common.ts.
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
  sourceFileUrl?: string;
}

export async function ingestEia860mPlannedBuffer(
  buf: Buffer,
  minCapacityMw = MIN_CAPACITY_MW,
): Promise<IngestSummary> {
  const rows = parseWorkbookBuffer(buf);
  if (rows.length === 0) {
    return { upserted: 0, skippedBelowFloor: 0, skippedNotWaiting: 0, removedResolved: 0, errors: [] };
  }
  const headerRow = Object.keys(rows[0]);
  const fieldMap = resolveFieldMap(headerRow);

  let skippedBelowFloor = 0;
  let skippedNotWaiting = 0;
  const toUpsert: NormalizedProject[] = [];

  for (const row of rows) {
    const capacity = Number(row[fieldMap.nameplateCapacityMw!] ?? NaN);
    // Only drop rows *clearly* below the floor — an unpublished/unparseable
    // capacity figure isn't evidence the project is small, so it's kept
    // rather than treated as failing the floor. Per explicit product
    // decision: the same reasoning already applied to the Permitting
    // Dashboard, which never publishes capacity at all and was never
    // floor-filtered for that reason.
    if (Number.isFinite(capacity) && capacity < minCapacityMw) {
      skippedBelowFloor += 1;
      continue;
    }
    const normalized = normalizeEiaPlannedRow(row, fieldMap);
    if (!normalized) {
      skippedNotWaiting += 1;
      continue;
    }
    toUpsert.push(normalized);
  }

  const { upserted, removedResolved, errors } = await upsertNormalizedProjects(toUpsert);

  return { upserted, skippedBelowFloor, skippedNotWaiting, removedResolved, errors };
}

export async function ingestEia860mPlanned(filePath: string, minCapacityMw = MIN_CAPACITY_MW): Promise<IngestSummary> {
  return ingestEia860mPlannedBuffer(readFileSync(filePath), minCapacityMw);
}

// EIA lists a full year of month-name links on its landing page, but most
// 200-OK to a small text/html "not released yet" placeholder rather than
// the real workbook — see module header. Walk backward from the current
// month (server clock) far enough to cover EIA's typical ~2-month
// publication lag, and return the first URL whose Content-Type is a real
// spreadsheet.
const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export async function findCurrentWorkbookUrl(monthsToCheck = 6): Promise<string> {
  const now = new Date();
  const candidates: { monthsBack: number; url: string }[] = [];
  for (let i = 0; i < monthsToCheck; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    for (const prefix of ["xls", "archive/xls"]) {
      candidates.push({
        monthsBack: i,
        url: `https://www.eia.gov/electricity/data/eia860m/${prefix}/${month}_generator${year}.xlsx`,
      });
    }
  }

  // Check every candidate concurrently (they're small HEAD-equivalent GETs —
  // see module header on why HEAD itself doesn't work against eia.gov)
  // instead of walking through them one at a time — the sequential version
  // could cost several seconds of pure round-trip time before ever reaching
  // the real 14MB download, eating into the serverless time budget for no
  // reason. Prefer the most recent month among whichever candidates turn
  // out real.
  const results = await Promise.all(
    candidates.map(async (c) => {
      try {
        const res = await fetch(c.url);
        const contentType = res.headers.get("content-type") ?? "";
        return { ...c, ok: res.ok && /spreadsheet/i.test(contentType) };
      } catch {
        return { ...c, ok: false };
      }
    }),
  );

  const real = results.filter((r) => r.ok).sort((a, b) => a.monthsBack - b.monthsBack);
  if (real.length === 0) {
    throw new Error(
      `Could not find a real EIA-860M workbook in the last ${monthsToCheck} months — ` +
        `EIA may have changed their URL naming convention. Check https://www.eia.gov/electricity/data/eia860m/ manually.`,
    );
  }
  return real[0].url;
}

export async function fetchAndIngestCurrentWorkbook(minCapacityMw = MIN_CAPACITY_MW): Promise<IngestSummary> {
  const url = await findCurrentWorkbookUrl();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const summary = await ingestEia860mPlannedBuffer(buf, minCapacityMw);
  return { ...summary, sourceFileUrl: url };
}

if (require.main === module) {
  const filePath = process.argv[2] ?? process.env.EIA_860M_XLSX_PATH;
  if (!filePath) {
    console.error(
      "Usage: npx tsx src/lib/ingest/eia860mPlanned.ts <path-to-downloaded-workbook.xlsx>\n" +
        "(or set EIA_860M_XLSX_PATH). Download the current workbook from " +
        "https://www.eia.gov/electricity/data/eia860m/ first — check Content-Type, several " +
        "listed month links soft-404 to an HTML page instead of the real file. Or run " +
        "fetchAndIngestCurrentWorkbook() to do that automatically (used by the cron route).",
    );
    process.exit(1);
  }
  ingestEia860mPlanned(filePath)
    .then((summary) => {
      console.log(
        `EIA-860M Planned ingestion complete: upserted ${summary.upserted} projects ` +
          `(skipped ${summary.skippedBelowFloor} below the ${MIN_CAPACITY_MW} MW floor, ` +
          `${summary.skippedNotWaiting} unrecognized-status rows, ` +
          `excluded/removed ${summary.removedResolved} approved/under-construction/operating rows, ` +
          `${summary.errors.length} errors).`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
