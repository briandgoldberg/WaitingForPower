// Illinois Commerce Commission (ICC) docket ingestion — one of several
// states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23. (The one true cross-source overlap this
// module found, Grain Belt Express, is handled via manualOverrides.csv —
// see the CROSS-SOURCE DUPLICATE note below, not a candidate-level skip.)
//
// FETCHING: icc.illinois.gov's public eDocket case-search is a plain
// server-rendered ASP.NET MVC site. There IS a CAPTCHA ("I'm not a robot")
// in front of the single-docket-number lookup form at /Docket/Search — but
// that's not the path used here. The *case* search at
// /docket/search/cases (filter by case type + authority/service type,
// enctype=multipart/form-data, POST) has no CAPTCHA and, critically,
// redirects (302) to a plain GET URL encoding the chosen filters as query
// params: /docket/search/cases/results?ct=<caseType>&st=<serviceType>&o=
// <onlyOpened>. That GET URL is directly fetchable with no form submission,
// no cookies, no antiforgery token at all — confirmed by requesting it cold
// with a fresh curl process (no prior POST, no cookie jar) and getting an
// identical result. Both `ct` and `st` accept comma-separated lists ANDed
// as OR-filters in one request (confirmed: ct=5|4,5|5&st=7,18 returned
// exactly 64 = the sum of four separate single-filter requests: 39+18+3+4)
// — so the whole candidate set is one request, no pagination encountered
// even on an unfiltered ~2,591-row search.
//   - Case type "5|4" = "Certificate of Public Convenience & Necessity/Good
//     Standing/Service Authority (8-406,...) - New", "5|5" = same but
//     "- Amended" (confirmed against the search form's own <option> list,
//     not guessed — this ICC case-type bucket is administratively shared
//     across several different certificate types authorized by different
//     PUA sections, not just CPCN, hence the SCOPING filtering below).
//   - Service/authority type "7" = Electric, "18" = Transmission Utility.
//     "Electric Cooperative" (6) returned zero results for this case-type
//     combination. "Distributed Generation" (24) and "Utility-Scale Solar
//     Installers" (29) exist as options but are confirmed NOT what they
//     sound like for this purpose: the one live "Distributed Generation"
//     CPCN candidate (P2024-0702) turned out to be "Application for
//     Certification as an Installer of Distributed Generation Facilities"
//     — a business-licensing certificate for a solar installer *company*,
//     unrelated to any specific generation project siting. Excluded.
//   - Detail: GET /docket/{P-prefixed docket id, e.g. P2026-0156} (the id
//     in each search result's own href) is a plain case-details page with a
//     `id="CaseStatus"` field — see STATUS. No separate documents/orders
//     endpoint exists; the docket's 5 sub-pages are Case Details, Docket
//     Sheet, Staff Assigned, Service List, Schedule (confirmed from the
//     sidebar nav — no distinct "Orders" or "Documents" listing endpoint).
// No HTML-parsing dependency added, same discipline as this series' other
// regex-based sources — each extractor throws if the expected structure
// isn't found.
//
// SCOPING: unlike Texas/Colorado/South Carolina, Illinois's CPCN case-type
// bucket also catches petitions that mention "Certificate of Public
// Convenience and Necessity" without actually being a facility-siting
// application for one:
//   - Follow-on petitions referencing an *already-granted* certificate
//     (e.g. P2016-0595, P2015-0269: route modifications to the line
//     approved in Docket 12-0598) — these don't restate the CPCN phrase at
//     all and are naturally excluded by CPCN_RE.
//   - A declaratory-ruling petition arguing a certificate ISN'T required
//     (P2005-0642: "Petition for Declaratory Ruling determining that an
//     additional Certificate of Public Convenience and Necessity ... is
//     not necessary...") — this DOES contain the CPCN phrase, so CPCN_RE
//     alone doesn't catch it. Confirmed only one such case in the full
//     26-year, 64-docket history, and it's the only description containing
//     the word "declaratory" anywhere in that set — DECLARATORY_RE excludes
//     it. Same lesson as South Carolina's "Petition for Declaratory Order
//     Finding a Certificate is/isn't required" false positive.
//   - A pure eminent-domain-authority petition under PUA Section 8-509
//     (P2025-0923: "Petition for an Order Pursuant to Section 8-509 ...
//     Authorizing Use of Eminent Domain Power") filed under the same
//     case-type code even though it never mentions a certificate at all —
//     naturally excluded by CPCN_RE.
//   - A pure Section 16-115 "Certificate of Service Authority" (retail
//     electric supplier registration, P2001-0634) — also naturally
//     excluded, it never says "Public Convenience and Necessity".
// Confirmed against the real, full history of this case-type/service-type
// combination since 2000 (64 candidates): 60 mention the CPCN phrase, 59
// are genuine facility-siting applications after DECLARATORY_RE.
//
// A striking, hand-confirmed domain fact worth documenting explicitly:
// across all 59 genuine candidates spanning 2000-2026, exactly ONE
// (P2001-0516, filed 2001) is a generation project ("construct, own,
// operate and maintain an electric combustion turbine generator") — every
// other candidate is a transmission line/facility CPCN. Zero mention solar,
// wind, or battery storage anywhere in the full candidate set. This lines
// up with Illinois's 1997 deregulation of electric generation (Electric
// Service Customer Choice Law) — competitive/merchant generators generally
// don't need a state CPCN, so ICC's CPCN docket is overwhelmingly a
// transmission-siting instrument in practice, not a generation one. This
// module still checks for generation/storage keywords (in case that ever
// changes), but expect this source to read almost entirely as transmission.
//
// STATUS: same lesson as South Carolina/Arizona, independently
// re-confirmed here — but with an unusually reassuring result. ICC's own
// `CaseStatus` field on the detail page (e.g. "Initial - Heard & Taken" vs.
// "Initial - Closed") turned out, after deliberately trying to catch it
// lying, to be reliable: cross-checked CaseStatus against each docket's own
// Docket Sheet filing history for 30+ real dockets spanning 2000-2026 —
// every "*Closed" status docket had a corresponding "Order Entered - Final"
// entry in its filing history, and the one still-active docket checked
// (P2026-0156, GRIT project, CaseStatus="Initial - Heard & Taken") had no
// such entry. isResolved() below just checks CaseStatus for "closed"
// (case-insensitively) — deliberately NOT more specific than that. An
// early design tried to also classify granted-vs-denied by keyword-matching
// the Docket Sheet's filing-history entry descriptions (mirroring SC's
// GRANT_RE/DENY_RE), but a real counterexample killed that: docket
// P2023-0658's history contains a "Commission Action - Dismissal w/o
// Order" entry whose text is "the Commission ... DENIED ... Application
// for Rehearing of Sheila Vaughn ... and ... Eddie Vaughn, Jr. and Alex
// Junkins" — a procedural denial of two intervenors' rehearing requests,
// not a denial of the underlying certificate (which this docket's CPCN was
// in fact granted). Exactly the SC "Order Granting Motion to Withdraw as
// Counsel" false-positive lesson, independently rediscovered. Since
// RESOLVED_STAGES excludes approved/denied/withdrawn/cancelled dockets from
// the site identically either way, this module doesn't attempt to
// distinguish them — every resolved (CaseStatus contains "closed") docket
// maps to the same currentStage, and dataQualityNote says so honestly.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields. Captions are
// consistent enough to regex (same style as TX/SC/AZ): county names appear
// as "...in <County[, County...]> Count(y|ies), Illinois." (single, "X
// County and Y County," and "W, X, Y, and Z Counties," forms all
// confirmed against real captions — a 13-county joint Ameren petition,
// P2024-0088, was the widest real example). Voltage — NOT MW, see above —
// appears as either "NNN,000 volt(s)" (kV = the digits before the literal
// ",000") or "NNN kV"/"NNN KV" directly; multi-voltage lines ("69 KV and
// 138 KV dual constructed...") are handled by taking the max of all
// matches found, not just the first. capacityUnit is "kV" (not "MW") for
// every candidate that has one — matches this codebase's existing
// eiaPipelineProjects.ts precedent of using a source-appropriate unit and
// relying on the site's MW-aggregate stat already only summing
// capacityValue when capacityUnit === "MW", so this doesn't corrupt that
// total.
//
// CROSS-SOURCE DUPLICATE: docket 22-0499 (Grain Belt Express) is the same
// physical interstate transmission line already tracked via the federal
// Permitting Dashboard (permittingDashboard.ts, project_id 109441) —
// confirmed by hand 2026-08-23. Declared as one project via
// src/lib/ingest/manualOverrides.csv (shared matchKey
// "grain-belt-express-phase-1") rather than excluded here, so the site
// shows one merged row carrying both sources' links.
//
// Wired to Vercel Cron weekly, 22:00 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-il-icc/route.ts) — a real run's timing was
// measured (64 candidates, 59 real applications) before scheduling this.
// Also politeness-delayed between per-candidate detail requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://icc.illinois.gov";
// "5|4" = CPCN/Good Standing/Service Authority - New, "5|5" = - Amended.
const CASE_TYPES = "5|4,5|5";
// "7" = Electric, "18" = Transmission Utility. See module header SCOPING
// for why Electric Cooperative/Distributed Generation/Utility-Scale Solar
// Installers are deliberately not included.
const SERVICE_TYPES = "7,18";

