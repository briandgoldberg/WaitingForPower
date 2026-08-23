// Arizona Corporation Commission (ACC) Line Siting Committee docket
// ingestion — sixth state in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23 (a parallel research agent found the
// endpoint first; every claim below was independently re-verified via curl
// before writing this module, per this project's standing practice).
//
// FETCHING: efiling.azcc.gov exposes a real JSON API, no auth, no CSRF:
//   - Search: POST /api/edocket/searchByDocketDetailRequest with a JSON
//     body `{docketTypeID:1231, caseTypeID:18, rowsPerPage, currentPageIndex}`
//     — docketTypeID 1231 = "Line Siting Committee", caseTypeID 18 =
//     "Siting Committee" (both confirmed against the API's own
//     `allDocketTypes`/`caseTypes` lookup lists, not guessed). Confirmed
//     gotcha: omitting `rowsPerPage` (or passing 0, matching a naive read
//     of the request shape) returns `searchResult: []` despite a correct,
//     non-zero `totalRowCount` — the request "succeeds" with an empty
//     payload, no error. A real `rowsPerPage` (this module uses 250, more
//     than the current ~185-docket total) is required to get rows back.
//     Total docket history goes back to 1973; bounded to the last
//     LOOKBACK_YEARS to avoid a detail fetch per multi-decade-old docket
//     that's certainly long since resolved either way.
//   - Detail: GET /api/edocket/docket/{docketID} (the numeric `docketID`
//     from search results, not the public docket number string) returns a
//     `docketStatus.value` field and a `decisions` array — see STATUS.
// Note two separate hosts: efiling.azcc.gov is this API (and the filing
// tool); edocket.azcc.gov is a separate human-facing search UI that reads
// the same underlying data — confirmed by hand that
// https://edocket.azcc.gov/search/docket-search/item-detail/{docketID}
// renders the same docket, so that's the URL used for each project's
// public source link (a raw JSON API endpoint wouldn't be a useful link
// for a site visitor to click).
//
// STATUS — same lesson as South Carolina, independently rediscovered here:
// the docket's own `docketStatus.value` string is not reliable evidence of
// resolution. Confirmed 2026-08-23 against docket 26574 (filed Dec 2022):
// its `docketStatus.value` still reads "Open," but its `decisions` array
// already contains a "Decision - Certificate of Environmental
// Compatibility" dated March 2023 — the certificate was granted five
// months after filing and the status field was simply never updated to
// reflect it. Most currently-recent dockets instead show "Compliance Due"
// (52 of a real 64-docket batch checked by hand) — which turns out to mean
// the same thing: a certificate was already granted and the docket is now
// in post-decision compliance monitoring, confirmed by checking that every
// "Compliance Due" docket sampled had a non-empty `decisions` array too.
// The real signal is `decisions` itself, not the status string:
//   - Empty `decisions` array: no final ruling yet, still waiting (matches
//     the two genuinely-active statuses seen, "Pending Before Line Siting
//     Committee" and "Open Meeting Pending," plus "Continued Indefinitely,"
//     an indefinitely-postponed hearing that's still procedurally open).
//   - Any `decisions` entry whose description signals denial/dismissal:
//     resolved as cancelled.
//   - Any other non-empty `decisions` array: resolved as granted. Every
//     description observed in a real 64-docket sample was "Decision -
//     Certificate of Environmental Compatibility," "Decision," "Decision -
//     Dissenting Opinion," or "Decision - Amends a Previous Decision" — no
//     real denial was observed to calibrate DENY_RE against, so it's a
//     best-effort keyword match (denying/denial/dismiss), not confirmed
//     against a real example the way the grant path is.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields, but AZ's `company`
// field on each search result is a clean, pre-parsed applicant name (no
// text-regex extraction needed, unlike Texas/South Carolina), and its
// `description` field consistently narrates "...authorizing the [Project]
// located in [County] County, Arizona," making county extraction reliable
// the same way it is for South Carolina. Fuel/technology keyword-matched
// from the description text, same caveats as the other keyword-based
// sources in this series (LNG/geothermal not observed in a real sample —
// included as an easy add if it ever shows up, not verified against one).
//
// NOT WIRED TO CRON YET, same as the other per-state modules. Also
// politeness-delayed between per-candidate detail requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://efiling.azcc.gov";
const DOCKET_TYPE_LINE_SITING = 1231;
const CASE_TYPE_SITING_COMMITTEE = 18;

export const MAX_CANDIDATES = 100;
const REQUEST_DELAY_MS = 250;
const LOOKBACK_YEARS = 5;
// Comfortably above the current ~185-docket all-time total for this
// docket/case type combination — see module header for why rowsPerPage
// must be a real positive number at all.
const SEARCH_ROWS_PER_PAGE = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DocketSearchResult {
  docketID: number;
  docketNumber: string;
  companyName: string;
  description: string;
  filedDate: string;
}

