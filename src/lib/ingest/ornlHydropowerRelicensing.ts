// ORNL "U.S. Hydropower Relicensing and License Surrender" dataset —
// closes a gap explicitly flagged in this project's own README/ingest docs
// ("hydropower relicensing detail" was named as notably absent). Published
// annually by Oak Ridge National Laboratory's HydroSource program (DOE
// Water Power Technologies Office), built from FERC's own relicensing
// docket data, as an Excel workbook linked from a per-year dataset page.
//
// SCOPE: this module only reads the "Relicenses" sheet — a FERC hydropower
// project whose existing license is expiring and is going through FERC's
// relicensing process (Integrated/Traditional/Alternative Licensing
// Process — ILP/TLP/ALP). The workbook's separate "Surrenders" sheet
// (license surrender applications — an owner giving up its FERC license,
// generally to decommission or exit FERC jurisdiction) is deliberately not
// ingested: that's a project *leaving* the regulatory process this site
// tracks, not one waiting on approval to do something.
//
// FETCHING: like LBNL Queued Up, there's no stable filename — the dataset
// page URL and the workbook filename both embed the edition year (e.g.
// ".../us-hydropower-relicensing-and-license-surrender-data-2026/..."), so
// findCurrentDatasetPageUrl() below walks backward from the current year
// (like eia860mPlanned.ts's month-walk) to find the most recent real page,
// then scrapes the .xlsx download link out of its HTML (like
// lbnlQueuedUp.ts). Confirmed 2026-08-16: the page 200s without a
// browser-like User-Agent, but one is set anyway for consistency/safety
// with the same pattern used against emp.lbl.gov.
//
// STATUS FILTER (confirmed live 2026-08-16 against the 2026 edition, 407
// rows on the Relicenses sheet): "Issued Relicense" (198) and "Converted
// to Exemption" (9) are already resolved — excluded. "Pending Relicense"
// (160) and "Submitted NOI to Relicense" (40) are still waiting on FERC —
// the 200 rows this module ingests.
//
// CAPACITY FLOOR: MIN_CAPACITY_MW matches the site-wide 250 MW floor
// (eia860mPlanned.ts, lbnlQueuedUp.ts) for consistency about what counts as
// a tracked "project" — even though that's a much smaller slice of this
// source than the others (17 of 200 waiting rows clear 250 MW as of the
// 2026 edition; most FERC-licensed hydro projects are small municipal or
// private dams). Raising/lowering it is a product decision, not a
// technical limit, same as the other two floored sources.
//
// GEOCODING: unlike the Permitting Dashboard and LBNL Queued Up, this
// source publishes real per-project Latitude/Longitude (EHA-sourced, not a
// county centroid) — no approximation needed, and no dataQualityNote
// caveat about pin accuracy.
//
// DATES: NOI_date and Application_date are both real per-project dates
// (Excel serial numbers, same epoch-quirk as lbnlQueuedUp.ts — see
// excelSerialToDate). applicationFiledDate prefers Application_date (the
// relicense application itself); Submitted-NOI-only rows (application not
// yet filed) fall back to NOI_date so they still get a "waiting" figure,
// with dateConfidence left "exact" either way since both are real
// FERC-recorded dates, just for different milestones.
//
// CAUSE CATEGORY: not assigned, same as EIA-860M and the Permitting
// Dashboard — FERC relicensing doesn't cleanly map to any single one of
// this site's seven cause slugs (it's not quite "multi_agency_permitting",
// which implies several different agencies), so causeSlugs ships empty
// rather than guessed.
//
// LICENSE / REDISTRIBUTION: HydroSource's Data Use Policy
// (https://hydrosource.ornl.gov/data-use-policy/) — same open question as
// the other two floored sources (README point #6): not independently
// confirmed as a formal redistribution license, just cited/linked here per
// that policy's evident request norm.
//
// Runs on a weekly cron (src/app/api/cron/ingest-ornl-hydro) in production,
// same rationale as LBNL Queued Up: annual source, cheap weekly HTML check,
// no manual step. Run `npx tsx src/lib/ingest/ornlHydropowerRelicensing.ts`
// (or `npm run ingest:ornl-hydro`) for a manual pull; pass a local file
// path as argv[1] to parse an already-downloaded workbook instead.
export const MIN_CAPACITY_MW = 250;

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const DATASET_LANDING_PAGE_PREFIX =
  "https://hydrosource.ornl.gov/data/datasets/us-hydropower-relicensing-and-license-surrender-data-";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const SHEET_NAME_CANDIDATES = ["Relicenses"];