export const MAX_CANDIDATES = 100;
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IL ICC request failed (${res.status}): ${url}`);
  return res.text();
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as the other regex-based sources in this series, not a full
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

// Search-result cards render applicant names and descriptions with <br>
// line-wraps mid-phrase (e.g. "Kishwaukee Area Reliability<br>Expansion") —
// stripping tags alone isn't enough, the <br> has to become a space first
// or words fuse together and later regexes (e.g. CPCN_RE) silently miss.
function cleanText(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

interface DocketSearchResult {
  docketId: string; // e.g. "P2026-0156"
  docketNumber: string; // e.g. "26-0156"
  applicant: string;
  description: string;
  filedDate: Date | null;
}

const SEARCH_CARD_RE =
  /<h3><a href="\/docket\/(P\d{4}-\d{4})">([^<]+)<\/a><\/h3>\s*<h4>([\s\S]*?)<\/h4>\s*<span class="d-block mt-3">([\s\S]*?)<\/span>\s*<span class="d-block mt-3">Case Type:\s*<\/span>\s*<span class="d-block">Case Status:\s*<\/span>\s*<span class="d-block mt-3">Filed:\s*([^<]+)<\/span>/g;

export function parseSearchResults(html: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(SEARCH_CARD_RE)) {
    results.push({
      docketId: m[1],
      docketNumber: decodeHtmlEntities(m[2]),
      applicant: cleanText(m[3]),
      description: cleanText(m[4]),
      filedDate: parseLongDate(cleanText(m[5])),
    });
  }
  const reportedCountM = /(\d+)\s+results/i.exec(html);
  const reportedCount = reportedCountM ? Number(reportedCountM[1]) : null;
  if (results.length === 0 && reportedCount != null && reportedCount > 0) {
    throw new Error(
      "IL ICC case search reported results but parseSearchResults matched zero rows — the card structure likely changed. Check SEARCH_CARD_RE in src/lib/ingest/ilIccDockets.ts against a fresh response.",
    );
  }
  return results;
}

function parseLongDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface DocketDetail {
  resolved: boolean;
}

const CASE_STATUS_RE = /<pre class="soi-icc-pre" id="CaseStatus">([^<]*)<\/pre>/;

export function parseDetail(html: string): DocketDetail {
  const m = CASE_STATUS_RE.exec(html);
  if (!m) {
    throw new Error(
      "IL ICC docket detail page didn't contain the expected CaseStatus field — the page structure likely changed. Check parseDetail in src/lib/ingest/ilIccDockets.ts against a fresh response.",
    );
  }
  const status = decodeHtmlEntities(m[1]);
  // See module header STATUS: deliberately just "closed or not" — every
  // "*Closed" status observed corresponds to a final Commission order per
  // the docket's own filing history, and finer-grained granted/denied
  // classification from filing-history keywords proved unreliable (a real
  // "DENIED" entry turned out to be about an intervenor's rehearing
  // request, not the underlying certificate).
  return { resolved: /\bclosed\b/i.test(status) };
}

async function searchCandidates(): Promise<DocketSearchResult[]> {
  const url = `${BASE_URL}/docket/search/cases/results?ct=${CASE_TYPES}&st=${SERVICE_TYPES}&o=False`;
  const html = await fetchText(url);
  return parseSearchResults(html);
}

async function fetchDetail(docketId: string): Promise<DocketDetail> {
  const html = await fetchText(`${BASE_URL}/docket/${docketId}`);
  return parseDetail(html);
}

// Requires the actual CPCN phrase (handles Illinois's case-type bucket
// also containing non-CPCN petitions — see module header SCOPING).
const CPCN_RE = /certificate\s+of\s+public\s+convenience\s+and\s+necessity/i;
// Excludes the one real "is a certificate even required" petition found in
// the full candidate history — see module header SCOPING.
const DECLARATORY_RE = /declaratory/i;

const GENERATION_RE = /\b(generat(?:or|ion|ing)|combustion turbine|power plant|combined cycle)\b/i;
const STORAGE_RE = /\b(battery|energy storage|bess)\b/i;
const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(combined cycle|combustion turbine|natural gas|gas[- ]fired)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
];

function inferProjectType(description: string): ProjectType {
  if (STORAGE_RE.test(description)) return "storage";
  if (GENERATION_RE.test(description)) return "generation";
  // See module header — 58 of 59 real candidates are transmission-line
  // CPCNs; treat that as the default rather than falling to "other" (not
  // even a valid ProjectType) when neither generation nor storage keywords
  // are present.
  return "transmission";
}

function inferFuelType(description: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(description)) return fuel;
  }
  return "other";
}

// "345,000 volt"/"345,000-volt" -> the digits before the literal ",000"
// suffix ARE the kV value (no /1000 needed — that was a real bug caught
// while testing against real captions: "34,000 volt" was coming out as
// 0.034 instead of 34). "NNN kV"/"NNN KV" is matched directly. Multi-
// voltage descriptions ("69 KV and 138 KV dual constructed...") take the
// max of everything found, not just the first match.
function extractVoltageKv(description: string): number | null {
  const values: number[] = [];
  const voltBlockRe = /((?:[\d,]+\s*,?000\s*(?:,|and|&)?\s*)+)-?\s*volts?\b/gi;
  for (const block of description.matchAll(voltBlockRe)) {
    for (const numM of block[1].matchAll(/([\d,]+)\s*,?000/g)) {
      const v = Number(numM[1].replace(/,/g, ""));
      if (Number.isFinite(v)) values.push(v);
    }
  }
  for (const m of description.matchAll(/([\d,]+)\s*kv\b/gi)) {
    const v = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(v)) values.push(v);
  }
  return values.length > 0 ? Math.max(...values) : null;
}

// Handles the four real forms confirmed against this source: a single
// county ("...in Cook County, Illinois."), two counties each restating
// "County" ("...in Jefferson County and Wayne County, Illinois."), exactly
// two counties sharing one plural "Counties" with no repeated word
// ("...in Bureau and LaSalle Counties, Illinois." — found only by running
// a real dry-run insert against docket 26-0081 and noticing county came
// back null despite the caption clearly naming two counties; the earlier
// two patterns both required either a repeated "County" per name or a
// comma-joined list, and this one has neither), and a comma list restating
// "Counties" once at the end ("...in Hancock, Peoria, ..., and Iroquois
// Counties, Illinois." — a real 13-county joint Ameren petition,
// P2024-0088, confirmed this form). Many candidates (company-wide or
// route-unspecified petitions) mention no county at all — returns null
// rather than guessing.
function extractCounties(description: string): string | null {
  let m = /\bin\s+([A-Z][\w.']+)\s+County\s+and\s+([A-Z][\w.']+)\s+County,\s+Illinois/.exec(description);
  if (m) return `${m[1]}, ${m[2]}`;

  m = /\bin\s+([A-Z][\w.']+)\s+and\s+([A-Z][\w.']+)\s+Counties,\s+Illinois/.exec(description);
  if (m) return `${m[1]}, ${m[2]}`;

  m = /\bin\s+((?:[A-Z][\w.']+,\s*)+(?:and\s+)?[A-Z][\w.']+)\s+Counties,\s+Illinois/.exec(description);
  if (m) {
    return m[1]
      .replace(/\band\s+/gi, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }

  m = /\bin\s+([A-Z][\w.']+)\s+County,\s+Illinois/.exec(description);
  return m ? m[1] : null;
}

function normalizeDocket(search: DocketSearchResult, detail: DocketDetail): NormalizedProject {
  const matchKey = resolveMatchKey("il-icc", search.docketId);
  const projectType = inferProjectType(search.description);
  const fuelType = inferFuelType(search.description, projectType);
  const voltageKv = extractVoltageKv(search.description);
  const county = extractCounties(search.description);

  // See module header STATUS — resolved (granted/denied/withdrawn/
  // dismissed, indistinguishably) always maps to the same RESOLVED_STAGES
  // value since upsertNormalizedProject excludes all of them from the site
  // identically either way.
  const currentStage: ProjectStage = detail.resolved ? "approved_awaiting_construction" : "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Illinois Commerce Commission's public eDocket case search.",
    'This docket\'s "still waiting" determination is based on whether the ICC\'s own Case Status field for this docket contains "Closed" (cross-checked against real dockets\' filing histories, which show a final "Order Entered - Final" entry exactly when Case Status reads closed) — but this source cannot reliably distinguish a granted certificate from a denied, withdrawn, or dismissed one; see the ingestion module header for a real case (docket 23-0658) where keyword-scanning the filing history for "denied" would have produced a false signal.',
  ];
  if (voltageKv != null) {
    dataQualityNoteParts.push("Voltage figure (kV, not MW) is parsed from the docket caption text, not a structured field — not independently verified.");
  } else {
    dataQualityNoteParts.push("No capacity or voltage figure could be parsed from the docket caption text.");
  }
  if (projectType !== "transmission" && fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Illinois, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${search.applicant} (IL ICC Docket ${search.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "IL",
    county,
    capacityValue: voltageKv,
    capacityUnit: voltageKv != null ? "kV" : null,
    applicationFiledDate: search.filedDate,
    dateConfidence: "exact",
    currentStatus: `Illinois ICC docket ${search.docketNumber}: ${detail.resolved ? "closed" : "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Illinois Commerce Commission — Docket No. ${search.docketNumber}, "${search.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `IL ICC Docket No. ${search.docketNumber}`,
        url: `${BASE_URL}/docket/${search.docketId}`,
      },
    ],
    externalIds: { ilIcc: search.docketId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  cpcnCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestIlIccDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allCandidates = await searchCandidates();
  const candidates = selectWithRotation(
    allCandidates.filter((c) => CPCN_RE.test(c.description) && !DECLARATORY_RE.test(c.description)),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const detail = await fetchDetail(candidate.docketId);
      toUpsert.push(normalizeDocket(candidate, detail));
    } catch (err) {
      errors.push({ matchKey: candidate.docketNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allCandidates.length,
    cpcnCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestIlIccDockets()
    .then((summary) => {
      console.log(
        `Illinois ICC docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.cpcnCandidates} real siting-certificate applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
