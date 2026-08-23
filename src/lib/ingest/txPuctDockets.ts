// Texas Public Utility Commission (PUCT) docket ingestion — second state in
// the per-state series started with vaSccDockets.ts (see that file's header
// for the overall rationale: no national aggregator for state PUC/PSC
// dockets exists, so this site builds per-state coverage one confirmed
// source at a time).
//
// FETCHING: PUC Interchange (interchange.puc.texas.gov/search/) confirmed
// 2026-08-23 to be a plain server-rendered HTML site — no JS-loaded API, no
// CSRF/session token required (unlike Virginia's Breeze API, which needed
// none either but for a different reason — this one needs *nothing at all*,
// a GET with query params returns real results directly). Two endpoints:
//   - Search: /search/dockets/?UtilityType=E&Description=<phrase>&DateFiledFrom=<date>
//     returns an HTML table of matching dockets (Control number, filing
//     count, utility, case-style description).
//   - Filings: /search/filings/?ControlNumber=<n>&UtilityType=E returns an
//     HTML table of every individual filing in that docket (item number,
//     file-stamp date, filing party, item type, description) — this is
//     both the source of real procedural milestones (richer than
//     Virginia's activity log — one row per actual filed document) and,
//     since PUCT publishes no docket-level status field, the only way to
//     determine whether a docket is still open. See STATUS below.
// No dependency added for HTML parsing — both tables have a simple,
// consistent enough structure (confirmed by hand against real responses,
// not assumed) that a scoped regex extraction is more honest about its own
// fragility than pulling in a full DOM parser for two known shapes. Each
// extractor throws if the expected row structure isn't found, same
// "fail loudly on a shifted format" discipline as the Excel-based sources.
//
// SCOPING: searches Case Style for "certificate of convenience and
// necessity" (Texas's own name for the same CPCN concept Virginia's
// captions use verbatim) restricted to UtilityType=E (electric). Confirmed
// 2026-08-23: this returns far more candidates than Virginia's equivalent
// search — 125+ dockets with matching activity in the last ~2 years,
// vs. Virginia's 46 in its *entire history* — because Texas's docket
// volume for CCN cases is simply much larger and its search matches any
// filing's date, not just the original application's. Two categories of
// candidate are excluded as not being a physical project at all, both
// found by hand against a real 95-docket batch, not assumed up front:
//   - COMPLIANCE_DOCKET_RE: a downstream monitoring docket for a CCN
//     *already granted* elsewhere (Control 48344, open since 2018,
//     forever racking up "MAINTAINING OPEN STATUS" orders).
//   - SERVICE_AREA_EXCEPTION_RE: a territorial/franchise dispute over
//     which utility may serve an area — an administrative boundary
//     question, not a facility siting decision. This was ~30% (28/95) of
//     that same test batch — large enough that leaving it in would have
//     meaningfully diluted what this source actually tracks.
//
// STATUS — the real hard problem this source has that Virginia doesn't:
// PUCT publishes no "Active"/"Closed" field anywhere in this API. Confirmed
// by hand against four real dockets before finalizing isResolved():
//   - Control 88 (Allens Creek Nuclear, a 1970s-80s case retroactively
//     digitized in 2014 as a single "BOOK FILE" scan): no real procedural
//     history at all — these pre-electronic-filing dockets are excluded
//     entirely (see BOOK_FILE_RE) rather than guessed at.
//   - Control 55255 (SWEPCO generation facilities, Lamb County): matched
//     this module's date filter only because of a 2025 post-approval
//     compliance filing — its real closing event, "ORDER ON REHEARING,"
//     happened back in November 2024. Without checking full filing
//     history, this would be wrongly tracked as still "waiting."
//   - Control 57501 (El Paso Electric, Newman Buffer CCN): 207 filings
//     spanning early 2025 through August 2026, no closing order at any
//     point (it was remanded back to hearing partway through) — genuinely
//     still active, and isResolved() correctly finds no match.
//   - Control 52485 (SWEPCO Harrington coal-to-gas conversion): a real
//     miss caught in the first full-batch run, not the initial 3-case
//     calibration — its actual final order (filed right after the SOAH
//     Proposal For Decision + Exceptions sequence in 2022) was filed under
//     the bare description "ORDER", nothing else, which the original
//     CLOSING_SIGNAL_RE didn't match; unrelated 2026 filings made the
//     docket look recent and it was wrongly kept active. Added
//     BARE_ORDER_RE (exact-match only, so it can't swallow "ORDER NO. 5"
//     or similar interim orders) after finding this.
// isResolved() scans every filing's description for a closing-signal
// phrase (final order, order on rehearing, order granting/approving a
// certificate, denial, dismissal, withdrawal, or a bare "ORDER"). This is a
// real approximation, not a structured field — a docket whose closing
// order uses phrasing outside this list would be wrongly kept as "active."
// Flag any case that looks miscategorized; the fix is adding to
// CLOSING_SIGNAL_RE, not guessing harder up front.
//
// MILESTONES: a docket can have hundreds of filings (El Paso Electric's
// case above has 207) — dumping all of them would make the site's
// timeline UI unusable. Kept to filings whose description contains
// "ORDER" (the real procedural decision points: numbered interim orders,
// SOAH orders, the final order) — still real per-project data, just
// curated rather than exhaustive, same spirit as Virginia's already-curated
// activity log.
//
// Wired to Vercel Cron weekly, 18:30 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-tx-puct/route.ts) — a real run's timing was
// measured (141 candidates, ~58s) before scheduling this. Also
// politeness-delayed the same way (REQUEST_DELAY_MS between candidates)
// even though no auth suggests this
// site might tolerate more load — it's still a small state agency server,
// not a bulk API meant for this.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject, type NormalizedMilestone } from "@/lib/ingest/common";

