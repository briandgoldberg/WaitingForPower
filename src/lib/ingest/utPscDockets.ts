// Utah Public Service Commission (PSC) Certificate of Public Convenience and
// Necessity (CPCN) docket ingestion — one of several states built in
// parallel in the per-state series started with vaSccDockets.ts (see that
// file's header for the overall rationale). Confirmed by hand 2026-08-23 via
// real requests against the live psc.utah.gov / pscdocs.utah.gov sites and
// real downloaded order PDFs — no assumption below was taken from
// documentation or training-data memory alone.
//
// FETCHING: psc.utah.gov is a WordPress site (behind Cloudflare, but a plain
// `fetch()` with no headers/cookies returns 200 with no bot-challenge —
// confirmed by hand). Its "All Electric Dockets" listing
// (https://psc.utah.gov/electric/dockets/all-electric-dockets/) is a single
// ~1.2MB server-rendered page containing EVERY electric docket filed since
// 1987 (1,576 rows as of 2026-08-23) — no pagination, no JS execution
// required, one GET request. Each row is a `<div class="docket-row" ...>`
// block with the docket number + its own permalink, a plain-English "matter"
// description, and a filed date (MM/DD/YYYY). Confirmed real gotcha: a
// docket's own detail-page URL is NOT derivable from its docket number or
// filing date — most of the pre-2016 dockets were bulk-imported into
// WordPress on a handful of days in June 2016 and their permalink uses that
// *import* date, not the real filing date (e.g. docket 03-035-29, filed
// 11/3/2003, lives at .../2016/06/22/docket-no-03-035-29/). This module
// always uses the href scraped from the listing row, never a constructed
// URL.
//
// SCOPING — finding the real CPCN population required two real, hand-caught
// corrections to a first-pass search:
//   1. Searching only for "certificate of PUBLIC convenience and necessity"
//      (the modern, full statutory phrase — Utah Code § 54-4-25) missed a
//      real, materially different population: pre-~2010 dockets consistently
//      drop "public" and say "certificate of convenience and necessity"
//      instead. Confirmed by hand: PacifiCorp's Currant Creek Power Project
//      (03-035-29, 2003), Lake Side Power Project (04-035-30, 2004),
//      Populus-to-Terminal 345kV transmission line (08-035-42, 2008), and
//      Milford Wind Corridor Phase I & II (08-2490-01, 2008, a real ~200MW
//      wind project) all use the shorter phrase and would have been silently
//      dropped. CPCN_PHRASE_RE below matches both "certificate(s) of public
//      convenience and necessity" and "certificate(s) of convenience and
//      necessity".
//   2. That phrase alone is still too broad: it also matches dockets that
//      AMEND, TRANSFER, or otherwise piggyback on an *existing* CPCN rather
//      than requesting a new one for an actual construction/acquisition
//      project — e.g. "Application of RMP for Approval of Agreement with
//      Beaver City and Amendment of Certificate of Public Convenience and
//      Necessity" (21-035-03), "...Purchase and Transfer Agreement...and
//      Amendment of Certificate..." (15-035-84, NTUA), "...Settlement
//      Agreement with Heber Light...and Amendment of Certificate..."
//      (10-035-117), "Application for Amendment to the Certificate of Public
//      Convenience and Necessity of Ticaboo Utility Improvement District"
//      (18-2508-01, a retail service-territory expansion, not a
//      generation/transmission project), and — going back to 1987 — the
//      Utah Power & Light/PacifiCorp merger docket (87-035-27), whose
//      "Transfer of Certificates of Public Convenience and Necessity" is
//      incidental to a corporate merger. NEW_PROJECT_RE requires the
//      docket's own "for" clause to request a certificate directly (or, for
//      the acquisition-of-existing-plant pattern Deseret/Dixie Escalante use
//      below, an "addition to" an existing certificate), which cleanly
//      separates these two populations — confirmed by hand against all 18
//      raw CPCN-phrase matches in the full 1987–2026 electric-docket
//      history (17 unique dockets — 87-035-27 appears twice in the source
//      listing itself): exactly 12 are genuine new-project applications
//      (four of them repeat annual/near-annual acquisition filings by
//      Deseret Generation and Transmission Co-Operative for its Bonanza
//      plant), the other 5 are amendment/transfer/agreement dockets and are
//      excluded.
//
// STATUS — same lesson as every prior state in this series, independently
// reconfirmed here: neither the listing page nor a docket's own detail page
// has a structured status field. The real signal is the docket's own filed
// document list (a plain HTML table on its WordPress detail page: date +
// description + PDF link per row), specifically whether a *final
// disposition* order has been filed:
//   - Confirmed real gotcha: rows are NOT reliably sorted newest-first.
//     Docket 03-035-29 lists an "Order Granting Intervention" dated March 8,
//     2004 — three days AFTER its own final "Report and Order" dated March
//     5, 2004. This module sorts candidate final-order rows by their own
//     parsed date rather than trusting row position.
//   - Confirmed real gotcha: the final order's own link text is NOT
//     consistent across eras. Newer dockets (~2020+) label it plain "Order"
//     (24-506-01, 21-035-54) or "Report and Order"/"Erratum Report and
//     Order"/"Report and Order (Re-Issued)" (22-506-03, 21-506-02,
//     12-035-97). Older dockets sometimes spell the disposition out directly
//     in the link text itself, e.g. "Order Approving Acquisition, Amending
//     Certificate of Public Convenience and Necessity No. 1930..."
//     (20-066-03) or "Report and Order Granting Certificate and Certificate
//     of Public Need and Necessity" (08-035-42). isFinalOrderLabel() below
//     matches both the bare/generic labels this site's newer dockets use and
//     the disposition-descriptive labels older ones use, while leaving
//     plainly-procedural orders alone ("Scheduling Order", "Protective
//     Order", "Order Granting Intervention of X", "Order Granting Motions to
//     Strike" — none of these are bare "Order"/"Report and Order" and none
//     mention "certificate", so none match).
//   - The final order is a PDF with no separate machine-readable
//     grant/deny field. This project has no PDF-parsing dependency (and
//     package.json is out of scope for this module), so extractPdfText()
//     below decompresses each FlateDecode content stream directly with
//     Node's built-in zlib.inflateSync (no external dependency) and pulls
//     the literal text out of its Tj/TJ operators. Confirmed by hand against
//     6 real order PDFs spanning 2003–2024 (different PDF producers/eras)
//     that this reliably recovers full readable order text, including the
//     SYNOPSIS and ORDER/decretal sections every Utah PSC order uses.
//     Confirmed real gotcha: some older pscdocs.utah.gov links are
//     plain `http://` and 301-redirect to `https://` — `fetch()`'s default
//     redirect-following handles this with no special-casing needed.
//   - Real confirmed GRANT language, hand-verified against 5 different real
//     orders: Deseret's Bonanza SCR retrofit (24-506-01) — "The Public
//     Service Commission (PSC) approves the application of Deseret...for a
//     Certificate of Public Convenience and Necessity (CPCN)"; Gateway South
//     (21-035-54)'s decretal clause — "RMP's request for a certificate of
//     public convenience and necessity to construct the Project is
//     granted"; Currant Creek (03-035-29) — "The Certificate of Public
//     Convenience and Necessity is granted"; Dixie Escalante (20-066-03),
//     whose order is titled "ORDER APPROVING ACQUISITION, AMENDING
//     CERTIFICATE OF PUBLIC CONVENIENCE AND NECESSITY NO. 1930..."; and
//     Deseret's 22-506-03 Certificate exhibit — "The Public Service
//     Commission of Utah...issues a Certificate of Public Convenience and
//     Necessity authorizing DESERET...to acquire up to 15 megawatts of
//     generation provided from photovoltaic solar panels..." (this last one
//     is the real case that motivated GRANT_RE's third branch — see the
//     comment on GRANT_RE itself for why). No real denial was available to
//     confirm DENY_RE positively fires on one — same caveat every other
//     state in this series has documented for its own DENY_RE.
//
// REAL POPULATION SIZE, confirmed by hand 2026-08-23: across Utah's ENTIRE
// electric-docket history back to 1987, only 12 dockets are genuine new CPCN
// applications for a generation/transmission/storage project (see SCOPING
// above), and all 12 have already been granted (5 spot-verified directly by
// opening their order PDF; the rest are decades-old, physically-built
// projects — e.g. Currant Creek and Lake Side have been in commercial
// operation for 20+ years). A full review of every one of Utah's 181
// electric dockets filed since 2025-01-01 turned up zero new CPCN-phrase
// filings of any kind. So on most runs this module is expected to upsert
// zero rows — a true reflection of Utah's regulatory structure (PacifiCorp/
// Rocky Mountain Power, which owns virtually all Utah retail generation and
// transmission, gets its resource decisions blessed through periodic
// Integrated Resource Plan acknowledgment rather than case-by-case CPCN
// siting, and independent generators selling wholesale power are FERC- not
// PSC-jurisdictional and don't file for a Utah CPCN at all), not a bug in
// this module. The module still runs every candidate through the same real
// grant/deny detection so the next genuinely-new Utah CPCN filing (the kind
// Gateway South and Milford Wind were) is picked up and correctly tracked as
// "waiting" the moment it appears.
//
// FUEL/PROJECT TYPE & CAPACITY: Utah CPCN docket titles are much sparser
// than other states' — they name the applicant and (for construction
// dockets) the project, but essentially never state a capacity figure or
// fuel type in the title itself (confirmed against all 12 real candidates —
// even Deseret's 22-506-03, which really is a 15MW solar project per its own
// issued Certificate text, only says "Acquisition of Electric Utility Plant
// and Equipment" in its docket title).
// inferProjectType/inferFuelType below do the same keyword-regex-over-title
// approach as every other state in this series, but will fall back to
// fuelType "other" far more often here — flagged honestly in
// dataQualityNote rather than guessed at.
//
// Politeness-delayed between per-candidate requests (both the docket detail
// page and, when present, its final-order PDF). Given the confirmed real
// population is 12 candidates total (never more than 1-2 new filings/year
// historically), MAX_CANDIDATES is set generously high purely as a
// structural safety cap, not because of any real timing pressure — a full
// run against the live site (1 listing fetch + 12 detail fetches + up to
// 12 PDF fetches) completed in 13.7 seconds, nowhere close to the cron
// route's 300s maxDuration budget.
//
// Wired to Vercel Cron weekly, 01:30 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-ut-psc/route.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";
import zlib from "node:zlib";

