// Kentucky Public Service Commission (PSC) Certificate of Construction / CPCN
// docket ingestion — one of several states built in parallel in the
// per-state series started with vaSccDockets.ts (see that file's header for
// the overall rationale). Confirmed by hand 2026-08-23 via real POST/GET
// requests against the live psc.ky.gov site — no assumption below was taken
// from documentation or training-data memory alone.
//
// SCOPING: Kentucky requires a Certificate of Public Convenience and
// Necessity (CPCN, KRS 278.020) before a regulated utility constructs
// generation or transmission facilities, and a separate but functionally
// identical "Certificate of Construction" (KRS 278.700-278.714, run by the
// PSC's Electric Generation and Transmission Siting Board) before a merchant
// (non-regulated) generator or its associated transmission line is built.
// Both processes live in the SAME case-search system psc.ky.gov exposes
// (see FETCHING) and are simply tagged with different internal "Case Code"
// values. Three case codes were confirmed live to cover essentially all
// electric generation/storage/transmission CPCN activity:
//   - "023 - Transmission Line Certificate" (guid
//     468ae46b-6f96-41e8-8ff9-5f54738d54f3): regulated-utility transmission
//     CPCNs, e.g. Case 2026-00184 (Kentucky Power, "CONSTRUCT 69KV
//     TRANSMISSION LINES ... (BREAKS-DORTON PROJECT)"), plus merchant
//     nonregulated transmission-only certificates that happen to be coded
//     here instead of 026, e.g. Case 2023-00160 (Northern Bobwhite Solar).
//   - "026 - Merchant Plant" (guid b4a8c33d-4cd0-43e3-ae6b-4e492276e787):
//     merchant/exempt-wholesale-generator Certificate of Construction
//     applications under KRS 278.700/278.714 — confirmed by hand this is
//     almost entirely large-scale merchant solar (every one of 73 distinct
//     real captions checked mentioned "SOLAR"; no live wind/storage/gas
//     merchant-plant example was found to calibrate FUEL_KEYWORDS against,
//     same "kept as an easy add, unconfirmed live" caveat other states in
//     this series document) plus standalone merchant transmission lines.
//   - "030 - Construct" (guid bebb66be-1e95-11d4-aa71-0050da6ea60a):
//     regulated-utility CPCNs for "construct" projects generally. This code
//     is a broad catch-all confirmed BY TESTING to also contain plenty of
//     non-generation/non-transmission construction — new headquarters
//     buildings (Case 2026-00098, Taylor County RECC), Advanced Metering
//     Infrastructure rollouts, fiber/broadband network construction, and
//     environmental-compliance/cooling-tower retrofits at an existing plant
//     (Case 2026-00001, Kentucky Power's Mitchell Plant cooling tower) —
//     none of which is a new generation/storage/transmission project
//     "waiting on approval" in this site's sense. EXCLUDE_RE below removes
//     these, confirmed against every real Case Code 030 "Electric"-service
//     caption returned live (29 distinct captions checked by hand).
// A Category=8 ("Merchant Plant Applications") cross-check confirmed full
// coverage: its open-case set (6) was a strict subset of the union of Case
// Codes 023+026's open sets, so no merchant docket is missed by searching
// those two codes directly. Case Codes 031/032/034-037/039 (KRS 278.023
// variants of "Construct") were also tested live and returned zero
// currently-open Electric-service candidates as of 2026-08-23 — not
// included, but easy to add back if that changes.
// ServiceType=Electric is applied only to Case Code 030 (023/026 returned
// identical results with/without it — inherently electric-only case codes);
// for 030 it matters: without it, 4 extra open cases surfaced, all Gas
// pipeline CPCNs (e.g. Case 2026-00202, Atmos Energy "Pipeline
// Modernization Rider" — out of scope per this series' convention of
// excluding gas-utility filings).
//
// FETCHING: psc.ky.gov/Case/SearchCases is a plain server-rendered ASP.NET
// MVC form (NOT WebForms — no __VIEWSTATE/__EVENTVALIDATION, no
// anti-forgery token in the form at all), confirmed by hand: a bare
// `POST /Case/SearchCases` with fields CaseNumber/Company/ServiceType/
// Category/CaseCode/CategoryName/Filtered=Yes/IsClosed, sent with a fresh
// curl process (no cookie jar, no prior GET), returns real filtered
// results. IsClosed is the page's own "Include Closed" checkbox: sending
// only `IsClosed=false` (the unchecked-checkbox state — a real browser
// submits just the form's own hidden fallback input in that case) returns
// ONLY still-open cases; sending `IsClosed=true` followed by `IsClosed=false`
// (mimicking a checked checkbox, whose own value posts before the hidden
// fallback) returns the full open+closed history. This module only ever
// needs the open-only query. Each result in the response HTML is a fixed
// block containing a `/Case/ViewCaseFilings/{caseNumber}` link plus Service
// Type/Category/Utilities/caption — but rather than parse that block
// (whose field layout was observed to vary slightly, e.g. Filing Date is
// present for some Case Codes' rows and absent for others), this module
// just pulls the case numbers out of the search response and fetches each
// one's own detail page, `GET /Case/ViewCaseFilings/{caseNumber}`, which has
// a small, stable set of labeled spans (id/ID casing is inconsistent in the
// real HTML, tolerated below): lblFilingDt, lblCategory, lblUtilities (the
// applicant/utility name — used directly instead of regex-parsing it back
// out of the caption), and lblNature (the case's own official caption text,
// authoritative over whatever capacity figure an earlier Notice of Intent
// on the same case may have stated — confirmed by hand on Case 2023-00369:
// its Notice of Intent named "Approximately 20 Megawatt," but lblNature on
// the same case, filed later as the real Application, says "APPROXIMATELY
// 240 MEGAWATT" — the actual, larger, final-application figure. Every
// capacity/fuel/county extraction below reads lblNature only, never an
// intermediate filing's own description text). The detail page also lists
// every filing with a received-date and a free-text description
// (`pFileDesc`) — used for the STATUS cross-check below. No auth, no
// session cookie, no CAPTCHA, no rate limit encountered; confirmed working
// from a bare curl process with no special User-Agent (unlike
// nvPucnDockets.ts's legacy ASP.NET site, this one does not browser-sniff).
//
// STATUS — same lesson as every prior state in this series, but with an
// unusually reassuring result this time: KY PSC's own case-search "Include
// Closed" checkbox (IsClosed) was independently verified against real
// dockets rather than trusted at face value, and held up. Two real
// currently-"open" (IsClosed=false) dockets that are years old were checked
// by hand for a hidden resolution: Case 2022-00011 (Stonefield Solar, 120
// MW, application filed 8/19/2022) has had no PSC order of any kind since —
// its most recent filing (as of 2026-08-23) is a PSC letter dated 8/17/2026
// requesting a status report, i.e. genuinely still pending, not just
// mis-flagged; Case 2023-00369 (GGSO/Gage Solar) similarly last moved in
// 2026 with a status-report exchange, no order. Conversely, real "closed"
// (only surfaced with IsClosed=true) dockets were checked and do carry a
// genuine final disposition: Case 2022-00066 (Kentucky Utilities, Hardin
// County transmission CPCN) has a filing literally titled "Final Order
// Entered: 1. KU is granted a CPCN..."; Case 2024-00104 (Lynn Bark Energy,
// 200 MW merchant solar) has "Final Order Entered: 1. Lynn Bark Energy's
// application for a Construction Certificate ... is conditionally granted
// subject to...". So — unlike South Carolina/Arizona/etc. in this series —
// IsClosed=false is used here as the PRIMARY signal for "still waiting."
// As a defense-in-depth secondary check (given every other state in this
// series found its obvious status signal to be wrong in some way, and this
// module doesn't want to be the one case that trusted a flag without any
// cross-check), fetchCaseDetail() also scans each still-"open" candidate's
// own filing descriptions for a "Final Order Entered:"/"Order Entered:"
// line containing a grant/deny/dismiss verdict; if IsClosed is ever stale,
// this catches it. GRANT_RE is written to require "is [conditionally]
// granted" near "Final Order Entered:" — a bare "granted" alone is too
// loose, since a Final Order routinely also grants unrelated procedural
// motions in the same filing (e.g. "Lynn Bark Energy's motion for deviation
// from the setback requirements ... is granted" appears in the SAME filing
// as the real disposition). No real DENIED or DISMISSED Certificate of
// Construction was found live to calibrate DENY_RE/DISMISS_RE against
// (same gap azAccLineSiting.ts and nvPucnDockets.ts each documented for
// their own states) — kept as best-effort patterns. One real non-grant
// "closed" case was also found and is deliberately NOT misread by this
// module: Case 2023-00131 (Martin County Solar's transmission line) closed
// with "Order Entered: 1. Martin County Solar I received a Certificate of
// Construction for the transmission line to interconnect with the Inez
// substation in Case No. 2021-00029. 2. This case is closed..." — i.e. it
// was closed as duplicative of a grant entered in a DIFFERENT case number,
// not a grant of its own. IsClosed=false already excludes this case from
// the candidate list entirely, so this module never has to classify it —
// but CLOSED_FALLBACK_RE exists to catch an analogous "this case is closed"
// phrase with no clear grant/deny/dismiss verdict, should IsClosed ever lag
// on a similar case; it's treated conservatively as resolved-unclear
// (mapped to "cancelled" as this site's least-wrong bucket for "no longer
// tracked, verdict unclear from the text alone") rather than left as if
// still pending.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields, extracted from
// lblNature (see FETCHING). Every real Case Code 026 caption checked
// describes a "MERCHANT [ELECTRIC] SOLAR [ELECTRIC] GENERATING FACILITY"
// (word order varies) — GENERATING_RE matches on "GENERATING FACILITY" /
// "GENERATING STATION" / "GENERATION RESOURCE" (the last needed for Case
// 2026-00103, Kentucky Power's application for a new in-state generation
// resource whose fuel type is not yet disclosed at the application stage —
// classified fuelType "other", noted in dataQualityNote). A real
// transmission-only caption never mentions a generating-facility phrase, so
// checking GENERATING_RE first and falling through to TRANSMISSION_RE
// mirrors nyDpsDockets.ts's same-order logic for hybrid generation+
// transmission captions (e.g. Case 2026-00180, "MERCHANT SOLAR ELECTRIC
// GENERATING FACILITY AND NONREGULATED ELECTRIC TRANSMISSION LINE" —
// correctly classified generation/solar, not transmission). One real
// gotcha confirmed by testing: several Kentucky Power CPCNs name a
// transmission substation as a "STATION" with no "SUBSTATION"/"TRANSMISSION
// LINE" wording at all (Case 2026-00208, "REBUILD THE ALLEN STATION IN
// FLOYD COUNTY" — Allen Station is a substation, confirmed by its sibling
// captions in the same Case Code using near-identical phrasing for named
// substations, e.g. "EXPAND AND UPGRADE PORTIONS OF THE BAKER SUBSTATION").
// STATION_REBUILD_RE catches this pattern (a rebuild/replace/upgrade/expand
// verb near a bare "STATION"), but deliberately does NOT match "GENERATING
// STATION" (checked first, by GENERATING_RE, so a true generating station
// is never miscategorized as transmission).
//
// Wired to Vercel Cron weekly, 02:30 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-ky-psc/route.ts) — a real run's timing was
// measured (12 candidates, 10 real, 14.4s) before scheduling this. Also
// politeness-delayed between per-candidate detail requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://psc.ky.gov";
const SEARCH_URL = `${BASE_URL}/Case/SearchCases`;