async function searchCandidates(): Promise<DocketSearchResult[]> {
  const res = await fetch(`${BASE_URL}/api/edocket/searchByDocketDetailRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      docketTypeID: DOCKET_TYPE_LINE_SITING,
      caseTypeID: CASE_TYPE_SITING_COMMITTEE,
      currentPageIndex: 0,
      rowsPerPage: SEARCH_ROWS_PER_PAGE,
    }),
  });
  if (!res.ok) throw new Error(`AZ ACC search request failed (${res.status})`);
  const data = (await res.json()) as { searchResult: DocketSearchResult[] };
  if (!Array.isArray(data.searchResult)) {
    throw new Error(
      "AZ ACC search response didn't contain a searchResult array — the API shape likely changed. Check searchCandidates in src/lib/ingest/azAccLineSiting.ts against a fresh response.",
    );
  }
  return data.searchResult;
}

interface DocketDetail {
  resolution: "granted" | "denied" | null;
}

const DENY_RE = /\bdeny(?:ing|al)?\b|\bdismiss/i;

async function fetchDetail(docketID: number): Promise<DocketDetail> {
  const res = await fetch(`${BASE_URL}/api/edocket/docket/${docketID}`);
  if (!res.ok) throw new Error(`AZ ACC detail request failed (${res.status}) for docket ${docketID}`);
  const data = (await res.json()) as { decisions?: { description: string }[] };
  const decisions = data.decisions ?? [];
  if (decisions.length === 0) return { resolution: null };
  const denied = decisions.some((d) => DENY_RE.test(d.description));
  return { resolution: denied ? "denied" : "granted" };
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(thermal plant|combined cycle|combustion turbine|natural gas|gas[- ]fired)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Checked before any fuel keyword, same reasoning as txPuctDockets.ts /
// scPscDockets.ts: a transmission line's own route/substation names
// shouldn't be misread as a generation fuel.
const TRANSMISSION_RE = /\btransmission\b|\bkv\s+(?:double-circuit\s+)?line\b|\bsubstation\b/i;
const STORAGE_RE = /\benergy storage\b|\bbattery\b|\bbess\b/i;

function inferProjectType(description: string): ProjectType {
  if (TRANSMISSION_RE.test(description)) return "transmission";
  if (STORAGE_RE.test(description)) return "storage";
  return "generation";
}

function inferFuelType(description: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(description)) return fuel;
  }
  return "other";
}

function extractCounty(description: string): string | null {
  const m = /located\s+(?:in|within)\s+([A-Z][A-Za-z\s]*?)\s+County,?\s+Arizona/i.exec(description);
  return m ? m[1].trim() : null;
}

function extractCapacityMw(description: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW(?:ac)?\b/i.exec(description);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parseIsoDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeDocket(search: DocketSearchResult, detail: DocketDetail): NormalizedProject {
  const matchKey = resolveMatchKey("az-acc", search.docketNumber);
  const projectType = inferProjectType(search.description);
  const fuelType = inferFuelType(search.description, projectType);
  const capacityMw = extractCapacityMw(search.description);
  const county = extractCounty(search.description);

  let currentStage: ProjectStage;
  if (detail.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (detail.resolution === "denied") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Arizona Corporation Commission's public eDocket system, Line Siting Committee dockets.",
    'The docket\'s own "Status" field is not reliable (observed to still read "Open" on a docket whose certificate had already been granted); "still waiting" here is inferred from whether the docket has any recorded Commission decision — see the ingestion module header for how this was calibrated.',
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket description text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket description text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Arizona, per the docket description — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${search.companyName.trim()} (AZ ACC Docket ${search.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "AZ",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: parseIsoDate(search.filedDate),
    dateConfidence: "exact",
    currentStatus: `Arizona ACC Line Siting docket ${search.docketNumber}: ${detail.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Environmental Compatibility from the Arizona Corporation Commission's Line Siting Committee — Docket No. ${search.docketNumber}, "${search.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `AZ ACC Docket No. ${search.docketNumber}`,
        url: `https://edocket.azcc.gov/search/docket-search/item-detail/${search.docketID}`,
      },
    ],
    externalIds: { azAcc: search.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  recentCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestAzAccLineSiting(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allCandidates = await searchCandidates();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);
  const candidates = allCandidates
    .filter((c) => {
      const filed = parseIsoDate(c.filedDate);
      return filed != null && filed >= cutoff;
    })
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const detail = await fetchDetail(candidate.docketID);
      toUpsert.push(normalizeDocket(candidate, detail));
    } catch (err) {
      errors.push({ matchKey: candidate.docketNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: allCandidates.length,
    recentCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestAzAccLineSiting()
    .then((summary) => {
      console.log(
        `Arizona ACC Line Siting docket ingestion complete: ${summary.candidatesFound} total dockets, ` +
          `${summary.recentCandidates} within the ${LOOKBACK_YEARS}-year lookback, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