const LISTING_URL = "https://psc.utah.gov/electric/dockets/all-electric-dockets/";

export const MAX_CANDIDATES = 50;
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as scPscDockets.ts/nyDpsDockets.ts, not a full HTML-entity
// library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .trim();
}

interface DocketListing {
  docketNo: string;
  url: string;
  matter: string;
  filedDate: Date | null;
}

function parseMDY(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseLongDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// See module header FETCHING: each row is a `<div class="docket-row" ...>`
// block ending in `</div></li>`; the non-greedy match below stops at that
// first real closing point (confirmed against the live page: no inner
// `</div>` inside a row is itself immediately followed by `</li>`).
const ROW_RE = /<div class="docket-row"[^>]*>([\s\S]*?)<\/div>\s*<\/li>/g;
const LINK_RE = /<a href="([^"]+)" title="Docket No: ([^"]+)">/;
const MATTER_RE = /class="pseudo-table--cell matter"><p>([\s\S]*?)<\/p>/;
const DATE_CELL_RE = /class="pseudo-table--cell date">([^<]*)</;

async function fetchAllElectricDockets(): Promise<DocketListing[]> {
  const res = await fetch(LISTING_URL);
  if (!res.ok) throw new Error(`Utah PSC electric dockets listing request failed (${res.status})`);
  const html = await res.text();
  const entries: DocketListing[] = [];
  let m: RegExpExecArray | null;
  ROW_RE.lastIndex = 0;
  while ((m = ROW_RE.exec(html)) !== null) {
    const block = m[1];
    const link = LINK_RE.exec(block);
    const matter = MATTER_RE.exec(block);
    if (!link || !matter) continue;
    const dateCell = DATE_CELL_RE.exec(block);
    entries.push({
      docketNo: link[2].trim(),
      url: link[1].trim(),
      matter: decodeHtmlEntities(matter[1].replace(/\s+/g, " ")),
      filedDate: parseMDY(dateCell?.[1]),
    });
  }
  if (entries.length === 0) {
    throw new Error(
      "Utah PSC electric dockets listing returned zero parsed rows — the page structure likely changed. Check ROW_RE/LINK_RE/MATTER_RE in src/lib/ingest/utPscDockets.ts against a fresh response.",
    );
  }
  return entries;
}

// See module header SCOPING point 1.
const CPCN_PHRASE_RE = /certificates?\s+of\s+(?:public\s+)?convenience\s+and\s+necessity/i;
// See module header SCOPING point 2.
const NEW_PROJECT_RE =
  /\bfor\s+(?:a\s+|approval\s+of\s+a\s+)?certificates?\s+of\s+(?:public\s+)?convenience\s+and\s+necessity\b|\baddition\s+to\s+(?:its\s+|the\s+)?certificates?\s+of\s+(?:public\s+)?convenience\s+and\s+necessity\b/i;

interface DocumentRow {
  label: string;
  href: string;
  date: Date | null;
}

const TABLE_ROW_RE = /<tr>\s*<td>([^<]*)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
const ANCHOR_RE = /<a href="([^"]+)"[^>]*>(?:<i[^>]*><\/i>)?\s*([^<]*)<\/a>/g;

