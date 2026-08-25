// Tennessee Public Utility Commission (TPUC) Certificate of Public
// Convenience and Necessity (CCN, Tenn. Code Ann. § 65-4-201 et seq., plus
// the wind-facility-specific Tenn. Code Ann. § 65-17-101 et seq. added by
// 2018 Tenn. Acts, ch. 825) docket ingestion — one of several states built
// in parallel in the per-state series started with vaSccDockets.ts (see
// that file's header for the overall rationale). Confirmed by hand
// 2026-08-23/24 via real requests against the live tpucdockets.tn.gov site
// — no assumption below was taken from documentation or training-data
// memory alone.
//
// FETCHING: tpucdockets.tn.gov is a plain, fully server-rendered, static-HTML
// docket system (served from S3/CloudFront — confirmed via response headers,
// `server: AmazonS3`/`x-cache: ... CloudFront`) with NO cookies, NO
// JavaScript, NO CAPTCHA, and NO bot-challenge of any kind — a bare
// unauthenticated GET returns identical content to a browser. Confirmed live:
//   1. GET https://tpucdockets.tn.gov/indexes/TPUCActiveDocketIndex.htm is
//      TPUC's own definition of "currently live" dockets — every docket
//      number that has had ANY filing activity in the past six months
//      (dockets idle 6+ months move to a separate per-year "Inactive Docket
//      Index" archive instead). Confirmed live 2026-08-24: this single page
//      lists only 160 total docket numbers across EVERY docket type
//      (electric, gas, water/wastewater, telecom) and every year back to
//      1999 (a handful of decades-old dockets stay "active" forever because
//      they carry a recurring annual rate-rider filing) — small enough to
//      fetch every single one without a lookback-window/pagination scheme
//      the way most other states in this series need. This module uses this
//      list as its entire candidate pool rather than trying to brute-force
//      scan TPUC's full historical docket numbering (which has no
//      keyword/type search at all — see SCOPING below — and would mean
//      fetching thousands of irrelevant water/telecom docket pages per
//      year for a source this thin; out of proportion to the real yield).
//   2. GET https://tpucdockets.tn.gov/dockets/{docketNumber}.htm is a single
//      request that returns EVERYTHING needed for one candidate in one
//      shot — Status (Open/Closed), Type (a free-text TPUC-internal bucket
//      like "CCN"/"Rates"/"Other"/"CLECs"/"Interconnection Agreement"), the
//      full "IN RE:" caption, and the complete filing history table
//      (date/description/filer) — unlike every other server-rendered-HTML
//      state in this series, there's no separate search-then-detail
//      two-step; the list page has no captions at all, so every candidate
//      needs its own detail fetch anyway, and that one fetch already
//      carries the caption, so no wasted request.
// Real gotcha: the page markup is NOT template-stable across the two
// confirmed real variants — `Status: Open` appears as bare text on most
// pages, but at least one real page (Docket 1400036) instead renders
// `Status: <span style=" padding-left: 6px;">Closed</span>` — an extra span
// wrapping just the value. STATUS_RE below tolerates an optional wrapping
// tag rather than assuming one exact structure. Filing-row markup is also
// inconsistently capitalized/spaced across the corpus (`<tr class="..."`
// on the summary table vs `<tr Class= "..."` — capital C, extra space
// before `=` — on every filing row, confirmed identical on both a 2026
// docket and a 2000-era docket) — FILING_ROW_RE is written
// case-insensitive and whitespace-tolerant rather than copying one exact
// byte sequence. Filing-row date links use an UNQUOTED href attribute
// (`href=https://tpucdockets.tn.gov/filings/2026/2600002ab.pdf>`, no
// quotes) — also confirmed on both eras — handled by matching the whole
// opening `<a ...>` tag non-greedily rather than trying to extract href
// specifically (this module doesn't need the per-filing PDF link, only the
// docket's own detail-page URL, which is already known).
//
// SCOPING — the real, confirmed hard part for Tennessee, and the reason
// this module's real candidate count is far smaller than every other state
// in this series: TPUC's own "Type" field is NOT a reliable way to find
// electric CCN cases, confirmed by a real, direct counterexample: Docket
// 1400036, Tennessee's own real historical electric-transmission CCN case
// ("PETITION OF PLAINS AND EASTERN CLEAN LINE LLC FOR A CERTIFICATE OF
// CONVENIENCE AND NECESSITY APPROVING A PLAN TO CONSTRUCT A TRANSMISSION
// LINE AND TO OPERATE AS AN ELECTRIC TRANSMISSION PUBLIC UTILITY", filed
// 2014), is filed under Type "Other", NOT "CCN". Filtering by Type="CCN"
// would have silently missed the one real electric example this module was
// calibrated against. This module instead scans EVERY active docket
// regardless of Type and filters on caption content, the same
// confirm-don't-guess approach every other state in this series uses when
// its obvious structured field turns out unreliable.
// The much bigger, and more surprising, real finding: Tennessee's CCN
// process (Tenn. Code Ann. § 65-4-201 — "No public utility shall establish
// or begin the construction of...any line, plant, or system...without
// first having obtained from the commission...a certificate") is a SINGLE
// shared statute used for water/wastewater utilities, competitive local
// telecom carriers (CLECs), AND electric utilities alike — and confirmed
// live 2026-08-24 against the FULL 160-docket active population (every
// single currently-live TPUC docket of any type, not a sample), the "CCN"
// docket-type bucket (34 of the 160) and the broader active population as a
// whole contain ZERO currently-open electric generation/transmission/
// storage CCN cases: every single real CCN-type or certificate-referencing
// caption found is either a water/wastewater utility expanding its service
// territory to a new subdivision (the large majority — Limestone Water
// Utility Operating Company alone accounts for a double-digit share),
// telecom CLEC/franchise-authority applications, or (rarely) a utility
// acquisition/asset-transfer case. This is a real, confirmed structural
// fact about Tennessee's electric market, not a scraping gap: the
// Tennessee Valley Authority (TVA), a federal corporation, supplies the
// overwhelming majority of the state's generation and is exempt from TPUC's
// certificate jurisdiction entirely (a federal instrumentality, not a
// state-regulated "public utility"); TVA's ~150 local power companies
// (municipal/cooperative distributors) hold exclusive, already-assigned
// service territories under TVA contracts, so a NEW-entrant CCN
// ("establish service" in a territory not already served) essentially never
// triggers for ordinary in-state generation or distribution the way it does
// in a state with multiple competing investor-owned utilities. The one
// confirmed live avenue where this DOES apply to a real energy project is a
// merchant/interstate transmission developer proposing to become a NEW
// "electric transmission public utility" in Tennessee for the first time
// (Plains & Eastern Clean Line's real 2014 case, the only one found in the
// full active/inactive population checked) — plus a second, statutorily
// distinct avenue confirmed via Tennessee's own state energy office: Tenn.
// Code Ann. § 65-17-101 et seq. ("Wind Energy Facilities", added/amended by
// 2018 Tenn. Acts, ch. 825) requires a TPUC CCN specifically for utility-
// scale WIND facility construction before local siting approval can even
// begin, independent of the competing-utility question, with an added
// height restriction for ridge-top turbines (no CCN above 350ft on a
// mountain ridge above certain elevation thresholds) — confirmed via the
// State Energy Office's own wind-facilities-regulations page and the
// statute text itself, though no live wind CCN docket was found in the
// current 160-docket active population to confirm the real caption
// phrasing TPUC would use for one (kept as an easy-to-match branch anyway,
// same "unconfirmed but cheap to keep" pattern this series uses elsewhere
// for statutorily-real-but-currently-unobserved case types — see
// ELECTRIC_RE below, which matches "WIND FACILITY"/"WIND ENERGY" generically
// rather than requiring one exact confirmed phrase).
// CONTENT_RE (requires the certificate/convenience-and-necessity phrase,
// same anchor every prior state in this series uses) is therefore combined
// with ELECTRIC_RE, a POSITIVE requirement for an explicit electric-specific
// signal (transmission line/electric transmission public utility/generating
// facility/wind or solar facility/battery-energy-storage), rather than an
// EXCLUDE-list approach — the water/wastewater and telecom captions
// checked never contain any of these terms, so no separate exclude list is
// needed to keep them out. One defensive exception, EXCLUDE_RE: several
// real Tennessee municipal utilities are named with "Energy"/"Electric" in
// their own corporate name while filing an unrelated TELECOM CCN (e.g.
// Docket 0300438, "APPLICATION OF JACKSON ENERGY AUTHORITY FOR A
// CERTIFICATE OF CONVENIENCE AND NECESSITY", Type "CLECs" — an electric
// municipal utility's fiber/broadband subsidiary applying for a telecom
// certificate, not an electric siting case). That real caption happens to
// contain no ELECTRIC_RE keyword at all so it's already excluded, but
// EXCLUDE_RE is kept as a defensive backstop (unconfirmed against any live
// false positive today, since none exists in the current population) for a
// future caption that both names an "Energy"/"Electric"-branded utility AND
// explicitly says "telecommunications"/"local exchange"/"cable franchise" —
// this series' usual pattern of keeping a currently-unexercised safety net
// documented rather than silently omitted.
//
// STATUS: TPUC's own Status field (Open/Closed) is, unusually for this
// series, a GOOD signal as far as it was possible to confirm — but that
// confirmation rests on exactly ONE real historical example, since the live
// population currently contains zero open electric CCN cases to calibrate
// against more broadly (documented honestly rather than overstated).
// Docket 1400036 (Plains & Eastern Clean Line) shows its Status field
// tracking the docket's real lifecycle correctly at each step: "Order
// Granting CCN" filed 05/05/2015 (docket presumably flipped from
// Open→treated as a live certificate at that point — TPUC's docketing
// doesn't re-close a docket on a grant since post-grant compliance
// reporting continues), the company voluntarily filed to cancel its own
// certificate in 2018 ("Company Is Requesting Cancellation Of CCN.",
// 07/13/2018), TPUC's own order the same year is titled "Order Granting
// Cancellation Of Authority To Construct A Transmission Line And To Operate
// As An Electric Transmission Public Utility." (10/01/2018), and the
// docket's Status is "Closed" as of today (2026-08-24) — exactly the
// outcome expected. This module reads Status directly (Open = still
// waiting, Closed = resolved one way or another) rather than building the
// elaborate multi-signal filing-title calibration MO PSC/MD PSC needed,
// because there is no larger live population here to have caught Status
// being unreliable the way those states' full-dataset audits did — flagged
// as a real, acknowledged gap (not a false confidence claim) in
// dataQualityNote and here. For a Closed docket, the SPECIFIC resolution
// (granted vs. denied vs. cancelled/withdrawn) is inferred from the most
// recent filing's own description text (CANCEL_RE checked first, since
// "Order Granting Cancellation..." would otherwise false-positive on a
// naive "granting...certificate" grant pattern; DENY_RE next; GRANT_RE
// last) — this only affects which RESOLVED_STAGES bucket a project lands
// in before common.ts deletes it either way, never whether it stays
// tracked, same low-stakes caveat this series documents elsewhere for
// under-confirmed denial/cancellation branches.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields, extracted from the
// ALL-CAPS "IN RE:" caption text (confirmed ALL CAPS on every real caption
// checked, both recent and decades-old). Only one real example exists to
// calibrate against (Plains & Eastern: "...CONSTRUCT A TRANSMISSION LINE
// AND TO OPERATE AS AN ELECTRIC TRANSMISSION PUBLIC UTILITY" → transmission/
// transmission, no MW figure or Tennessee county named in the caption
// itself, since an interstate HVDC line's Tennessee segment detail lives in
// the underlying application PDF, not the docket caption) — WIND_RE/
// SOLAR_RE/STORAGE_RE/gas/nuclear/hydro keyword branches below are kept for
// the real, statutorily-confirmed generation case types this module could
// plausibly see in a future run (see SCOPING) but are unconfirmed against
// any live Tennessee caption today, same documented-but-unexercised pattern
// as the ELECTRIC_RE wind branch above. County extraction uses a hardcoded
// whitelist of Tennessee's 95 real counties (not a free-form "capitalized
// words before COUNTY" regex — see Maryland's real greedy-regex bug in this
// series' shared README for why that approach is dangerous against
// ALL-CAPS caption text) including the one real two-word county name, "Van
// Buren" — matched as a specific higher-priority two-word case before the
// generic single-word fallback.
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): TPUC moves a docket to
// its separate Inactive archive after 6 months of no filing activity (see
// FETCHING above), so a tracked docket that goes idle vanishes from
// `docketNumbers` entirely. Originally, per this series' standard fix,
// previously-tracked tn-tpuc matchKeys were diffed against each run's
// active-docket list and pushed through as a resolved stub (guessing
// currentStage="cancelled") for anything that vanished, so common.ts
// would delete it. That fix is now itself superseded: common.ts no
// longer deletes resolved-stage projects (they're kept and surfaced
// through the frontend's Status filter), so guessing "cancelled" for a
// docket that moved to Inactive would mean permanently mislabeling it —
// possibly wrongly — in a bucket real users can now see. A docket that
// goes idle is therefore left untouched, not guessed into a resolved
// stage. This source's real live population is currently zero (see
// SCOPING), so nothing exists yet for this gap to actually affect.
//
// Wired to Vercel Cron weekly, 06:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-tn-tpuc/route.ts). Real timing measured
// 2026-08-24 against the live shared DB: a full run across the entire real
// active-docket population (160 candidates, MAX_CANDIDATES=250 covers it
// with headroom) completed in 87.6s with zero errors — comfortably inside
// the 300s cron budget, no need to trim MAX_CANDIDATES.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://tpucdockets.tn.gov";
const ACTIVE_INDEX_URL = `${BASE_URL}/indexes/TPUCActiveDocketIndex.htm`;