const BASE_URL = "https://interchange.puc.texas.gov";
const SEARCH_PHRASE = "certificate of convenience and necessity";

export const MAX_CANDIDATES = 150;
const REQUEST_DELAY_MS = 250;
// Only search dockets with at least one filing in this window — bounds
// candidate volume; a docket entirely outside this window has had no
// activity recently enough to be newly relevant either way.
const LOOKBACK_YEARS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Handles the small set of entities actually observed in real responses
// (confirmed 2026-08-23) rather than pulling in a full HTML-entity library
// for two dozen possible codes this source has never been seen to use.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&rdquo;|&#8221;/g, "”")
    .replace(/&ldquo;|&#8220;/g, "“")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&#13;/g, "")
    .replace(/&#10;/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

interface DocketSearchResult {
  controlNumber: number;
  filingCount: number;
  utility: string;
  description: string;
}

const SEARCH_ROW_RE =
  /<tr>\s*<td>\s*<strong>\s*<a href="[^"]*ControlNumber=(\d+)[^"]*">\d+<\/a>\s*<\/strong>\s*<\/td>\s*<td>\s*(\d+)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/g;

export function parseSearchResults(html: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(SEARCH_ROW_RE)) {
    results.push({
      controlNumber: Number(m[1]),
      filingCount: Number(m[2]),
      utility: decodeHtmlEntities(m[3]),
      description: decodeHtmlEntities(m[4]),
    });
  }
  if (results.length === 0 && /\d+ record\(s\) found/.test(html) && !/0 record\(s\) found/.test(html)) {
    throw new Error(
      "TX PUCT search returned a results page but parseSearchResults matched zero rows — the table structure likely changed. Check SEARCH_ROW_RE in src/lib/ingest/txPuctDockets.ts against a fresh response.",
    );
  }
  return results;
}

interface DocketFiling {
  itemNumber: number;
  fileStamp: string;
  party: string;
  itemType: string;
  description: string;
}

const FILING_ROW_RE =
  /<tr>\s*<td>\s*<strong>\s*<a href="[^"]*itemNumber=(\d+)"[^>]*>\d+<\/a>\s*<\/strong>\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/g;