// See module header SCOPING for how these three were chosen (and why
// 031/032/034-037/039 were tested live and dropped — zero open Electric
// candidates as of 2026-08-23).
interface CaseCodeSource {
  guid: string;
  label: string;
  requireElectricService: boolean;
}
const CASE_CODE_SOURCES: CaseCodeSource[] = [
  { guid: "468ae46b-6f96-41e8-8ff9-5f54738d54f3", label: "023 - Transmission Line Certificate", requireElectricService: false },
  { guid: "b4a8c33d-4cd0-43e3-ae6b-4e492276e787", label: "026 - Merchant Plant", requireElectricService: false },
  { guid: "bebb66be-1e95-11d4-aa71-0050da6ea60a", label: "030 - Construct", requireElectricService: true },
];

// As of 2026-08-23 the real currently-open candidate count across all three
// case codes is 10 (3 from 023, 5 from 026, 2 from 030 after EXCLUDE_RE —
// see module header). Set well above that for headroom as Kentucky's
// merchant-solar pipeline grows, while a full real run (3 search POSTs +
// ~10 detail fetches, each politeness-delayed) took well under 15s — no
// need to trim for the 300s cron budget the way nyDpsDockets.ts had to.
export const MAX_CANDIDATES = 75;
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

// Small, hand-confirmed set actually observed in real responses — same
// approach as every other regex-scraped state in this series, not a full
// HTML-entity library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

