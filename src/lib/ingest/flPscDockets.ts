// Florida siting-certificate ingestion — one of several states built in
// parallel in the per-state series started with vaSccDockets.ts (see that
// file's header for the overall rationale). Confirmed by hand 2026-08-23.
//
// FETCHING: two agencies, two live sources, no auth/CAPTCHA/JS-only
// blocker on either.
//   - Florida PSC (floridapsc.com) is a client-rendered Angular SPA (empty
//     <app-root></app-root> shell — confirmed by curl), but it calls a
//     plain unauthenticated JSON API at pscweb.floridapsc.com (confirmed
//     by extracting `fe_baseApiUrl="https://pscweb.floridapsc.com"` out of
//     the site's main*.js bundle). The useful endpoint here is
//     GET /api/ClerkOffice/DocketDetailsByDocketsTitle?docketTitle=<term>
//     — a real full-text search over the PSC's entire docket history back
//     to 1976 (confirmed: searching "Turkey Point Units" and "nuclear"
//     surfaces real 2008/2015/2019 dockets, not just current-year ones).
//     The human-facing docket page is a DIFFERENT route than the obvious
//     guess: NOT /psc-docket-list (that's the generic open-dockets browser
//     and ignores a DocketNo query param, confirmed by loading it with
//     ?DocketNo=... and getting "0 Records"/"No dockets found!"). The real
//     per-docket URL is /clerks-office-dockets-level2?DocketNo=<docketnum>
//     — found not by guessing but by reading it off Florida DEP's own
//     project pages (see below), which link to exactly that path on
//     www.floridapsc.com, and confirmed to 200.
//   - Florida DEP's Siting Coordination Office (floridadep.gov) is a
//     plain server-rendered Drupal site — no JS needed at all. It
//     maintains a hand-curated "Applications in Process" page at
//     /water/siting-coordination-office/content/projects-process, a static
//     HTML table (Power Plants / Transmission Lines / Natural Gas
//     Pipelines columns) of every siting application DEP currently
//     considers active, each linking to a project detail page with a
//     filings list, a "(PA##-##)"/"(TA##-##)" siting case number, and
//     often a capacity figure in prose ("706-megawatt"). It also
//     maintains /water/siting-coordination-office/content/
//     conditions-certification, a chronological table of every certified
//     facility since PA74-01 (1974) — used below as the "already granted"
//     cross-check.
//
// SCOPING — the big Florida-specific gotcha: Florida does NOT have a CPCN
// process at the PSC the way VA/TX/SC/AZ do. Determination of Need
// (F.S. 403.519) is required only for power plants being certified under
// the Power Plant Siting Act (PPSA) or Transmission Line Siting Act
// (TLSA) — and by statute, solar generating facilities are exempt from
// mandatory PPSA certification unless the applicant opts in. Confirmed by
// hand: searching PSC docket titles for "determination" (industryCode=E)
// returns exactly TWO dockets in the PSC's entire 30,555-docket history —
// 20260087 (JEA, new combined-cycle unit at St. Johns River Power Park)
// and 20260020 (FPL, Andytown-Oasis transmission line) — both from 2026.
// No solar, storage, or wind project has ever gone through this docket
// type; Florida's huge solar/storage build-out is real but happens outside
// the docket-based siting-certificate process this project tracks (most of
// it stays under the PPSA's size thresholds and is permitted locally
// instead). This was cross-checked against DEP's own "Applications in
// Process" page, which independently lists the *same* two projects and
// nothing else under Power Plants/Transmission Lines, and "None at this
// time" under Natural Gas Pipelines — so this isn't a search-term miss,
// it's the real, small, current universe. Because DEP's page is a direct
// hand-maintained listing of every currently-active siting application
// (not a keyword search), it is used here as the PRIMARY discovery source
// (covering any future solar/storage project that skips the PSC docket
// entirely), with the PSC "determination" docket search used to enrich
// matched entries with a docket number/citation and to catch previously-
// active dockets that have since dropped off DEP's live page (see STATUS).
//
// STATUS — same lesson as SC/AZ, but inverted: here the *state-docket
// agency's own field lies*, while a difference source (a second agency's
// page) turns out to be the reliable one. Confirmed 2026-08-23: PSC docket
// 20260020 (FPL Andytown-Oasis) shows `docketCloseDate: "2026-06-01"` —
// i.e. the PSC's OWN "determination of need" sub-docket is closed — yet
// DEP's live "Applications in Process" page, fetched the same day, still
// lists "FPL Andytown-Oasis 500/230kV Transmission Line Project" as an
// active application, and that project's own DEP detail page shows filings
// as recent as 8/18/2026 (an "Agency Reports" filing, well after the PSC
// close date). The PSC's determination-of-need sub-proceeding is only the
// opening phase of the real, much longer DEP-administered site-
// certification process (a Division of Administrative Hearings case number
// is assigned, multiple completeness-review rounds happen, etc.) — its
// closing has no bearing on whether the project overall is still waiting.
// So: whether a project is "still waiting" here is decided by DEP's
// Applications-in-Process page (matches DEP's page this run = pending),
// NOT by the PSC docketCloseDate field, which is not even read for that
// purpose. Dockets found via the PSC "determination" search that do NOT
// currently match a DEP Applications-in-Process entry are cross-checked
// against DEP's Certified Facilities list (conditions-certification page)
// to decide granted (excluded, RESOLVED_STAGES) vs. no longer
// findable/cancelled (also excluded) — this path is unexercised by
// today's data (both known PSC dockets currently match a DEP in-process
// entry) but is needed for correctness on a future run, once one of these
// two projects is eventually certified or withdrawn and drops off DEP's
// live page.
//
// MATCHING PSC dockets to DEP entries: no shared ID exists between the two
// agencies' public data, so this uses a plain word-overlap heuristic
// (shared non-boilerplate words of length >= 5, e.g. "andytown"/"oasis" or
// "johns"/"river"/"park") between the PSC docket title and the DEP entry's
// own project-name text — confirmed to correctly match both of the only
// two real candidates that exist right now.
//
// FUEL/PROJECT TYPE: taken directly from which DEP table column an entry
// is listed under (Power Plants -> generation, Transmission Lines ->
// transmission, Natural Gas Pipelines -> pipeline/lng), which is more
// reliable than keyword-guessing from prose. Fuel subtype (solar/gas/etc)
// and capacity (MW) are then parsed from the DEP project detail page's own
// descriptive prose, e.g. "a new 706-megawatt one-on-one combined cycle
// generating facility" for JEA — confirmed present; not present for the
// FPL transmission line (transmission capacity is expressed in kV/miles,
// not MW, same convention as the other transmission-siting modules in this
// series, which also leave capacityValue null for lines).
//
// Wired to Vercel Cron weekly, 22:30 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-fl-psc/route.ts) — a real run's timing was
// measured (2 candidates, the entire current universe for this docket type)
// before scheduling this. Politeness-delayed between per-candidate detail
// requests (DEP project pages).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const PSCWEB_BASE = "https://pscweb.floridapsc.com";
const PSC_BASE = "https://www.floridapsc.com";
const DEP_BASE = "https://floridadep.gov";
const APPLICATIONS_IN_PROCESS_URL = `${DEP_BASE}/water/siting-coordination-office/content/projects-process`;
const CERTIFIED_FACILITIES_URL = `${DEP_BASE}/water/siting-coordination-office/content/conditions-certification`;