export function parseFilings(html: string): DocketFiling[] {
  const filings: DocketFiling[] = [];
  for (const m of html.matchAll(FILING_ROW_RE)) {
    filings.push({
      itemNumber: Number(m[1]),
      fileStamp: decodeHtmlEntities(m[2]),
      party: decodeHtmlEntities(m[3]),
      itemType: decodeHtmlEntities(m[4]),
      description: decodeHtmlEntities(m[5]),
    });
  }
  if (filings.length === 0) {
    throw new Error(
      "TX PUCT filings page returned zero parsed rows — the table structure likely changed. Check FILING_ROW_RE in src/lib/ingest/txPuctDockets.ts against a fresh response.",
    );
  }
  return filings;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TX PUCT request failed (${res.status}): ${url}`);
  return res.text();
}

async function searchCandidates(): Promise<DocketSearchResult[]> {
  const from = new Date();
  from.setFullYear(from.getFullYear() - LOOKBACK_YEARS);
  const dateFiledFrom = from.toISOString().slice(0, 10);
  const url =
    `${BASE_URL}/search/dockets/?UtilityType=E&ItemMatch=Equal&DocumentType=ALL` +
    `&Description=${encodeURIComponent(SEARCH_PHRASE)}&SortOrder=Ascending&DateFiledFrom=${dateFiledFrom}`;
  const html = await fetchText(url);
  return parseSearchResults(html);
}

async function fetchFilingsForDocket(controlNumber: number): Promise<DocketFiling[]> {
  const url = `${BASE_URL}/search/filings/?ControlNumber=${controlNumber}&UtilityType=E`;
  const html = await fetchText(url);
  return parseFilings(html);
}

// Pre-electronic-filing dockets, retroactively digitized as a single
// scanned record with no real procedural history — see module header
// (Control 88). Not usable as a "currently waiting" project either way.
const BOOK_FILE_RE = /^BOOK FILE\b/i;

// A downstream monitoring docket for a CCN *already granted* in a separate,
// earlier docket (e.g. "COMPLIANCE DOCKET FOR DOCKET NO. 46936 (...)") —
// confirmed 2026-08-23 against Control 48344, open since 2018 and still
// racking up "MAINTAINING OPEN STATUS" orders because that's what a
// compliance-monitoring docket does, not because a certificate decision is
// still pending. Excluded at the search-result stage, before ever fetching
// its filing history — it was never a project "waiting for a yes" to begin
// with, so status-checking it would be answering the wrong question.
const COMPLIANCE_DOCKET_RE = /^COMPLIANCE DOCKET\b/i;

// A "service area exception" CCN filing is a territorial/franchise dispute
// over which utility has the right to serve a given area — an
// administrative boundary question, not a physical generation or
// transmission project waiting on a siting decision. Confirmed 2026-08-23:
// 28 of a 95-project test batch (~30%) were this pattern, none of them a
// real "project," all correctly inferring no fuel type or capacity because
// there's no facility to have either. Excluded at the search-result stage,
// same reasoning as COMPLIANCE_DOCKET_RE above.
const SERVICE_AREA_EXCEPTION_RE = /SERVICE AREA EXCEPTION/i;

// See module header STATUS section for how this was calibrated. The bare
// "ORDER" case (description with no elaboration at all) was added after a
// real miss: Control 52485's actual final order — filed by PUC OPDM right
// after the SOAH Proposal For Decision + Exceptions sequence in 2022 — was
// filed under the literal description "ORDER", nothing more, and the
// docket only looked "recent" because of unrelated 2026 filings. Deliberately
// narrow (must be the *entire* trimmed description, not just contain the
// word) so it doesn't swallow "ORDER NO. 5" or "ORDER GRANTING X" — those
// stay correctly classified as interim, not closing.
const CLOSING_SIGNAL_RE =
  /\bFINAL ORDER\b|\bORDER ON REHEARING\b|\bORDER GRANTING\b[^]*\bCERTIFICATE\b|\bORDER APPROVING\b[^]*\bCERTIFICATE\b|\bORDER DENYING\b|\bORDER DISMISSING\b|\bNOTICE OF WITHDRAWAL\b/i;
const BARE_ORDER_RE = /^ORDER$/i;

function isResolved(filings: DocketFiling[]): boolean {
  return filings.some((f) => CLOSING_SIGNAL_RE.test(f.description) || BARE_ORDER_RE.test(f.description.trim()));
}

const APPLICATION_RE = /^(JOINT )?APPLICATION OF/i;

function parseUsDate(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

// The chronologically-first filing isn't always the real application — see
// module header (Control 57501's item 1 was "VOID SEE ITEM 3"). Prefers
// the earliest filing whose description is the actual application
// document; falls back to the earliest filing overall if none matches.
function findFiledDate(filings: DocketFiling[]): Date | null {
  const sorted = [...filings].sort((a, b) => a.itemNumber - b.itemNumber);
  const application = sorted.find((f) => APPLICATION_RE.test(f.description));
  const target = application ?? sorted[0];
  return target ? parseUsDate(target.fileStamp) : null;
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(battery|storage|bess)\b/i, "storage"],
  [/\b(natural gas|combined cycle|combustion turbine|gas plant)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Broader than "transmission line" alone — real captions say "TRANSMISSION
// TAP LINE", "TRANSMISSION INTERCONNECTION LINE", etc. Confirmed 2026-08-23:
// an exact-phrase match missed Control 56599 ("...DORADO SOLAR 345-KV
// TRANSMISSION TAP LINE..."), which also then fell through to matching
// "solar" as the fuel type — but "Dorado Solar" there is the *name of the
// station the line runs to*, not the line's own technology. Checked first,
// before any fuel keyword, for exactly that reason: a transmission
// project's route/endpoint names shouldn't be misread as its fuel.
const TRANSMISSION_LINE_RE = /\btransmission\b[\s\S]{0,25}\bline\b/i;

function inferProjectType(description: string): "generation" | "storage" | "transmission" {
  if (TRANSMISSION_LINE_RE.test(description)) return "transmission";
  if (/\b(battery|storage|bess)\b/i.test(description) && !/\bsolar\b|\bwind\b|\bgas\b/i.test(description)) {
    return "storage";
  }
  return "generation";
}

function inferFuelType(description: string, projectType: "generation" | "storage" | "transmission"): FuelType {
  // Matches the site's own taxonomy (see src/lib/data/taxonomies.ts) — a
  // transmission line genuinely has no fuel, "transmission" is the value
  // other sources use for it too. Decided by projectType, not a second
  // regex pass, so a station name on the route (e.g. "Dorado Solar") can't
  // override it.
  if (projectType === "transmission") return "transmission";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(description)) return fuel;
  }
  return "other";
}

// See lbnlQueuedUp.ts / vaSccDockets.ts for the same pattern — present on
// most but not all real CCN descriptions (e.g. "100 MW SOLAR/100 MW
// BATTERY STORAGE FACILITY" matches the first figure only).
function extractCapacityMw(description: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW\b/i.exec(description);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// "ORDER" alone over-matches routine per-intervenor boilerplate like
// "OPUC'S PROTECTIVE ORDER CERTIFICATIONS" (every intervenor files one,
// confirmed 2026-08-23 against Control 57501 where this pattern alone was
// ~15 of 36 ORDER-matching filings) — excluded explicitly since it's noise,
// not a real procedural milestone, rather than tightening the main filter
// in a way that might drop genuine orders phrased differently.
const MILESTONE_NOISE_RE = /PROTECTIVE ORDER CERTIFICATION/i;

function buildMilestones(filings: DocketFiling[]): NormalizedMilestone[] {
  const milestones: NormalizedMilestone[] = [];
  for (const f of filings) {
    if (!/\bORDER\b/i.test(f.description)) continue;
    if (MILESTONE_NOISE_RE.test(f.description)) continue;
    const date = parseUsDate(f.fileStamp);
    if (!date) continue;
    milestones.push({ date, dateConfidence: "exact", stage: f.itemType.trim() || "Order", description: f.description });
  }
  return milestones;
}

function normalizeDocket(search: DocketSearchResult, filings: DocketFiling[]): NormalizedProject {
  const matchKey = resolveMatchKey("tx-puct", String(search.controlNumber));
  const resolved = isResolved(filings);
  const currentStage: ProjectStage = resolved ? "completed" : "local_review";
  const filedDate = findFiledDate(filings);
  const capacityMw = extractCapacityMw(search.description);
  const projectType = inferProjectType(search.description);
  const fuelType = inferFuelType(search.description, projectType);
  const milestones = buildMilestones(filings);
  const latestFiling = [...filings].sort((a, b) => b.itemNumber - a.itemNumber)[0];

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Texas Public Utility Commission's public Interchange docket search.",
    'PUCT publishes no docket-level status field; "still waiting" here is inferred from the filing history (no final order, order on rehearing, or similar closing filing found) — see the ingestion module header for how this was calibrated and its known limits.',
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the case-style description text, not a structured field — not independently verified.");
  }
  dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");

  return {
    matchKey,
    name: `${search.utility.trim()} (TX PUCT Docket ${search.controlNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "TX",
    county: null,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `Texas PUCT docket ${search.controlNumber}: ${resolved ? "resolved" : "active"}${
      latestFiling ? ` (most recent filing: ${latestFiling.description.slice(0, 80)}, ${latestFiling.fileStamp})` : ""
    }`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Convenience and Necessity from the Texas Public Utility Commission — Docket No. ${search.controlNumber}, "${search.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `Texas PUCT Docket No. ${search.controlNumber}`,
        url: `${BASE_URL}/search/filings/?ControlNumber=${search.controlNumber}&UtilityType=E`,
      },
    ],
    milestones,
    externalIds: { txPuct: String(search.controlNumber) },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  upserted: number;
  removedResolved: number;
  skippedBookFile: number;
  skippedComplianceDocket: number;
  skippedServiceAreaException: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestTxPuctDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const candidates = (await searchCandidates()).slice(0, maxCandidates);

  let skippedBookFile = 0;
  let skippedComplianceDocket = 0;
  let skippedServiceAreaException = 0;
  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      if (BOOK_FILE_RE.test(candidate.description)) {
        skippedBookFile += 1;
        continue;
      }
      if (COMPLIANCE_DOCKET_RE.test(candidate.description)) {
        skippedComplianceDocket += 1;
        continue;
      }
      if (SERVICE_AREA_EXCEPTION_RE.test(candidate.description)) {
        skippedServiceAreaException += 1;
        continue;
      }
      const filings = await fetchFilingsForDocket(candidate.controlNumber);
      toUpsert.push(normalizeDocket(candidate, filings));
    } catch (err) {
      errors.push({ matchKey: String(candidate.controlNumber), message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: candidates.length,
    upserted,
    removedResolved,
    skippedBookFile,
    skippedComplianceDocket,
    skippedServiceAreaException,
    errors,
  };
}

if (require.main === module) {
  ingestTxPuctDockets()
    .then((summary) => {
      console.log(
        `Texas PUCT docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ` +
          `skipped ${summary.skippedBookFile} legacy book-file records, ` +
          `${summary.skippedComplianceDocket} compliance dockets, ` +
          `${summary.skippedServiceAreaException} service-area-exception filings, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