const CASE_NUMBER_RE = /\/Case\/ViewCaseFilings\/(\d{4}-\d{5})/g;

async function searchOpenCases(source: CaseCodeSource): Promise<string[]> {
  const body = new URLSearchParams({
    CaseNumber: "",
    Company: "",
    ServiceType: source.requireElectricService ? "Electric" : "",
    Category: "",
    CaseCode: source.guid,
    CategoryName: "",
    Filtered: "Yes",
    IsClosed: "false",
  });
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`KY PSC SearchCases request failed (${res.status}) for case code "${source.label}"`);
  }
  const html = await res.text();
  if (!/<title>\s*Cases/i.test(html)) {
    throw new Error(
      `KY PSC SearchCases response for case code "${source.label}" didn't look like a results page (missing "Cases" title) — the page structure likely changed. Check searchOpenCases in src/lib/ingest/kyPscDockets.ts against a fresh response.`,
    );
  }
  const numbers = new Set<string>();
  for (const m of html.matchAll(CASE_NUMBER_RE)) numbers.add(m[1]);
  return [...numbers];
}

interface CaseDetail {
  caseNumber: string;
  filingDate: Date | null;
  dateConfidence: "exact" | "approximate";
  category: string;
  applicant: string;
  nature: string;
  resolution: "granted" | "denied" | "dismissed" | "closed-unclear" | null;
}