export const MAX_CANDIDATES = 25;
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as scPscDockets.ts/txPuctDockets.ts, not a full HTML-entity
// library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Florida siting-source request failed (${res.status}): ${url}`);
  return res.text();
}

// --- PSC "determination of need" docket search ------------------------

interface PscDocketCandidate {
  docketId: number;
  docketnum: string;
  docketTitle: string;
  docketedDate: Date | null;
  docketCloseDate: Date | null;
  industryCode: string;
}

function parseIsoDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface PscTitleSearchResponse {
  result: {
    result: {
      docketId: number;
      docketnum: string;
      docketTitle: string;
      docketedDate: string;
      docketCloseDate: string | null;
      industryCode: string;
    }[];
  };
}

// Single word ("determination"), not the full phrase "determination of
// need" — a plain substring match, so this is robust to the exact word
// order/spacing PSC clerks used in a given docket's title. Confirmed this
// returns the same 2 real dockets as the full phrase and as "need for" and
// as "generating" — see module header SCOPING.
async function fetchPscNeedDeterminationDockets(): Promise<PscDocketCandidate[]> {
  const url =
    `${PSCWEB_BASE}/api/ClerkOffice/DocketDetailsByDocketsTitle?pageNumber=1&pageSize=100` +
    `&sortFieldName=&sortingOrder=&docketTitle=${encodeURIComponent("determination")}`;
  const text = await fetchText(url);
  let data: PscTitleSearchResponse;
  try {
    data = JSON.parse(text) as PscTitleSearchResponse;
  } catch {
    throw new Error(
      "FL PSC docket title search didn't return JSON — the API shape likely changed. Check fetchPscNeedDeterminationDockets in src/lib/ingest/flPscDockets.ts against a fresh response.",
    );
  }
  const rows = data?.result?.result;
  if (!Array.isArray(rows)) {
    throw new Error(
      "FL PSC docket title search response didn't contain result.result[] — the API shape likely changed. Check fetchPscNeedDeterminationDockets in src/lib/ingest/flPscDockets.ts against a fresh response.",
    );
  }
  return rows
    .filter((r) => r.industryCode === "E")
    .map((r) => ({
      docketId: r.docketId,
      docketnum: r.docketnum,
      docketTitle: decodeHtmlEntities(r.docketTitle),
      docketedDate: parseIsoDate(r.docketedDate),
      docketCloseDate: parseIsoDate(r.docketCloseDate),
      industryCode: r.industryCode,
    }));
}

