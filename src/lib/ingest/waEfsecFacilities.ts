// Washington Energy Facility Site Evaluation Council (EFSEC) facility
// site-certification ingestion — seventh state in the per-state series
// started with vaSccDockets.ts (see that file's header for the overall
// rationale). Confirmed by hand 2026-08-23.
//
// WHY EFSEC, NOT WUTC: the task brief for this module started from the
// hint that the Washington Utilities and Transportation Commission (WUTC,
// utc.wa.gov) runs a public "Dockets" search, matching every other state in
// this series (a PUC/PSC that itself issues CPCN/siting certificates).
// Washington doesn't work that way. Confirmed by hand against WUTC's own
// exposed-filter docket search (a real, plain GET, server-rendered Drupal
// View at utc.wa.gov/documents-and-proceedings/dockets — no auth, no JS
// required, `?combine=<term>&industry=<id>&field_docket_case_status_target_id=<id>`):
// searching Electric-industry (industry=562) dockets for "certificate",
// "CPCN", "siting", or "certificate of public convenience" returns zero or
// near-zero hits, and the one "certificate" hit found (Docket 050738) turned
// out to be about securities (trust-preferred certificates), not a siting
// certificate. WUTC's ~36,500 total dockets are tariff filings, affiliated-
// interest transactions, rate cases, property transfers, etc. — WUTC simply
// has no CPCN/siting-certificate authority over electric generation or
// transmission facilities. That authority is vested by RCW 80.50 in EFSEC
// instead (for large facilities; smaller ones go through county/city land
// use permitting, out of scope here, same as every other state's sub-
// threshold facilities). So this module ingests EFSEC's facility list, not
// a WUTC docket search — hence the file/function names departing from the
// literal "wa{Agency}Dockets" pattern, same kind of adaptation
// azAccLineSiting.ts made for its non-"dockets" source.
//
// FETCHING: efsec.wa.gov (note: no "www" — www.efsec.wa.gov redirects there)
// is also a plain server-rendered Drupal site, no auth, no JS execution
// required. Two page types:
//   - List: GET /facilities returns every facility EFSEC has ever handled
//     (19 total, confirmed 2026-08-23 — no pagination markup present, this
//     is genuinely EFSEC's entire history since RCW 80.50 only reaches
//     *major* energy facilities, a much smaller universe than a state PUC's
//     full docket load). Each row carries name, slug, county
//     (`class="f-county"`), one-or-more energy-type taxonomy terms
//     (`class="f-type"` — see FUEL/PROJECT TYPE), and a facility-status
//     taxonomy term (`class="f-status"` — see STATUS). No date-based
//     lookback filtering is applied (unlike the higher-volume docket-search
//     states) since the whole list is cheap to fetch and small enough that
//     bounding it would only risk silently dropping a facility.
//   - Detail: GET /facilities/{slug} repeats name/county/type/status and
//     adds an "Applicant or Certificate Holder" field, an "Application
//     received" timeline entry (month/year granularity only — no day is
//     published), a free-text project description paragraph, and — for
//     generation facilities only, never transmission — a "Max generating
//     capacity" field that is frequently just "--" (confirmed empty for
//     Carriger Solar and Goldeneye Battery Storage; a real MW figure is
//     still stated in the description paragraph in Carriger's case, so
//     capacity extraction always tries the structured field first and
//     falls back to a regex over the description text, same
//     tries-structured-then-regex pattern as the other fields below).
//
// STATUS: this is the one place this module's findings *don't* replicate
// the "don't trust the Status field" lesson from every other state in this
// series — but only after checking, per this project's standing practice,
// not assuming. EFSEC's `f-status` facility-status field (a curated
// taxonomy term: "Application review", "Withdrawn", "Awaiting
// construction", "Under construction", "Operational", "Decommissioning")
// looked exactly as suspect as SC's/AZ's own "Status" fields at first
// glance, so it was checked against a real, independently-confirmable
// decided case: Desert Claim (node 114, /facilities/desert-claim). Its
// `f-status` reads "Withdrawn". Its free-text "About" narrative, read on
// its own, would suggest the opposite — it says Gov. Gregoire *approved*
// the project's site certification agreement (SCA) on 2010-02-02, and that
// the SCA was amended twice more (2018, 2023) extending the construction
// deadline to 2028 — which would look like a live, certified,
// awaiting-construction project if that prose were trusted as the
// freshest signal. But the facility's own recent-documents list (fetched
// on the same page, no extra request) contains "Resolution 356 Desert
// Claim SCA termination," dated 2025-06-25 — i.e. the certificate was
// formally terminated four months before this module was written, and the
// `f-status` badge correctly reflects that while the prose paragraph is
// simply stale (last updated for the 2023 amendment, never rewritten for
// the 2025 termination). So here the free-text narrative is the misleading
// field and the structured status badge is the one to trust — the reverse
// of AZ/SC, but the same underlying lesson: verify against a real decided
// case instead of assuming either field is honest by default. `f-status`
// is what this module keys off of; STATUS_TO_STAGE below is exhaustive over
// the 6 real values observed, and normalizeFacility throws on anything else
// (caught per-candidate) rather than silently guessing a 7th.
//
// CANDIDATES: of the 19 facilities, only those with `f-status` ==
// "Application review" are still waiting on a decision — "Awaiting
// construction" and "Under construction" already have an executed SCA
// (RESOLVED_STAGES catches these via currentStage regardless, but they're
// also excluded from FETCHING detail requests for politeness, same as
// every candidate that maps to a resolved stage). As of 2026-08-23 that's
// 5 facilities: Carriger Solar, Cascade Renewable Transmission, Goldeneye
// Battery Storage, Hop Hill Solar, Wallula Gap Solar.
//
// FUEL/PROJECT TYPE: structured, not regex-guessed from prose — the
// `f-type` taxonomy terms observed across all 19 facilities are Solar,
// Wind, Battery, Transmission, Thermal, and "Nuclear fission". Several
// facilities carry more than one term (e.g. a solar array with a
// co-located battery); TYPE_PRIORITY below picks the primary
// generation/transmission identity the same way a real person would name
// the project (a "Battery + Solar" facility is a solar project with
// storage, not a storage project, unless Battery is the *only* term
// present). "Thermal" is mapped to fuelType "gas" as a best-effort default
// (every "Thermal" facility observed — Chehalis, Grays Harbor — is a
// gas-fired plant, and both are long since Operational/resolved so this
// mapping isn't exercised by any real candidate right now); flagged in
// dataQualityNote whenever it's actually used.
//
// Wired to Vercel Cron weekly, 21:00 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-wa-efsec/route.ts) — a real run's timing was
// measured (19 total facilities, 5 candidates) before scheduling this. Also
// politeness-delayed between per-candidate detail requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://efsec.wa.gov";