// "M/D/YYYY" (exact) or a bare "YYYY*" (PSC's own marker for "we only know
// the year," confirmed live on Case 2023-00160's Filing Date field).
function parseFilingDate(raw: string): { date: Date | null; confidence: "exact" | "approximate" } {
  const trimmed = raw.trim();
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
    return Number.isNaN(d.getTime()) ? { date: null, confidence: "exact" } : { date: d, confidence: "exact" };
  }
  const yearOnly = /^(\d{4})\*?$/.exec(trimmed);
  if (yearOnly) {
    return { date: new Date(Number(yearOnly[1]), 0, 1), confidence: "approximate" };
  }
  return { date: null, confidence: "exact" };
}

// See module header STATUS: requires "Final Order Entered:" near an actual
// grant/deny/dismiss verdict on the APPLICATION itself, not a same-filing
// procedural motion also granted/denied in passing.
const GRANT_RE = /Final Order Entered:[\s\S]{0,250}?\bis\s+(?:conditionally\s+)?granted\b/i;
const DENY_RE = /Final Order Entered:[\s\S]{0,250}?\b(?:is\s+denied|application[\s\S]{0,60}\bdenied\b)/i;
const DISMISS_RE = /Final Order Entered:[\s\S]{0,250}?\b(?:is\s+dismissed|case\s+is\s+dismissed)\b/i;
// Best-effort fallback: some form of "Order Entered" says the case is
// closed but this module can't tell why (e.g. closed as duplicative of a
// grant entered under a different case number — Case 2023-00131, see
// module header). IsClosed=false means this should essentially never
// trigger in practice; kept as a conservative net.
const CLOSED_FALLBACK_RE = /\bthis case is closed\b/i;

const FILING_ROW_RE =
  /<span>([\d/: APM]+)<\/span>\s*<\/span>\s*<p style="text-align:left" id='pFileDesc'>([\s\S]*?)<\/p>/g;

function detectResolution(html: string): CaseDetail["resolution"] {
  const descriptions: string[] = [];
  for (const m of html.matchAll(FILING_ROW_RE)) descriptions.push(stripTags(m[2]));
  // Rows are listed most-recent-first on the real page (confirmed by hand
  // against Case 2022-00066, whose "Final Order Entered" row appears before
  // its earlier procedural orders) — the first match is the most recent.
  for (const desc of descriptions) {
    if (GRANT_RE.test(desc)) return "granted";
    if (DENY_RE.test(desc)) return "denied";
    if (DISMISS_RE.test(desc)) return "dismissed";
    if (CLOSED_FALLBACK_RE.test(desc)) return "closed-unclear";
  }
  return null;
}