// --- DEP "Applications in Process" page --------------------------------

interface DepInProcessEntry {
  projectType: ProjectType;
  name: string;
  href: string;
}

const COLUMN_PROJECT_TYPES: ProjectType[] = ["generation", "transmission", "pipeline"];

// Windowed on the "Applications in Process" heading through the next <h2>
// ("Modifications in Process") rather than a single greedy regex over the
// whole page, same discipline as scPscDockets.ts's tabStart/tabEnd
// slicing — safer against unrelated nested tags elsewhere on the page.
export function parseApplicationsInProcess(html: string): DepInProcessEntry[] {
  const start = html.indexOf("Applications in Process</h2>");
  const end = html.indexOf("Modifications in Process</h2>", start);
  if (start < 0 || end < 0) {
    throw new Error(
      "DEP Applications-in-Process page didn't contain the expected 'Applications in Process' / 'Modifications in Process' headings — the page structure likely changed. Check parseApplicationsInProcess in src/lib/ingest/flPscDockets.ts against a fresh response.",
    );
  }
  const section = html.slice(start, end);
  const tbodyMatch = /<tbody>([\s\S]*?)<\/tbody>/.exec(section);
  if (!tbodyMatch) {
    throw new Error(
      "DEP Applications-in-Process table has no <tbody> — the page structure likely changed. Check parseApplicationsInProcess in src/lib/ingest/flPscDockets.ts against a fresh response.",
    );
  }

  const entries: DepInProcessEntry[] = [];
  for (const rowMatch of tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    cells.forEach((cellHtml, i) => {
      const projectType = COLUMN_PROJECT_TYPES[i];
      if (!projectType) return;
      for (const linkMatch of cellHtml.matchAll(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const name = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, ""));
        if (!name) continue;
        entries.push({ projectType, name, href: linkMatch[1] });
      }
    });
  }
  return entries;
}

// --- DEP "Conditions of Certification" page (already-granted check) ----