const FIELD_CANDIDATES: Record<string, string[]> = {
  fercDocket: ["FERC_docket"],
  projectName: ["Project_name"],
  licensee: ["Project_licensee"],
  waterway: ["Waterway"],
  projectType: ["Project_type"],
  latitude: ["Latitude"],
  longitude: ["Longitude"],
  state: ["State"],
  noiDate: ["NOI_date"],
  applicationDate: ["Application_date"],
  procType: ["Proc_type"],
  status: ["Status"],
  capacityMw: ["Capacity_new_MW"],
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
      `ORNL hydropower relicensing parser could not find columns for: ${missing.join(", ")}. ` +
        `Open the downloaded workbook's "Field Descriptions" tab and update FIELD_CANDIDATES in ` +
        `src/lib/ingest/ornlHydropowerRelicensing.ts.`,
    );
  }

  return map;
}

// Both statuses this module ingests are FERC's own relicensing pipeline —
// see module header on why neither maps to a more specific stage than the
// generic "agency permitting" bucket already used for the other two
// floored sources' pre-construction statuses.
function statusToStage(_status: string): ProjectStage {
  return "agency_permitting";
}

// Same Excel-serial-date handling as lbnlQueuedUp.ts (Dec-30-1899 epoch).
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateCell(cell: string | number | null | undefined): Date | null {
  if (cell == null || cell === "" || cell === "NA") return null;
  if (typeof cell === "number") return excelSerialToDate(cell);
  const d = new Date(cell);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface RelicenseRow {
  [column: string]: string | number | null;
}

export function parseWorkbookBuffer(buf: Buffer): RelicenseRow[] {
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
  const rows = XLSX.utils.sheet_to_json<RelicenseRow>(sheet, { defval: null });
  return rows;
}

export function parseWorkbook(filePath: string): RelicenseRow[] {
  return parseWorkbookBuffer(readFileSync(filePath));
}

const WAITING_STATUSES = new Set(["Pending Relicense", "Submitted NOI to Relicense"]);

export function normalizeRelicenseRow(row: RelicenseRow, fieldMap: FieldMap): NormalizedProject | null {
  const get = (field: keyof typeof FIELD_CANDIDATES) => {
    const col = fieldMap[field];
    return col ? row[col] : undefined;
  };

  const status = String(get("status") ?? "").trim();
  if (!WAITING_STATUSES.has(status)) return null;

  const fercDocket = String(get("fercDocket") ?? "");
  const matchKey = resolveMatchKey("ornlHydro", fercDocket);
  const projectName = String(get("projectName") ?? "Unnamed hydropower project");
  const procType = String(get("procType") ?? "");

  const applicationDate = parseDateCell(get("applicationDate") as string | number | null);
  const noiDate = parseDateCell(get("noiDate") as string | number | null);
  const filedDate = applicationDate ?? noiDate;

  const lat = Number(get("latitude") ?? NaN);
  const lon = Number(get("longitude") ?? NaN);
  const capacityMw = Number(get("capacityMw") ?? NaN);

  const causeSlugs: CauseSlug[] = []; // see module header: not assigned, same as EIA/Permitting Dashboard

  return {
    matchKey,
    name: `${projectName} (FERC No. ${fercDocket || "?"})`,
    projectType: "generation",
    fuelType: "hydro",
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    state: get("state") ? String(get("state")) : null,
    county: null, // not published on this source
    capacityValue: Number.isFinite(capacityMw) ? capacityMw : null,
    capacityUnit: "MW",
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `FERC relicensing: ${status}${procType && procType !== "NA" ? ` (${procType} process)` : ""}`,
    currentStage: statusToStage(status),
    causeSlugs,
    causeDetail:
      "Imported from ORNL HydroSource's hydropower relicensing dataset. Cause category not yet determined — FERC relicensing doesn't map cleanly onto this site's seven cause categories; needs manual review.",
    dataQualityNote:
      applicationDate == null && noiDate != null
        ? "No relicense application has been filed yet — the waiting-time figure uses this project's notice-of-intent (NOI) date instead, an earlier milestone in the same FERC process."
        : null,
    sources: [
      {
        label: "ORNL HydroSource — U.S. Hydropower Relicensing dataset",
        url: "https://hydrosource.ornl.gov/data/datasets/",
      },
    ],
    externalIds: { ornlHydro: fercDocket },
  };
}

export interface IngestSummary {
  upserted: number;
  skippedBelowFloor: number;
  skippedNotWaiting: number;
  errors: { matchKey: string; message: string }[];
  sourceFileUrl?: string;
}

export async function ingestOrnlHydroBuffer(
  buf: Buffer,
  minCapacityMw = MIN_CAPACITY_MW,
): Promise<IngestSummary> {
  const rows = parseWorkbookBuffer(buf);
  if (rows.length === 0) {
    return { upserted: 0, skippedBelowFloor: 0, skippedNotWaiting: 0, errors: [] };
  }
  const headerRow = Object.keys(rows[0]);
  const fieldMap = resolveFieldMap(headerRow);

  let skippedBelowFloor = 0;
  let skippedNotWaiting = 0;
  const toUpsert: NormalizedProject[] = [];

  for (const row of rows) {
    const capacity = Number(row[fieldMap.capacityMw!] ?? NaN);
    // Only drop rows *clearly* below the floor — same reasoning as
    // eia860mPlanned.ts / lbnlQueuedUp.ts: an unpublished/unparseable
    // capacity figure isn't evidence a project is small.
    if (Number.isFinite(capacity) && capacity < minCapacityMw) {
      skippedBelowFloor += 1;
      continue;
    }
    const normalized = normalizeRelicenseRow(row, fieldMap);
    if (!normalized) {
      skippedNotWaiting += 1;
      continue;
    }
    toUpsert.push(normalized);
  }

  const { upserted, errors } = await upsertNormalizedProjects(toUpsert);

  return { upserted, skippedBelowFloor, skippedNotWaiting, errors };
}

export async function ingestOrnlHydro(filePath: string, minCapacityMw = MIN_CAPACITY_MW): Promise<IngestSummary> {
  return ingestOrnlHydroBuffer(readFileSync(filePath), minCapacityMw);
}

// Walks backward from the current year (like eia860mPlanned.ts's month
// walk) to find the most recent real dataset page, then scrapes the .xlsx
// download link out of its HTML (like lbnlQueuedUp.ts's landing-page
// scrape) — this dataset's page URL and filename both embed the edition
// year, with no predictable "current" alias.
export async function findCurrentWorkbookUrl(yearsToCheck = 3): Promise<string> {
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < yearsToCheck; i++) {
    const year = currentYear - i;
    const pageUrl = `${DATASET_LANDING_PAGE_PREFIX}${year}/`;
    let pageRes: Response;
    try {
      pageRes = await fetch(pageUrl, { headers: BROWSER_HEADERS });
    } catch {
      continue;
    }
    if (!pageRes.ok) continue;
    const html = await pageRes.text();
    const match = /href="([^"]+\.xlsx)"/i.exec(html);
    if (match) {
      return match[1].startsWith("http") ? match[1] : new URL(match[1], pageUrl).toString();
    }
  }
  throw new Error(
    `Could not find a real ORNL hydropower relicensing dataset page in the last ${yearsToCheck} years — ` +
      `ORNL may have changed their URL naming convention. Check https://hydrosource.ornl.gov/data/datasets/ manually.`,
  );
}

export async function fetchAndIngestCurrentWorkbook(minCapacityMw = MIN_CAPACITY_MW): Promise<IngestSummary> {
  const url = await findCurrentWorkbookUrl();
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const summary = await ingestOrnlHydroBuffer(buf, minCapacityMw);
  return { ...summary, sourceFileUrl: url };
}

if (require.main === module) {
  const filePath = process.argv[2] ?? process.env.ORNL_HYDRO_XLSX_PATH;
  const run = filePath ? ingestOrnlHydro(filePath) : fetchAndIngestCurrentWorkbook();
  run
    .then((summary) => {
      console.log(
        `ORNL hydropower relicensing ingestion complete: upserted ${summary.upserted} projects ` +
          `(skipped ${summary.skippedBelowFloor} below the ${MIN_CAPACITY_MW} MW floor, ` +
          `${summary.skippedNotWaiting} already-resolved/unrecognized-status rows, ` +
          `${summary.errors.length} errors).` + (summary.sourceFileUrl ? ` Source: ${summary.sourceFileUrl}` : ""),
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