function extractField(html: string, id: string): string | null {
  const re = new RegExp(`id=['"]${id}['"][^>]*>([^<]*)<`, "i");
  const m = re.exec(html);
  return m ? decodeHtmlEntities(m[1]) : null;
}

async function fetchCaseDetail(caseNumber: string): Promise<CaseDetail> {
  const res = await fetch(`${BASE_URL}/Case/ViewCaseFilings/${caseNumber}`);
  if (!res.ok) throw new Error(`KY PSC ViewCaseFilings request failed (${res.status}) for case ${caseNumber}`);
  const html = await res.text();

  const natureMatch = /id=['"]lblNature['"][^>]*>([\s\S]*?)<\/span>/i.exec(html);
  if (!natureMatch) {
    throw new Error(
      `KY PSC ViewCaseFilings response for case ${caseNumber} didn't contain lblNature — the page structure likely changed. Check fetchCaseDetail in src/lib/ingest/kyPscDockets.ts against a fresh response.`,
    );
  }
  const nature = stripTags(natureMatch[1]);

  const filingDateRaw = extractField(html, "lblFilingDt") ?? "";
  const { date: filingDate, confidence: dateConfidence } = parseFilingDate(filingDateRaw);
  const category = extractField(html, "lblCategory") ?? "";
  const applicant = (extractField(html, "lblUtilities") ?? "").trim();
  const resolution = detectResolution(html);

  return { caseNumber, filingDate, dateConfidence, category, applicant, nature, resolution };
}

// See module header FUEL/PROJECT TYPE & CAPACITY.
const GENERATING_RE = /\bGENERATING FACILITY\b|\bGENERATING STATION\b|\bGENERATION RESOURCE\b/i;
const STORAGE_RE = /\bBATTERY\b|\bENERGY STORAGE\b/i;
const TRANSMISSION_RE = /\bTRANSMISSION LINES?\b|\bTRANSMISSION FACILIT|\bTRANSMISSION OPERATIONS CENTER\b|\bSUBSTATION\b|\bSWITCHYARD\b|\bSWITCHING STATION\b/i;
const STATION_REBUILD_RE = /\b(?:REBUILD|REPLACE|UPGRADE|EXPAND)\b[\s\S]{0,40}\bSTATION\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bSOLAR\b/, "solar"],
  [/\bWIND\b/, "wind_onshore"],
  [/\bNATURAL GAS\b|\bGAS-FIRED\b|\bCOMBUSTION TURBINE/, "gas"],
  [/\bNUCLEAR\b/, "nuclear"],
  [/\bHYDRO/, "hydro"],
  [/\bGEOTHERMAL\b/, "geothermal"],
];

function inferProjectTypeAndFuel(nature: string): { projectType: ProjectType; fuelType: FuelType } {
  if (GENERATING_RE.test(nature)) {
    for (const [re, fuel] of FUEL_KEYWORDS) {
      if (re.test(nature)) return { projectType: "generation", fuelType: fuel };
    }
    return { projectType: "generation", fuelType: "other" };
  }
  if (STORAGE_RE.test(nature)) return { projectType: "storage", fuelType: "storage" };
  if (TRANSMISSION_RE.test(nature) || STATION_REBUILD_RE.test(nature)) {
    return { projectType: "transmission", fuelType: "transmission" };
  }
  return { projectType: "generation", fuelType: "other" };
}