// Comfortably above the current 19-facility all-time total — see module
// header for why no date-based lookback is needed here (unlike the
// higher-volume docket-search states, the whole list is cheap to fetch).
export const MAX_CANDIDATES = 50;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`WA EFSEC request failed (${res.status}): ${url}`);
  return res.text();
}

interface FacilitySummary {
  slug: string;
  nodeId: string | null;
  name: string;
  county: string | null;
  types: string[];
  status: string;
}

// Nav-dropdown links carry `data-drupal-link-system-path="node/{id}"`,
// giving a stable numeric identity per facility independent of its slug
// (which could in principle be renamed). Parsed from the same /facilities
// response as the facility rows themselves, no extra request.
function parseNodeIdsBySlug(html: string): Map<string, string> {
  const re = /href="(\/facilities\/[^"]+)"[^>]*data-drupal-link-system-path="node\/(\d+)"/g;
  const map = new Map<string, string>();
  for (const m of html.matchAll(re)) map.set(m[1], m[2]);
  return map;
}

// Each facility row on /facilities is, in document order: an <h3> name
// link, a `class="f-county"` div, a `class="f-type"` block (one-or-more
// energy-category taxonomy terms), then a `class="f-status"` block (the
// facility-status taxonomy term). Confirmed against a real fetch of all 19
// current rows — see module header STATUS/CANDIDATES.
const FACILITY_ROW_RE =
  /<h3><a href="(\/facilities\/[^"]+)"[^>]*>([^<]+)<\/a><\/h3>\s*<div class="f-county">([^<]*)<\/div>[\s\S]*?class="f-type[^"]*">([\s\S]*?)class="f-status">([\s\S]*?)field--name-name field--type-string field--label-hidden field__item">([^<]+)</g;

// Energy-category taxonomy terms are inconsistently rendered under two
// different Drupal field machine names depending on the term — some use
// `field--name-name` (e.g. "Solar", "Transmission"), others
// `field--name-field-abbreviated-name` (e.g. "Battery"). Confirmed by hand
// 2026-08-23: matching only `field--name-name` silently drops every
// "Battery" tag. Both are matched here.
const ENERGY_TYPE_NAME_RE = /field--name-(?:name|field-abbreviated-name)[^>]*field__item">([^<]+)</g;

export function parseFacilityList(html: string): FacilitySummary[] {
  const nodeIdsBySlug = parseNodeIdsBySlug(html);
  const results: FacilitySummary[] = [];
  for (const m of html.matchAll(FACILITY_ROW_RE)) {
    const slug = m[1];
    const typeBlock = m[4];
    const types = [...typeBlock.matchAll(ENERGY_TYPE_NAME_RE)].map((t) => t[1].trim());
    results.push({
      slug,
      nodeId: nodeIdsBySlug.get(slug) ?? null,
      name: m[2].trim(),
      county: m[3].trim() || null,
      types,
      status: m[6].trim(),
    });
  }
  if (results.length === 0) {
    throw new Error(
      "WA EFSEC /facilities response matched zero rows — the page structure likely changed. Check FACILITY_ROW_RE in src/lib/ingest/waEfsecFacilities.ts against a fresh response.",
    );
  }
  return results;
}

interface FacilityDetail {
  applicant: string | null;
  filedRaw: string | null;
  description: string | null;
  capacityMw: number | null;
}

function extractLabeledField(html: string, label: string): string | null {
  // Generous window: the label and its value div are separated by a
  // tooltip block with a long `data-bs-title` description (confirmed by
  // hand — a 300-char window silently missed the value on real facility
  // pages; 700 chars comfortably covers it).
  const re = new RegExp(`<h2>${label}<\\/h2>[\\s\\S]{0,700}?<div>([^<]+)<\\/div>`);
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

function extractApplicant(html: string): string | null {
  const m =
    /Applicant or Certificate Holder<\/strong>\s*<div><div class="mt-3">(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?<\/div>/.exec(
      html,
    );
  return m ? m[1].trim() : null;
}

function extractTimelineDate(html: string, label: string): string | null {
  const re = new RegExp(`timeline-label">${label}<\\/div>([^<]+)`);
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

function extractDescription(html: string): string | null {
  const m = /<div class="d-block w-100 mt-3">([\s\S]*?)<\/div>/.exec(html);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

// Matches both "500 megawatts (MW)" (the structured "Max generating
// capacity" field's own format) and "200-megawatt (MW)" / "160 megawatts
// (MW)" as they appear inline in description prose — confirmed against
// real Goldeneye ("200-megawatt (MW)/800-megawatt hour (MWh)") and
// Carriger ("160 megawatts (MW) ... and 63 MW") text.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)[\s-]*megawatts?\s*\(MW\)/i;

function extractCapacityMw(text: string | null): number | null {
  if (!text) return null;
  const m = CAPACITY_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

async function fetchFacilityDetail(slug: string): Promise<FacilityDetail> {
  const html = await fetchText(`${BASE_URL}${slug}`);
  const description = extractDescription(html);
  // "Max generating capacity" is only present for generation facilities
  // (never transmission) and is frequently published as a literal "--"
  // placeholder rather than left off the page entirely — confirmed on
  // Carriger Solar and Goldeneye Battery Storage, both of which still
  // state a real MW figure in their description prose. Structured field
  // tried first, description text as fallback.
  const structuredCapacity = extractLabeledField(html, "Max generating capacity");
  const capacityMw =
    structuredCapacity && structuredCapacity !== "--"
      ? extractCapacityMw(structuredCapacity)
      : extractCapacityMw(description);

  return {
    applicant: extractApplicant(html),
    filedRaw: extractTimelineDate(html, "Application received") ?? extractTimelineDate(html, "Application completed"),
    description,
    capacityMw,
  };
}

// "Oct, 2025" / "Feb, 2023" — month/year only, no day published anywhere
// on EFSEC's site. Parsed as the 1st of the month; dateConfidence is
// always "approximate" for this source (see normalizeFacility).
function parseMonthYear(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(`1 ${raw}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Exhaustive over the 6 f-status values observed in a real fetch of all 19
// current facilities (2026-08-23) — see module header STATUS. An unmapped
// 7th value throws (caught per-candidate in ingestWaEfsecFacilities) rather
// than silently defaulting, since a new status value is exactly the kind
// of vocabulary change that should surface as an error, not a guess.
const STATUS_TO_STAGE: Record<string, ProjectStage> = {
  "Application review": "local_review",
  Withdrawn: "cancelled",
  "Awaiting construction": "approved_awaiting_construction",
  "Under construction": "under_construction",
  Operational: "completed",
  Decommissioning: "completed",
};

// See module header FUEL/PROJECT TYPE. Checked in this order so a facility
// carrying more than one energy-category term (e.g. "Battery, Solar") is
// identified by its primary generation technology, not its co-located
// storage.
function inferProjectType(types: string[]): ProjectType {
  if (types.includes("Transmission")) return "transmission";
  if (types.includes("Wind") || types.includes("Solar") || types.includes("Nuclear fission") || types.includes("Thermal")) {
    return "generation";
  }
  if (types.includes("Battery")) return "storage";
  return "generation";
}

function inferFuelType(types: string[]): FuelType {
  if (types.includes("Transmission")) return "transmission";
  if (types.includes("Wind")) return "wind_onshore";
  if (types.includes("Solar")) return "solar";
  if (types.includes("Nuclear fission")) return "nuclear";
  // Best-effort default, not confirmed against a real non-gas "Thermal"
  // example — see module header FUEL/PROJECT TYPE.
  if (types.includes("Thermal")) return "gas";
  if (types.includes("Battery")) return "storage";
  return "other";
}

// WA's own county field can list more than one county for a single
// facility (e.g. Cascade Renewable Transmission: "Clark County, Klickitat
// County, Skamania County") — kept as the full list (with the redundant "
// County" suffix stripped from each entry) rather than truncated to one,
// since a multi-county transmission corridor genuinely spans all of them.
function cleanCounty(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .split(",")
    .map((c) => c.trim().replace(/\s+County$/i, ""))
    .filter(Boolean)
    .join(", ");
}

function normalizeFacility(summary: FacilitySummary, detail: FacilityDetail): NormalizedProject {
  const sourceId = summary.nodeId ?? summary.slug;
  const matchKey = resolveMatchKey("wa-efsec", sourceId);

  const currentStage = STATUS_TO_STAGE[summary.status];
  if (!currentStage) {
    throw new Error(
      `WA EFSEC facility "${summary.name}" has an unrecognized status "${summary.status}" — STATUS_TO_STAGE in src/lib/ingest/waEfsecFacilities.ts needs updating.`,
    );
  }

  const projectType = inferProjectType(summary.types);
  const fuelType = inferFuelType(summary.types);
  const county = cleanCounty(summary.county);
  const filedDate = parseMonthYear(detail.filedRaw);

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Washington Energy Facility Site Evaluation Council (EFSEC)'s public facility pages, not the Washington Utilities and Transportation Commission (WUTC) — WUTC's own case-docket system has no CPCN/siting-certificate authority over generation or transmission facilities in Washington (confirmed by hand: searching its Electric-industry dockets for certificate/siting/CPCN terms returns essentially nothing relevant); that authority sits with EFSEC under RCW 80.50 instead, so this module ingests EFSEC's facility list.",
    'EFSEC\'s own facility-status field was checked against a real decided case (Desert Claim, node 114) rather than trusted by default — its status correctly reads "Withdrawn," reflecting an SCA termination resolution dated 2025-06-25, even though that facility\'s separate free-text description paragraph is stale and still describes it as an active, certified, awaiting-construction project. See the ingestion module header for the full check.',
  ];
  if (filedDate != null) {
    dataQualityNoteParts.push(
      "Application-received date is published as month/year only (no day) — recorded as the 1st of that month.",
    );
  }
  if (detail.capacityMw != null) {
    dataQualityNoteParts.push(
      "Capacity figure is EFSEC's own published max-generating-capacity figure where available, otherwise parsed from the facility description text — not independently verified.",
    );
  }
  if (summary.types.includes("Thermal")) {
    dataQualityNoteParts.push('Fuel type "gas" is a best-effort default for EFSEC\'s generic "Thermal" energy-category tag — not confirmed against this specific facility\'s actual fuel.');
  }
  if (county) {
    // Plural "Counties" when WA's own field lists more than one (e.g. a
    // multi-county transmission corridor like Cascade Renewable
    // Transmission's "Clark, Klickitat, Skamania") — singular "County ...,
    // Washington" glued onto a comma-joined list would otherwise read as
    // if only the last entry were a county.
    const countyWord = county.includes(",") ? "Counties" : "County";
    dataQualityNoteParts.push(`Located in ${county} ${countyWord}, Washington, per EFSEC's facility record — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${summary.name} (WA EFSEC)`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "WA",
    county,
    capacityValue: detail.capacityMw,
    capacityUnit: detail.capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "approximate",
    currentStatus: `WA EFSEC facility status: ${summary.status}${detail.applicant ? ` — applicant ${detail.applicant}` : ""}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a site certification decision from the Washington Energy Facility Site Evaluation Council — ${summary.name}${detail.description ? `, "${detail.description}"` : ""}`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `EFSEC Facility Page: ${summary.name}`,
        url: `${BASE_URL}${summary.slug}`,
      },
    ],
    externalIds: { waEfsec: sourceId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  applicationReviewCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestWaEfsecFacilities(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const listHtml = await fetchText(`${BASE_URL}/facilities`);
  const allFacilities = parseFacilityList(listHtml);

  const candidates = selectWithRotation(
    allFacilities.filter((f) => f.status === "Application review"),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );
  const rotatingTier = new Set(candidates.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const detail = await fetchFacilityDetail(candidate.slug);
      const normalized = normalizeFacility(candidate, detail);
      toUpsert.push(normalized);
      if (rotatingTier.has(candidate)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: candidate.nodeId ?? candidate.slug, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allFacilities.length,
    applicationReviewCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestWaEfsecFacilities()
    .then((summary) => {
      console.log(
        `Washington EFSEC facility ingestion complete: ${summary.candidatesFound} total facilities, ` +
          `${summary.applicationReviewCandidates} in "Application review" status, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