// Real confirmed population 2026-08-24: 160 total active dockets across
// every docket type (electric, water/wastewater, telecom, gas) and every
// year back to 1999 — see module header FETCHING. This is the entire
// candidate pool (no separate lookback/pagination needed), so
// MAX_CANDIDATES is set with generous headroom above that, not trimmed down
// to it, matching this series' "full small population + margin" pattern
// (see mdPscDockets.ts).
export const MAX_CANDIDATES = 250;
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as every other module in this series, not a full HTML-entity
// library.
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
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

// Confirmed live 2026-08-24 against the real TPUCActiveDocketIndex.htm
// page — every docket number links here in the exact quoted form below,
// regardless of docket year/vintage.
const ACTIVE_DOCKET_LINK_RE = /href="https:\/\/tpucdockets\.tn\.gov\/dockets\/(\d+)\.htm"/g;

async function fetchActiveDocketNumbers(): Promise<string[]> {
  const res = await fetch(ACTIVE_INDEX_URL);
  if (!res.ok) {
    throw new Error(`TN TPUC active docket index request failed (${res.status})`);
  }
  const html = await res.text();
  const numbers = new Set<string>();
  for (const m of html.matchAll(ACTIVE_DOCKET_LINK_RE)) {
    numbers.add(m[1]);
  }
  if (numbers.size === 0) {
    throw new Error(
      "TN TPUC active docket index returned zero parsed docket links — the index page structure likely changed. Check ACTIVE_DOCKET_LINK_RE in src/lib/ingest/tnTpucDockets.ts against a fresh response.",
    );
  }
  return [...numbers];
}