function extractCapacityMw(nature: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)[\s-]*(?:MW|MEGAWATT)\b/i.exec(nature);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Every real caption names its county as "IN <NAME(S)> COUNTY/COUNTIES,
// KENTUCKY" in ALL CAPS — confirmed against every real candidate found live
// (single county and multi-county forms, e.g. "IN KNOTT AND PERRY COUNTIES").
const COUNTY_RE = /\bIN\s+([A-Z][A-Z .'&-]*?)\s+COUNT(?:Y|IES)\b/;

// Handles the "Mc"-prefixed Kentucky county name observed live (McCracken)
// as well as the ordinary case — a plain per-word capitalize would produce
// "Mccracken" instead.
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (w === "and") return w;
      const mc = /^(mc)([a-z])(.*)$/.exec(w);
      if (mc) return `Mc${mc[2].toUpperCase()}${mc[3]}`;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function extractCounty(nature: string): string | null {
  const m = COUNTY_RE.exec(nature);
  return m ? toTitleCase(m[1].trim()) : null;
}

// See module header SCOPING for why these were excluded — confirmed by hand
// against every real Case Code 030 caption returned live, none of which is
// a new generation/storage/transmission construction project.
const EXCLUDE_RE =
  /\bHEADQUARTERS\b|\bCOOLING TOWER\b|\bADVANCED METERING INFRASTRUCTURE\b|\bFIBER NETWORK\b|\bBROADBAND\b|\bDISPOSE OF PROPERTY\b|\bSELL(?:ING)? ITS EXISTING\b|\bDEMAND-SIDE MANAGEMENT\b|\bENVIRONMENTAL (?:COMPLIANCE PLAN|SURCHARGE)\b/i;

function normalizeCase(detail: CaseDetail): NormalizedProject {
  const matchKey = resolveMatchKey("ky-psc", detail.caseNumber);
  const { projectType, fuelType } = inferProjectTypeAndFuel(detail.nature);
  const capacityMw = extractCapacityMw(detail.nature);
  const county = extractCounty(detail.nature);
  const applicant = detail.applicant || detail.nature.slice(0, 80);

  let currentStage: ProjectStage;
  if (detail.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (detail.resolution === "denied" || detail.resolution === "dismissed" || detail.resolution === "closed-unclear") {
    currentStage = "cancelled";
  } else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Kentucky Public Service Commission's public case search and case detail pages (Certificate of Public Convenience and Necessity / Certificate of Construction dockets).",
    "\"Still waiting\" here is primarily determined by the PSC's own case search \"Include Closed\" filter (a case not returned when closed cases are excluded), cross-checked against the case's own filed documents for a Final Order granting/denying/dismissing the application — see the ingestion module header for how this was calibrated against real dockets, including one confirmed still-pending docket with no PSC action of any kind since 2022.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the case caption text, not a structured field — not independently verified, and may be a preliminary/pre-application figure if the case's application ultimately proposed a different size.");
  }
  if (fuelType === "other" && projectType === "generation") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the case caption text (in at least one real case, the application itself does not yet disclose the generation technology).");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Kentucky, per the case caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }
  if (detail.dateConfidence === "approximate") {
    dataQualityNoteParts.push("Filing date is approximate (Kentucky PSC's own case record only discloses the filing year for this case, not the exact date).");
  }

  return {
    matchKey,
    name: `${applicant} (KY PSC Case ${detail.caseNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "KY",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: detail.filingDate,
    dateConfidence: detail.dateConfidence,
    currentStatus: `Kentucky PSC Case ${detail.caseNumber}: ${detail.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity / Certificate of Construction from the Kentucky Public Service Commission — Case No. ${detail.caseNumber}, "${detail.nature}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `KY PSC Case No. ${detail.caseNumber}`,
        url: `${BASE_URL}/Case/ViewCaseFilings/${detail.caseNumber}`,
      },
    ],
    externalIds: { kyPsc: detail.caseNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestKyPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const perCode = await Promise.all(CASE_CODE_SOURCES.map((source) => searchOpenCases(source)));
  const allCaseNumbers = [...new Set(perCode.flat())].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let realApplicationCandidates = 0;

  for (const caseNumber of selectWithRotation(allCaseNumbers, maxCandidates, ROTATING_RECENT_SLOTS)) {
    try {
      const detail = await fetchCaseDetail(caseNumber);
      if (EXCLUDE_RE.test(detail.nature)) {
        // Not a generation/storage/transmission construction project — see
        // module header SCOPING (Case Code 030's broad "Construct" bucket).
        await sleep(REQUEST_DELAY_MS);
        continue;
      }
      realApplicationCandidates += 1;
      toUpsert.push(normalizeCase(detail));
    } catch (err) {
      errors.push({ matchKey: caseNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = allCaseNumbers.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allCaseNumbers.length,
    realApplicationCandidates,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestKyPscDockets()
    .then((summary) => {
      console.log(
        `Kentucky PSC docket ingestion complete: ${summary.candidatesFound} open candidates found, ` +
          `${summary.realApplicationCandidates} real generation/storage/transmission applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