// Flat list of certified facility/line names, used only as a fallback
// cross-check for PSC dockets that no longer match a DEP in-process entry
// (see module header STATUS) — not split by Power Plant vs Transmission
// Line since a simple name-overlap check doesn't need the distinction.
export function parseCertifiedFacilityNames(html: string): string[] {
  const start = html.indexOf("<h3>Power Plant</h3>");
  if (start < 0) {
    throw new Error(
      "DEP Conditions-of-Certification page didn't contain the expected 'Power Plant' heading — the page structure likely changed. Check parseCertifiedFacilityNames in src/lib/ingest/flPscDockets.ts against a fresh response.",
    );
  }
  const section = html.slice(start);
  const names: string[] = [];
  for (const m of section.matchAll(/<a href="\/(?:air|water)\/siting-coordination-office\/content\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g)) {
    const name = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ""));
    if (name) names.push(name);
  }
  return names;
}

// --- DEP project detail page --------------------------------------------

interface DepProjectDetail {
  caseNumber: string | null;
  applicant: string | null;
  filedDate: Date | null;
  capacityMw: number | null;
  counties: string[];
}

const CASE_NUMBER_RE = /\(([A-Z]{2}\d{2,3}-[A-Z0-9]+)\)/;
const APPLICANT_RE = /<strong>([^<]+?)<\/strong>/;
const FILED_DATE_RE = />Application<\/a>\s*\(filed\s+([\d/]+)\)/i;
const CAPACITY_MW_RE = /([\d,]+(?:\.\d+)?)\s*-?\s*(?:MW|megawatts?)\b/i;
const COUNTY_RE = /\b([A-Z][a-zA-Z]+(?:-[A-Z][a-zA-Z]+)?)\s+County\b/g;

export function parseDepProjectDetail(html: string): DepProjectDetail {
  const bodyStart = html.indexOf('property="schema:text"');
  const body = bodyStart >= 0 ? html.slice(bodyStart, bodyStart + 6000) : html;

  const caseNumber = CASE_NUMBER_RE.exec(body)?.[1] ?? null;
  const applicantRaw = APPLICANT_RE.exec(body)?.[1];
  const applicant = applicantRaw ? decodeHtmlEntities(applicantRaw).trim() : null;
  const filedDateRaw = FILED_DATE_RE.exec(body)?.[1] ?? null;
  const filedDate = filedDateRaw ? parseIsoDate(filedDateRaw) : null;
  const capacityRaw = CAPACITY_MW_RE.exec(body)?.[1];
  const capacityMw = capacityRaw ? Number(capacityRaw.replace(/,/g, "")) : null;

  const plainBody = stripTags(body);
  const counties = [...new Set([...plainBody.matchAll(COUNTY_RE)].map((m) => m[1]))];

  return {
    caseNumber,
    applicant,
    filedDate,
    capacityMw: capacityMw != null && Number.isFinite(capacityMw) ? capacityMw : null,
    counties,
  };
}

// --- PSC <-> DEP matching -------------------------------------------------

const STOPWORDS = new Set([
  "petition", "determination", "need", "power", "plant", "plants", "project", "projects",
  "transmission", "line", "lines", "company", "corporation", "florida", "application",
  "facility", "facilities", "located", "associated", "electric", "electrical", "service",
  "counties", "county", "unit", "units", "new",
]);

function significantWords(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !STOPWORDS.has(w)),
  );
}

function titlesLikelyMatch(pscTitle: string, depName: string): boolean {
  const pscWords = significantWords(pscTitle);
  const depWords = significantWords(depName);
  for (const w of depWords) {
    if (pscWords.has(w)) return true;
  }
  return false;
}

function nameLikelyOnCertifiedList(depName: string, certifiedNames: string[]): boolean {
  const depWords = significantWords(depName);
  return certifiedNames.some((certified) => {
    const certWords = significantWords(certified);
    for (const w of certWords) {
      if (depWords.has(w)) return true;
    }
    return false;
  });
}

// --- Fuel-type inference from DEP project prose -------------------------

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(battery|storage|bess)\b/i, "storage"],
  [/\b(combined cycle|combustion turbine|natural gas)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
];

function inferFuelType(text: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "pipeline") return "pipeline";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(text)) return fuel;
  }
  return "other";
}