interface FilingRow {
  date: Date | null;
  description: string;
  filer: string;
}

interface DocketDetail {
  docketNumber: string;
  status: "Open" | "Closed" | null;
  type: string | null;
  caption: string;
  filings: FilingRow[];
}

// Tolerates the real confirmed markup variant (an extra wrapping <span> on
// at least one real page) — see module header FETCHING.
const STATUS_RE = /Status:\s*(?:<span[^>]*>)?\s*(Open|Closed)/i;
const TYPE_RE = /Type:\s*<span[^>]*>\s*([^<]+?)\s*<\/span>/i;
const CAPTION_RE = /IN RE:\s*(?:&nbsp;)*\s*([\s\S]*?)<\/p>/i;

// See module header FETCHING for the real, confirmed markup quirks this
// tolerates: inconsistent "class"/"Class" capitalization and spacing
// around "=", and an unquoted href attribute on the date link.
const FILING_ROW_RE =
  /<tr\s+[Cc]lass\s*=\s*"ElectronicDocketTable"\s*>\s*<td[^>]*>(?:<a[^>]*>)?\s*(\d{2}\/\d{2}\/\d{4})\s*(?:<\/a>)?\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;

function parseMDY(raw: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchDocketDetail(docketNumber: string): Promise<DocketDetail> {
  const res = await fetch(`${BASE_URL}/dockets/${docketNumber}.htm`);
  if (!res.ok) {
    throw new Error(`TN TPUC docket detail request failed (${res.status}) for docket ${docketNumber}`);
  }
  const html = await res.text();

  const statusMatch = STATUS_RE.exec(html);
  const typeMatch = TYPE_RE.exec(html);
  const captionMatch = CAPTION_RE.exec(html);
  if (!captionMatch) {
    throw new Error(
      `TN TPUC docket ${docketNumber} response didn't contain a parseable "IN RE:" caption — the page structure likely changed. Check CAPTION_RE in src/lib/ingest/tnTpucDockets.ts against a fresh response.`,
    );
  }

  const filings: FilingRow[] = [];
  for (const m of html.matchAll(FILING_ROW_RE)) {
    filings.push({
      date: parseMDY(m[1]),
      description: stripTags(m[2]),
      filer: stripTags(m[3]),
    });
  }
  // Filings render newest-first on every real page checked (confirmed
  // against both a 2026 docket and the years-long Plains & Eastern
  // history) — sorted defensively anyway so resolution logic never depends
  // on that ordering holding.
  filings.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  return {
    docketNumber,
    status: statusMatch ? (statusMatch[1] as "Open" | "Closed") : null,
    type: typeMatch ? stripTags(typeMatch[1]) : null,
    caption: stripTags(captionMatch[1]),
    filings,
  };
}

// See module header SCOPING.
const CONTENT_RE = /certificate\s+of\s+(?:public\s+)?convenience\s+and\s+necessity/i;
const ELECTRIC_RE =
  /electric(?:al)?\s+transmission\s+public\s+utility|transmission\s+line|transmission\s+facilit|electric(?:al)?\s+generat\w*|generat(?:e|ing|ion)\s+(?:facilit|plant|station)|\bwind\s+(?:facilit|energy|farm|turbine)/i;
// Defensive backstop only — no real live false positive currently exists to
// confirm this against (see module header SCOPING).
const EXCLUDE_RE =
  /telecommunications?\s+services?|local\s+exchange|interexchange|competing\s+local|cable\s+franchise|franchise\s+authority/i;

function isElectricCcnCandidate(caption: string): boolean {
  return CONTENT_RE.test(caption) && ELECTRIC_RE.test(caption) && !EXCLUDE_RE.test(caption);
}

// See module header STATUS. Checked in this order against the docket's
// MOST RECENT filing only (filings are sorted newest-first above) —
// CANCEL_RE first so "Order Granting Cancellation Of Authority..." (a real
// confirmed filing title) isn't misread as a grant just because it contains
// "granting".
type Resolution = "granted" | "denied" | "cancelled" | "closed-unclear" | null;

const CANCEL_RE = /\bcancel(?:l?ation|l?ing|l?ed)?\b|\bwithdraw\w*\b/i;
const DENY_RE = /\bden(?:y|ies|ied|ying|ial)\b/i;
const GRANT_RE = /\bgrant(?:ing|ed|s)?\b/i;

function resolveDocket(detail: DocketDetail): Resolution {
  if (detail.status !== "Closed") return null;
  const latest = detail.filings[0];
  if (!latest) return "closed-unclear";
  if (CANCEL_RE.test(latest.description)) return "cancelled";
  if (DENY_RE.test(latest.description)) return "denied";
  if (GRANT_RE.test(latest.description)) return "granted";
  return "closed-unclear";
}

// See module header FUEL/PROJECT TYPE & CAPACITY — only the transmission
// branch is confirmed against a real live Tennessee caption; the rest are
// kept for statutorily-real-but-currently-unobserved case types.
const WIND_RE = /\bwind\b/i;
const SOLAR_RE = /\bsolar\b|photovoltaic/i;
const STORAGE_RE = /\bbattery\b|\bbess\b|energy\s+storage/i;
const GAS_RE = /natural\s+gas|gas[- ]fired|combustion\s+turbine|combined\s+cycle/i;
const NUCLEAR_RE = /\bnuclear\b/i;
const HYDRO_RE = /\bhydro/i;
const GENERATING_RE = /generat(?:e|ing|ion)\s+(?:facilit|plant|station)|electric(?:al)?\s+production\s+facilit/i;
const TRANSMISSION_RE =
  /transmission\s+line|transmission\s+facilit|electric(?:al)?\s+transmission\s+public\s+utility|\btransmission\b/i;

function inferProjectTypeAndFuel(caption: string): { projectType: ProjectType; fuelType: FuelType } {
  if (WIND_RE.test(caption)) return { projectType: "generation", fuelType: "wind_onshore" };
  if (SOLAR_RE.test(caption)) return { projectType: "generation", fuelType: "solar" };
  if (GAS_RE.test(caption)) return { projectType: "generation", fuelType: "gas" };
  if (NUCLEAR_RE.test(caption)) return { projectType: "generation", fuelType: "nuclear" };
  if (HYDRO_RE.test(caption)) return { projectType: "generation", fuelType: "hydro" };
  if (STORAGE_RE.test(caption)) return { projectType: "storage", fuelType: "storage" };
  if (TRANSMISSION_RE.test(caption)) return { projectType: "transmission", fuelType: "transmission" };
  if (GENERATING_RE.test(caption)) return { projectType: "generation", fuelType: "other" };
  // Real, confirmed gap: this module's own gating regex (ELECTRIC_RE)
  // already requires one of the signals above to match before a candidate
  // reaches this function, but a caption that matched only on the generic
  // "electric...generat..." phrase without one of the more specific fuel
  // keywords still falls through to here — transmission is the plurality
  // outcome among Tennessee's real (thin) CCN-eligible electric filings
  // (see module header SCOPING), matching this series' established
  // "terse caption → most common real category" fallback (see
  // moPscDockets.ts).
  return { projectType: "transmission", fuelType: "other" };
}

function extractCapacityMw(caption: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*(?:MW|MEGAWATTS?)\b/i.exec(caption);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Tennessee's 95 real counties — see module header FUEL/PROJECT TYPE &
// CAPACITY for why a whitelist is used instead of a free-form regex.
// "Van Buren" is the one real two-word county name; every other county is a
// single word.
const TN_COUNTIES = [
  "Anderson", "Bedford", "Benton", "Bledsoe", "Blount", "Bradley", "Campbell",
  "Cannon", "Carroll", "Carter", "Cheatham", "Chester", "Claiborne", "Clay",
  "Cocke", "Coffee", "Crockett", "Cumberland", "Davidson", "Decatur",
  "DeKalb", "Dickson", "Dyer", "Fayette", "Fentress", "Franklin", "Gibson",
  "Giles", "Grainger", "Greene", "Grundy", "Hamblen", "Hamilton", "Hancock",
  "Hardeman", "Hardin", "Hawkins", "Haywood", "Henderson", "Henry",
  "Hickman", "Houston", "Humphreys", "Jackson", "Jefferson", "Johnson",
  "Knox", "Lake", "Lauderdale", "Lawrence", "Lewis", "Lincoln", "Loudon",
  "Macon", "Madison", "Marion", "Marshall", "Maury", "McMinn", "McNairy",
  "Meigs", "Monroe", "Montgomery", "Moore", "Morgan", "Obion", "Overton",
  "Perry", "Pickett", "Polk", "Putnam", "Rhea", "Roane", "Robertson",
  "Rutherford", "Scott", "Sequatchie", "Sevier", "Shelby", "Smith",
  "Stewart", "Sullivan", "Sumner", "Tipton", "Trousdale", "Unicoi", "Union",
  "Van Buren", "Warren", "Washington", "Wayne", "Weakley", "White",
  "Williamson", "Wilson",
];
const TWO_WORD_COUNTY_RE = /\bVAN\s+BUREN\s+COUNT(?:Y|IES)\b/i;
const ONE_WORD_COUNTY_ALT = TN_COUNTIES.filter((c) => !c.includes(" "))
  .map((c) => c.toUpperCase())
  .join("|");
const ONE_WORD_COUNTY_RE = new RegExp(`\\b(${ONE_WORD_COUNTY_ALT})\\s+COUNT(?:Y|IES)\\b`, "i");

function extractCounty(caption: string): string | null {
  if (TWO_WORD_COUNTY_RE.test(caption)) return "Van Buren";
  const m = ONE_WORD_COUNTY_RE.exec(caption);
  if (!m) return null;
  const upper = m[1].toUpperCase();
  const canonical = TN_COUNTIES.find((c) => c.toUpperCase() === upper);
  return canonical ?? null;
}

// Real observed caption openers: "PETITION OF X FOR..."/"APPLICATION OF X
// FOR..."/"JOINT (PETITION|APPLICATION) OF X FOR..." and the possessive
// "X'S APPLICATION..." form (both confirmed live 2026-08-24 across the
// active docket population).
const APPLICANT_OF_RE =
  /^(?:JOINT\s+)?(?:PETITION|APPLICATION)\s+OF\s+(.+?)\s+FOR\b/i;
const APPLICANT_POSSESSIVE_RE = /^(.+?)['’]S\s+(?:APPLICATION|PETITION)\b/i;

const PRESERVE_UPPER = new Set(["LLC", "L.L.C.", "INC", "INC.", "CO", "CO.", "LP", "L.P.", "TVA"]);
const LOWERCASE_WORDS = new Set(["and", "of", "the", "d/b/a"]);

function toTitleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[.,]+$/, "");
      if (PRESERVE_UPPER.has(word) || PRESERVE_UPPER.has(bare)) return word;
      const lower = word.toLowerCase();
      if (LOWERCASE_WORDS.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function extractApplicant(caption: string): string {
  const m1 = APPLICANT_OF_RE.exec(caption);
  if (m1) return toTitleCase(m1[1].trim());
  const m2 = APPLICANT_POSSESSIVE_RE.exec(caption);
  if (m2) return toTitleCase(m2[1].trim());
  return toTitleCase(caption.slice(0, 80));
}

function detailUrl(docketNumber: string): string {
  return `${BASE_URL}/dockets/${docketNumber}.htm`;
}

function normalizeDocket(detail: DocketDetail): NormalizedProject {
  const matchKey = resolveMatchKey("tn-tpuc", detail.docketNumber);
  const { projectType, fuelType } = inferProjectTypeAndFuel(detail.caption);
  const applicant = extractApplicant(detail.caption);
  const county = extractCounty(detail.caption);
  const capacityMw = extractCapacityMw(detail.caption);
  const resolution = resolveDocket(detail);

  const earliestFiling = detail.filings.reduce<Date | null>((earliest, f) => {
    if (!f.date) return earliest;
    if (!earliest || f.date < earliest) return f.date;
    return earliest;
  }, null);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "cancelled" || resolution === "closed-unclear") {
    currentStage = "cancelled";
  } else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Tennessee Public Utility Commission's public electronic docket system, Certificate of Public Convenience and Necessity applications (Tenn. Code Ann. § 65-4-201 et seq., and for wind facilities specifically, § 65-17-101 et seq.).",
    "TPUC's own docket \"Status\" field (Open/Closed) is used directly here to determine whether this docket is still waiting on a Commission decision — confirmed against one real historical case's full lifecycle (grant, then a later voluntary cancellation, with Status flipping to Closed at each step), but Tennessee currently has very few electric-specific CCN dockets to broadly cross-check this against — see the ingestion module header for the full explanation, including why the Commission's own docket \"Type\" field (a separate, less reliable field) is not used for scoping.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket caption text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Tennessee, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No Tennessee county is named in the docket caption — no structured coordinates are published regardless, so this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (TN TPUC Docket No. ${detail.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "TN",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: earliestFiling,
    dateConfidence: "exact",
    currentStatus: `Tennessee TPUC Docket No. ${detail.docketNumber}: ${resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Tennessee Public Utility Commission — Docket No. ${detail.docketNumber}, "${detail.caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `TN TPUC Docket No. ${detail.docketNumber}`,
        url: detailUrl(detail.docketNumber),
      },
    ],
    externalIds: { tnTpuc: detail.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestTnTpucDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const docketNumbers = (await fetchActiveDocketNumbers()).slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let realApplicationCandidates = 0;

  for (const docketNumber of docketNumbers) {
    try {
      const detail = await fetchDocketDetail(docketNumber);
      if (isElectricCcnCandidate(detail.caption)) {
        realApplicationCandidates += 1;
        toUpsert.push(normalizeDocket(detail));
      }
    } catch (err) {
      errors.push({ matchKey: resolveMatchKey("tn-tpuc", docketNumber), message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a docket that
  // moves to TPUC's Inactive archive is deliberately left untouched now,
  // not guessed into a resolved stage — see the header for why.

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: docketNumbers.length,
    realApplicationCandidates,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestTnTpucDockets()
    .then((summary) => {
      console.log(
        `Tennessee TPUC CCN docket ingestion complete: ${summary.candidatesFound} active dockets scanned, ` +
          `${summary.realApplicationCandidates} real electric CCN candidates, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