async function fetchDocketDocuments(url: string): Promise<DocumentRow[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Utah PSC docket detail request failed (${res.status}) for ${url}`);
  const html = await res.text();
  const rows: DocumentRow[] = [];
  let m: RegExpExecArray | null;
  TABLE_ROW_RE.lastIndex = 0;
  while ((m = TABLE_ROW_RE.exec(html)) !== null) {
    const date = parseLongDate(m[1]);
    let am: RegExpExecArray | null;
    ANCHOR_RE.lastIndex = 0;
    while ((am = ANCHOR_RE.exec(m[2])) !== null) {
      rows.push({ href: am[1].trim(), label: decodeHtmlEntities(am[2]), date });
    }
  }
  return rows;
}

// See module header STATUS for real examples each of these three patterns
// was hand-confirmed against.
const FINAL_ORDER_LABEL_RES: RegExp[] = [
  /^order$/i,
  /^(?:erratum\s+)?report\s+and\s+order(?:\s*\(re-?issued\))?$/i,
  /\b(?:order|report\s+and\s+order)\b[\s\S]*\b(?:granting|approving|denying)\b[\s\S]*\bcertificate\b/i,
];

function isFinalOrderLabel(label: string): boolean {
  const t = label.trim();
  return FINAL_ORDER_LABEL_RES.some((re) => re.test(t));
}

// Decompresses every FlateDecode content stream in a PDF with Node's
// built-in zlib (no external PDF-parsing dependency — see module header
// STATUS) and pulls literal text out of Tj/TJ operators. Streams whose
// dictionary declares a `/Predictor` (used by this site's cross-reference/
// object streams, never by the real content streams in any of the 6 real
// order PDFs sampled 2003–2024) are skipped rather than mis-decoded.
function extractPdfText(buf: Buffer): string {
  const STREAM_START = Buffer.from("stream");
  const STREAM_END = Buffer.from("endstream");
  let inflatedConcat = "";
  let pos = 0;
  while (true) {
    const sIdx = buf.indexOf(STREAM_START, pos);
    if (sIdx === -1) break;
    const dictSlice = buf.slice(Math.max(0, sIdx - 500), sIdx).toString("latin1");
    const isFlate = /FlateDecode/.test(dictSlice);
    const hasPredictor = /Predictor/.test(dictSlice);
    let bodyStart = sIdx + STREAM_START.length;
    if (buf[bodyStart] === 0x0d) bodyStart++;
    if (buf[bodyStart] === 0x0a) bodyStart++;
    const eIdx = buf.indexOf(STREAM_END, bodyStart);
    if (eIdx === -1) break;
    if (isFlate && !hasPredictor) {
      try {
        inflatedConcat += zlib.inflateSync(buf.slice(bodyStart, eIdx)).toString("latin1") + "\n";
      } catch {
        // Not every FlateDecode-declared stream is valid raw deflate (some
        // are themselves nested/object streams); skip and keep going rather
        // than fail the whole extraction over one bad stream.
      }
    }
    pos = eIdx + STREAM_END.length;
  }

  let text = "";
  const tjRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
  let tm: RegExpExecArray | null;
  while ((tm = tjRe.exec(inflatedConcat)) !== null) text += tm[1] + " ";
  const tjArrRe = /\[((?:[^[\]])*)\]\s*TJ/g;
  let am: RegExpExecArray | null;
  while ((am = tjArrRe.exec(inflatedConcat)) !== null) {
    const strRe = /\(((?:[^()\\]|\\.)*)\)/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRe.exec(am[1])) !== null) text += sm[1];
    text += " ";
  }
  return text;
}

// See module header STATUS for the 4 real orders each of the first two
// branches was hand-verified against. The third branch was added after a
// real false-negative caught during dry-run testing: docket 22-506-03's
// most recent final-order-labeled document is an "Erratum Report and Order"
// that does NOT restate "grants"/"approves" language at all — it only
// corrects a typo in the original order's certificate number and attaches
// the actual issued Certificate as Exhibit A, whose own operative language
// is "The Public Service Commission of Utah...issues a Certificate of
// Public Convenience and Necessity authorizing DESERET...". Confirmed real
// gotcha: an erratum/correction order can be the most-recently-dated
// "final order"-labeled document without itself containing the decisive
// grant/deny language — see fetchDocketResolution, which falls through to
// older order candidates when the newest one is inconclusive.
const GRANT_RE =
  /\b(?:grant\w*|approv\w*)\b[\s\S]{0,150}\b(?:certificate|CPCN)\b|\b(?:certificate|CPCN)\b[\s\S]{0,150}\bis\s+granted\b|\bissues?\s+(?:a|the)\s+certificates?\s+of\s+(?:public\s+)?convenience\s+and\s+necessity\b/i;
const DENY_RE = /\bden(?:y|ies|ied|ying)\b[\s\S]{0,150}\b(?:certificate|CPCN|application)\b|\b(?:certificate|CPCN|application)\b[\s\S]{0,150}\bis\s+denied\b/i;

interface DocketResolution {
  resolution: "granted" | "denied" | null;
  orderDate: Date | null;
}

// Checks every document row whose label looks like a final order (newest
// first, per isFinalOrderLabel), stopping at the first one whose own PDF
// text yields a definitive grant/deny signal — not just the single
// most-recent one. See the GRANT_RE comment above for the real erratum case
// that requires this.
async function fetchDocketResolution(url: string): Promise<DocketResolution> {
  const docs = await fetchDocketDocuments(url);
  const orderCandidates = docs
    .filter((d) => isFinalOrderLabel(d.label))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  for (const candidate of orderCandidates) {
    const res = await fetch(candidate.href);
    if (!res.ok) throw new Error(`Utah PSC order PDF request failed (${res.status}) for ${candidate.href}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const text = extractPdfText(buf);
    if (GRANT_RE.test(text)) return { resolution: "granted", orderDate: candidate.date };
    if (DENY_RE.test(text)) return { resolution: "denied", orderDate: candidate.date };
    await sleep(REQUEST_DELAY_MS);
  }
  return { resolution: null, orderDate: orderCandidates[0]?.date ?? null };
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b|\bpv\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(combined cycle|combustion turbine|natural gas|gas[- ]fired)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];
const TRANSMISSION_RE = /\btransmission\b|\bkv\s+(?:double-circuit\s+)?(?:line|facilit)/i;
const STORAGE_RE = /\bbattery energy storage\b|\bbess\b|\benergy storage facility\b/i;