// --- Normalization --------------------------------------------------------

interface Candidate {
  projectType: ProjectType;
  name: string;
  depHref: string | null;
  depDetail: DepProjectDetail | null;
  pscDocket: PscDocketCandidate | null;
  currentStage: ProjectStage;
  resolutionNote: string;
}

function normalizeCandidate(c: Candidate): NormalizedProject | null {
  const sourceId = c.depDetail?.caseNumber ?? c.pscDocket?.docketnum ?? null;
  if (!sourceId) return null; // no stable identity to key off of — skip rather than guess

  const matchKey = resolveMatchKey("fl-psc", sourceId);
  const descriptionText = c.name + " " + (c.pscDocket?.docketTitle ?? "");
  const fuelType = inferFuelType(descriptionText, c.projectType);

  const county =
    c.depDetail && c.depDetail.counties.length > 0
      ? c.depDetail.counties.join("/")
      : c.pscDocket
        ? [...new Set([...c.pscDocket.docketTitle.matchAll(COUNTY_RE)].map((m) => m[1]))].join("/") || null
        : null;

  const applicant = c.depDetail?.applicant ?? null;

  const dataQualityNoteParts: string[] = [
    "Sourced from the Florida Public Service Commission's Determination of Need dockets (pscweb.floridapsc.com) and the Florida DEP Siting Coordination Office's Applications-in-Process and Certified-Facilities pages (floridadep.gov), which jointly administer siting certification under the Power Plant Siting Act / Transmission Line Siting Act.",
    'The PSC docket\'s own "docketCloseDate" is not reliable evidence that the project is done: a PSC determination-of-need sub-docket can close months before the underlying DEP site-certification process (a separate, longer, multi-agency review) actually concludes. "Still waiting" here is instead determined by whether the project currently appears on DEP\'s own Applications-in-Process page — see the ingestion module header for how this was calibrated against a real example.',
  ];
  if (c.depDetail?.capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the DEP project page's descriptive text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the available project description text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Florida, per the DEP/PSC project text — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }
  if (!c.pscDocket) {
    dataQualityNoteParts.push("No matching Florida PSC docket was found for this DEP siting application (expected for e.g. a solar facility, which Florida law does not require to go through a PSC determination-of-need proceeding); only DEP's own siting-case record is cited.");
  }
  dataQualityNoteParts.push(c.resolutionNote);

  const sources = [
    ...(c.depHref
      ? [{ label: `FL DEP Siting Coordination Office: ${c.name}`, url: c.depHref.startsWith("http") ? c.depHref : `${DEP_BASE}${c.depHref}` }]
      : []),
    ...(c.pscDocket
      ? [{ label: `FL PSC Docket No. ${c.pscDocket.docketnum}`, url: `${PSC_BASE}/clerks-office-dockets-level2?DocketNo=${c.pscDocket.docketnum}` }]
      : []),
  ];

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];
  const caseLabel = c.depDetail?.caseNumber ?? (c.pscDocket ? `PSC Docket ${c.pscDocket.docketnum}` : sourceId);

  return {
    matchKey,
    name: `${applicant ?? c.name} (FL Siting Case ${caseLabel})`,
    projectType: c.projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "FL",
    county,
    capacityValue: c.depDetail?.capacityMw ?? null,
    capacityUnit: c.depDetail?.capacityMw != null ? "MW" : null,
    applicationFiledDate: c.depDetail?.filedDate ?? c.pscDocket?.docketedDate ?? null,
    dateConfidence: "exact",
    currentStatus: `Florida siting certification (${caseLabel}): ${c.currentStage === "agency_permitting" ? "application in process" : c.currentStage}`,
    currentStage: c.currentStage,
    causeSlugs,
    causeDetail: `Waiting on Power Plant Siting Act / Transmission Line Siting Act certification from the Florida DEP Siting Coordination Office (and, where applicable, a determination of need from the Florida PSC) — ${caseLabel}, "${c.name}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources,
    externalIds: {
      ...(c.depDetail?.caseNumber ? { flDepSiting: c.depDetail.caseNumber } : {}),
      ...(c.pscDocket ? { flPsc: c.pscDocket.docketnum } : {}),
    },
  };
}

export interface IngestSummary {
  depInProcessCount: number;
  pscDeterminationDocketCount: number;
  candidatesBuilt: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestFlPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const [pscDockets, applicationsHtml, certifiedHtml] = await Promise.all([
    fetchPscNeedDeterminationDockets(),
    fetchText(APPLICATIONS_IN_PROCESS_URL),
    fetchText(CERTIFIED_FACILITIES_URL),
  ]);

  const depInProcess = parseApplicationsInProcess(applicationsHtml);
  const certifiedNames = parseCertifiedFacilityNames(certifiedHtml);

  const matchedPscDocketIds = new Set<number>();
  const candidates: Candidate[] = [];

  // Primary pass: every DEP Applications-in-Process entry is, by
  // definition, still waiting — see module header STATUS.
  for (const entry of depInProcess) {
    const pscDocket = pscDockets.find((d) => titlesLikelyMatch(d.docketTitle, entry.name)) ?? null;
    if (pscDocket) matchedPscDocketIds.add(pscDocket.docketId);
    candidates.push({
      projectType: entry.projectType,
      name: entry.name,
      depHref: entry.href,
      depDetail: null, // filled in below, after a politeness-delayed fetch
      pscDocket,
      currentStage: "agency_permitting",
      resolutionNote: "Currently listed on DEP's Applications-in-Process page (fetched at ingestion time) as an active siting application.",
    });
  }

  // Secondary pass: PSC determination-of-need dockets that did NOT match a
  // current DEP in-process entry — either already certified or no longer
  // active. Needed so a project that clears DEP's live page on a later run
  // gets explicitly re-upserted into a RESOLVED_STAGES stage (triggering
  // common.ts's delete-on-resolve), rather than just silently stopping
  // being mentioned. Unexercised by today's data (both known PSC dockets
  // currently match a DEP in-process entry) but required for correctness.
  for (const docket of pscDockets) {
    if (matchedPscDocketIds.has(docket.docketId)) continue;
    const certified = nameLikelyOnCertifiedList(docket.docketTitle, certifiedNames);
    candidates.push({
      projectType: /transmission|kv line|kv lines|substation/i.test(docket.docketTitle) ? "transmission" : "generation",
      name: docket.docketTitle,
      depHref: null,
      depDetail: null,
      pscDocket: docket,
      currentStage: certified ? "approved_awaiting_construction" : "cancelled",
      resolutionNote: certified
        ? "No longer listed on DEP's Applications-in-Process page and a name-matching entry was found on DEP's Certified-Facilities list — treated as certified/approved."
        : "No longer listed on DEP's Applications-in-Process page and no matching entry was found on DEP's Certified-Facilities list — treated as no longer active (withdrawn, dismissed, or otherwise resolved) rather than left as a stale 'still waiting' row.",
    });
  }

  const limited = candidates.slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of limited) {
    try {
      if (candidate.depHref) {
        const detailUrl = candidate.depHref.startsWith("http") ? candidate.depHref : `${DEP_BASE}${candidate.depHref}`;
        const detailHtml = await fetchText(detailUrl);
        candidate.depDetail = parseDepProjectDetail(detailHtml);
        await sleep(REQUEST_DELAY_MS);
      }
      const normalized = normalizeCandidate(candidate);
      if (normalized) toUpsert.push(normalized);
    } catch (err) {
      errors.push({ matchKey: candidate.name, message: String(err) });
    }
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    depInProcessCount: depInProcess.length,
    pscDeterminationDocketCount: pscDockets.length,
    candidatesBuilt: limited.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestFlPscDockets()
    .then((summary) => {
      console.log(
        `Florida siting-certificate ingestion complete: ${summary.depInProcessCount} DEP applications in process, ` +
          `${summary.pscDeterminationDocketCount} PSC determination-of-need dockets on record, ` +
          `${summary.candidatesBuilt} candidates built, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