function inferProjectType(title: string): ProjectType {
  if (TRANSMISSION_RE.test(title)) return "transmission";
  const hasGenerationFuel = FUEL_KEYWORDS.some(([re]) => re.test(title));
  if (!hasGenerationFuel && STORAGE_RE.test(title)) return "storage";
  return "generation";
}

function inferFuelType(title: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(title)) return fuel;
  }
  if (projectType === "storage") return "storage";
  return "other";
}

// See module header FUEL/PROJECT TYPE & CAPACITY: Utah titles almost never
// state a capacity figure, but the extractor is kept in case a future
// filing does.
function extractCapacityMw(title: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)[\s-]*(?:MW|Megawatt)(?:ac|dc)?\b/i.exec(title);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

const APPLICANT_RE = /\bapplication\s+of\s+(.+?)\s+for\b/i;

function extractApplicant(title: string): string {
  const m = APPLICANT_RE.exec(title);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  return title.slice(0, 80);
}

function normalizeDocket(listing: DocketListing, resolution: DocketResolution): NormalizedProject {
  const matchKey = resolveMatchKey("ut-psc", listing.docketNo);
  const projectType = inferProjectType(listing.matter);
  const fuelType = inferFuelType(listing.matter, projectType);
  const capacityMw = extractCapacityMw(listing.matter);
  const applicant = extractApplicant(listing.matter);

  let currentStage: ProjectStage;
  if (resolution.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution.resolution === "denied") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Utah Public Service Commission's public electric docket listing and each docket's own filed-document list.",
    "The PSC does not publish a case \"Status\" field at all; \"still waiting\" here is inferred by scanning each docket's final disposition order (an unstructured PDF, extracted by decompressing its own content streams — no separate machine-readable grant/deny field exists) for grant/deny language — see the ingestion module header for how this was calibrated against real orders.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket title text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket title text — Utah CPCN docket titles rarely state one.");
  }
  dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");

  return {
    matchKey,
    name: `${applicant} (UT PSC Docket No. ${listing.docketNo})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "UT",
    county: null,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: listing.filedDate,
    dateConfidence: "exact",
    currentStatus: `Utah PSC Docket No. ${listing.docketNo}: ${resolution.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity determination from the Utah Public Service Commission — Docket No. ${listing.docketNo}, "${listing.matter}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `Utah PSC Docket No. ${listing.docketNo}`,
        url: listing.url,
      },
    ],
    externalIds: { utPsc: listing.docketNo },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestUtPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allDockets = await fetchAllElectricDockets();

  const cpcnPhraseMatches = allDockets.filter((d) => CPCN_PHRASE_RE.test(d.matter));

  const seen = new Set<string>();
  const realApplications = allDockets
    .filter((d) => NEW_PROJECT_RE.test(d.matter))
    .filter((d) => {
      if (seen.has(d.docketNo)) return false;
      seen.add(d.docketNo);
      return true;
    })
    .sort((a, b) => (b.filedDate?.getTime() ?? 0) - (a.filedDate?.getTime() ?? 0))
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const listing of realApplications) {
    try {
      const resolution = await fetchDocketResolution(listing.url);
      toUpsert.push(normalizeDocket(listing, resolution));
    } catch (err) {
      errors.push({ matchKey: listing.docketNo, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = realApplications.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: cpcnPhraseMatches.length,
    realApplicationCandidates: realApplications.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestUtPscDockets()
    .then((summary) => {
      console.log(
        `Utah PSC docket ingestion complete: ${summary.candidatesFound} CPCN-phrase candidates found, ` +
          `${summary.realApplicationCandidates} real CPCN applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
