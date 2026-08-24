// Idaho Public Utilities Commission (IPUC) Certificate of Public Convenience
// and Necessity (CPCN, Idaho Code §61-528) docket ingestion — one of several
// states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-24 via real GET requests against the live
// puc.idaho.gov site — no assumption below was taken from documentation or
// training-data memory alone.
//
// SCOPING: Idaho requires a CPCN before an electric utility can construct a
// major new generating plant or transmission line (Idaho Code §61-528, "no
// public utility shall begin construction of ... any new plant or system for
// furnishing electricity ... without first obtaining ... a certificate that
// the present or future public convenience and necessity requires or will
// require such construction"). Confirmed live by hand-reading IPUC's own
// "IPUC Open Electric Cases" list (39 real open dockets as of 2026-08-24):
// exactly 4 real, currently-open CPCN applications exist — AVU-E-26-10
// (Avista, "CERTIFICATE OF PUBLIC CONVENIENCE AND NECESSITY TO CONSTRUCT THE
// CARLIN BAY TRANSMISSION LINE"), IPC-E-26-04 (Idaho Power, "CERTIFICATES OF
// PUBLIC CONVENIENCE AND NECESSITY FOR THE SOUTH HILLS AND PEREGRINE POWER
// PLANTS"), IPC-E-26-09 and PAC-E-26-06 (Idaho Power and PacifiCorp — see
// below, two joint owners each filing their own CPCN case for the same
// physical line, "CERTIFICATES OF PUBLIC CONVENIENCE AND NECESSITY FOR
// SEGMENT E-8 OF THE GATEWAY WEST 500-kV TRANSMISSION LINE"). Every other
// open electric docket (wildfire mitigation plans, rate cases, PCA/FCA
// filings, accounting orders, tariff/PPA approvals, FERC-related notices,
// formal complaints) is a real docket type but not a construction gate for a
// named project — same "not rate cases, not general rulemakings" exclusion
// this series applies everywhere. A real near-miss confirmed by hand: IPC-E-
// 26-20 ("APPLICATION FOR APPROVAL OF A POWER PURCHASE AGREEMENT AND AN
// ENERGY STORAGE SYSTEM TOLLING AGREEMENT WITH BLUEBIRD SOLAR PROJECT LLC")
// is IPC seeking approval of a PPA/tolling contract with a third-party
// merchant solar+storage developer, not IPC (or Bluebird) seeking a CPCN —
// correctly excluded since its description never uses the word
// "certificate" at all.
//
// FETCHING: puc.idaho.gov is a plain server-rendered ASP.NET-ish "IPUC" CMS
// (no client framework — Cases.js/PSFGrid.js, confirmed by hand by fetching
// it directly, does nothing but a plain HTML form GET submit; there is no
// JSON API). No auth, no CAPTCHA, no session requirement: repeated bare,
// cookie-less GETs against /case succeed every time with identical real data
// (the site does issue Set-Cookie headers, including an F5/Imperva-style
// "TS..." WAF cookie, on every response, but confirmed by hand it's never
// required to be echoed back — same "issued but never required" pattern
// wvPscDockets.ts documents). Two request types:
//   1. `GET /case?util=1&closed=0&ps=500` — IPUC's own "Open Electric Cases"
//      list (util=1 confirmed live to mean Electric, via the site's own
//      Electric-utility page linking here; Telecom/Water/Natural
//      Gas/Rail/Pipeline Safety use different util values and are out of
//      scope for this module by construction, since util is fixed at "1").
//      Confirmed live: `ps` (page size) can be set directly in the query
//      string up to at least 500 and the site returns every result on one
//      page rather than requiring pagination (confirmed: ps=1000 against the
//      real 39-row open-case population returned all 39 rows with a single
//      request) — simpler than wvPscDockets.ts's defensive page-looping, and
//      confirmed defensively here too: parseOpenCaseList throws if the
//      page's own "Results: N" count doesn't match the number of rows
//      actually parsed, rather than silently truncating if the real
//      population ever exceeds MAX_LIST_PAGE_SIZE. Each row on this list
//      gives CaseNo (linking to /case/Details/{id}), Company, and the case's
//      full free-text Description — but NOT Date Filed or Status, which live
//      only on the per-case detail page (see below), so unlike
//      mdPscDockets.ts's single-list-page-is-enough situation, a second
//      per-candidate request is still needed here.
//   2. `GET /case/Details/{id}` — the case's own "Case Summary" page.
//      Confirmed live: a genuinely structured Date Filed (MM/DD/YYYY) and a
//      genuinely structured Status field (real observed values: "Notice
//      Received", "Reconsideration", "Closed" — see STATUS below), plus a
//      "Case Files"/"Orders & Notices"/company-filing document list (not
//      parsed here — this module doesn't need order-text disposition
//      detail, see STATUS).
//
// STATUS: Idaho is the first state in this series (per this project's own
// prior-state notes on Maryland/Connecticut/West Virginia) to publish a
// genuinely structured per-case Status field rather than none at all — but
// it turned out NOT to need order-document text parsing the way WV/MD/CT do,
// for a real structural reason specific to this project, not a shortcut:
// IPUC's own case-search already partitions every case into `closed=0`
// (open) vs `closed=1` (closed) at the URL level, confirmed live to be the
// authoritative "still waiting" signal (every one of the 4 real open CPCN
// candidates' own Orders & Notices document lists, hand-checked, has no
// FINAL_ORDER-named document yet, i.e. no evidence the closed=0 list is
// stale the way ctCscDockets.ts's Pending Matters page was proven to be).
// Because common.ts's RESOLVED_STAGES logic deletes a project on EITHER
// "approved_awaiting_construction" OR "cancelled" identically (see
// common.ts's upsertNormalizedProject — both branch to the same delete path
// before any other field is read), this project's site behavior literally
// cannot distinguish "IPUC granted the CPCN" from "IPUC denied/dismissed the
// application" once a case closes — either way the project stops being
// displayed as "still waiting." That makes parsing WV/MD/CT-style dispositive
// order text unnecessary complexity for zero behavioral difference here:
// this module maps a genuinely-open candidate to "local_review", and
// (defense in depth, see below) any candidate whose OWN detail page
// unexpectedly already reads Status="Closed" despite appearing in the
// closed=0 list to "cancelled" generically, same as ctCscDockets.ts's and
// wvPscDockets.ts's "closed-unclear"/generic-cancelled bucket for resolutions
// this module doesn't itself distinguish further.
//   Real calibration data behind CONTENT_RE (see FUEL/PROJECT TYPE below)
// deliberately used the bare word "certificate" rather than the fuller
// phrase "certificate of public convenience" for exactly this kind of
// caption-phrasing risk, confirmed necessary by hand: a full-history scan of
// every CLOSED Idaho electric case whose Description contains "certificate"
// (7 real cases total, back to 1990 — case IDs go back that far, confirmed
// via case 5177/IPC-E-90-08) turned up two real older captions that never
// spell out "public convenience" at all — IPC-E-09-26, "IDAHO POWER --
// CERTIFICATE -- COLUMBIA SUBSTATION, COLUMBIA TO KUNA LINE, RECONSTRUCT
// OTHER LINE ETC" (a real 2009 CPCN application phrased as a terse dash-list,
// no "public convenience" anywhere), and IPC-E-90-08, "APPL FOR CERTIFICATE
// MILNER PROJECT & DETERMINE RATE BASE" (1990). A CONTENT_RE requiring the
// fuller phrase, calibrated only against 2026's spelled-out captions, would
// have silently gone blind to this real historical phrasing style if IPUC
// ever reverts to it. This broad bare-"certificate" search was also
// confirmed clean of false positives across that entire real 7-case
// history — no securities/insurance/other non-CPCN "certificate" ever
// appears in Idaho's own electric-case Description field — so no additional
// CONSTRUCTION_RE co-requirement (unlike wvPscDockets.ts's CONSTRUCTION_RE)
// was needed to keep it precise.
//   One real, confirmed-necessary exclusion found in that same 7-case scan:
// IPC-E-25-28, "PETITION TO WITHDRAW CERTIFICATE NO. 559, INCLUSIVE OF THE
// BUILD TRANSFER AGREEMENT AND POWER PURCHASE AGREEMENT FOR THE JACKALOPE
// WIND PROJECT APPROVED BY ORDER NO. 36659" — a real petition to unwind an
// ALREADY-GRANTED CPCN (Certificate No. 559, granted in IPC-E-24-46), not a
// new construction application. EXCLUDE_RE filters this pattern out
// (confirmed live: exactly 1 real case ever matches "withdraw ... certificate"
// in Idaho's full electric-case history; "amend certificate", "revoke
// certificate", "transfer certificate", and "cancel certificate" were each
// separately checked live and confirmed to return zero real cases, so are
// not separately guarded against — nothing to calibrate them from).
//
// VANISHED-CANDIDATE FIX: the same real structural bug class this project's
// other modules found (see wvPscDockets.ts's header for the canonical
// writeup) applies here for the identical reason — every run's candidate
// pool is built from IPUC's own `closed=0` (open) case list, so once IPUC
// flips a tracked case's own closed flag to 1, that case simply vanishes
// from every future run's fetch entirely, and this module's own defense-in-
// depth Status check (see STATUS above) never runs on it because it's never
// fetched again. Fixed the same way as wvPscDockets.ts: after building this
// run's full open-case-number set (all real open Electric cases, not just
// the CPCN-scoped subset — mirrors wvPscDockets.ts's own choice to use the
// full pre-content-filter search result set, since a matchKey that was never
// upserted in the first place has no stale row to clean up regardless), any
// "id-puc:" matchKey previously tracked in the DB that isn't in that set is
// pushed through as a minimal resolved stub (buildVanishedStub) with
// currentStage="cancelled" so upsertNormalizedProjects deletes the stale row.
//
// FUEL/PROJECT TYPE & CAPACITY: extracted from the case Description, same
// keyword-over-prose approach as every other module in this series. Idaho's
// real captions are short project-name-style phrases (e.g. "CARLIN BAY
// TRANSMISSION LINE", "SOUTH HILLS AND PEREGRINE POWER PLANTS", "GATEWAY
// WEST 500-kV TRANSMISSION LINE"), not detailed siting captions — confirmed
// by hand across all 4 real open candidates and all 4 real closed CPCN
// candidates (IPC-E-24-45 "TWO BATTERY STORAGE FACILITIES", IPC-E-24-46
// "JACKALOPE WIND PROJECT", IPC-E-25-08 "SOUTHWEST INTERTIE PROJECT - NORTH
// 500-KV TRANSMISSION LINE", IPC-E-25-29 "BENNETT GAS EXPANSION PROJECT")
// that none state a capacity figure in MW at all — CAPACITY_RE is kept
// (matches this series' standard `\d+\s*MW` pattern) but is not exercised by
// any real current candidate; expected to stay usually-null, flagged when it
// is null the way every other module in this series does. "SOUTH HILLS AND
// PEREGRINE POWER PLANTS" (IPC-E-26-04) never states a fuel/technology at
// all — kept as generation/"other" with a dataQualityNote, rather than
// guessed at from outside knowledge, per this project's core rule. Real
// confirmed source typo, not silently fixed: IPC-E-24-46's real closed-case
// caption reads "...WITH JACKALOPE WIND, LLC ANDA CERTIFICATE OF PUBLIC
// CONVENIENCE..." — "ANDA" is evidently "AND A" with the space dropped; not
// a candidate this module currently tracks (it's closed), but confirmed real
// via the live site, kept unmodified in the header for the record the way
// this series treats every found typo.
//
// LOCATION: no county/location extraction is implemented. Confirmed by hand
// across every real CPCN caption found (all 4 open, all 4 closed, plus the
// 2 older terse-phrasing closed cases) that none mentions an Idaho county by
// name at all — Idaho's captions name the project/line instead (e.g.
// "Carlin Bay", "Gateway West", "Milner Project"). Building a whitelist-based
// county extractor (this series' standard fix for the Maryland
// greedy-regex hazard) against zero real calibrating data would be exactly
// the kind of guess this project's core rule prohibits, so it's skipped;
// every project from this source carries the standard
// no-structured-location dataQualityNote instead.
//
// A real, confirmed (not hypothetical) same-project duplicate, left
// unmerged per this project's standing non-dedup policy (see common.ts
// header): IPC-E-26-09 and PAC-E-26-06 are Idaho Power's and PacifiCorp's
// own separate CPCN applications for the identical physical Segment E-8 of
// the jointly-owned Gateway West 500-kV transmission line (confirmed live:
// both real descriptions are word-for-word identical apart from the
// applicant name) — the same "each joint owner files its own certificate
// case" structure wvPscDockets.ts documents for AEP/Wheeling Power. Kept as
// two separate tracked projects (matchKeys id-puc:IPC-E-26-09 and
// id-puc:PAC-E-26-06) rather than silently merged; a human can add a
// manualOverrides.csv row later if this should display as one project.
//
// Wired to Vercel Cron weekly, 07:30 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-id-puc/route.ts). Real full-population timing
// measured 2026-08-24: fetching the full open-case list (39 real rows) plus
// a detail-page fetch for each of the 4 real CPCN candidates, at this
// series' standard 250ms politeness delay, took under 3 seconds —
// comfortably inside the 300s cron budget with enormous headroom.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";
import { prisma } from "@/lib/db";

const BASE_URL = "https://puc.idaho.gov";
// util=1 confirmed live to mean "Electric" (the site's own Electric-utility
// page links to exactly this URL for its "Open Cases"/"Closed Cases" links).
const OPEN_CASES_URL = `${BASE_URL}/case?util=1&closed=0`;
const DETAIL_URL = (caseId: string) => `${BASE_URL}/case/Details/${caseId}`;

// Comfortably above the current real candidate count (4) — see module
// header SCOPING. IPUC's whole open-electric-docket load is small (39 real
// cases as of 2026-08-24), nothing like the hundreds seen in higher-volume
// docket-search states, so there's no realistic scenario of this cap
// silently dropping a genuinely-open CPCN candidate.
export const MAX_CANDIDATES = 50;
const REQUEST_DELAY_MS = 250;
// Confirmed live 2026-08-24: a single `ps=500` request returns the site's
// entire open-electric-case population (39 rows) on one page — see module
// header FETCHING. Set generously above any realistic near-term real
// population; parseOpenCaseList throws rather than silently truncating if
// the real "Results: N" count ever exceeds this.
const LIST_PAGE_SIZE = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Idaho PUC request failed (${res.status}): ${url}`);
  return res.text();
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as every other module in this series, not a full HTML-entity
// library. Real observed entities: &#39;/&#8217; (apostrophes, e.g.
// "CORPORATION'S"), &amp;, &quot;.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&lsquo;|&#8216;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

interface OpenCaseRow {
  caseId: string;
  caseNumber: string;
  company: string;
  description: string;
}

// Matches each real row of IPUC's own open/closed case list table — see
// module header FETCHING. Confirmed live 2026-08-24 against the full real
// 39-row open-case response: `<td><a href="/case/Details/{id}">{caseNo}</a>
// </td><td>{company}</td><td>{description}</td>`, each cell padded with
// stray internal whitespace this module trims via stripTags.
const ROW_RE =
  /<td[^>]*><a href="\/case\/Details\/(\d+)">([^<]+)<\/a><\/td>\s*<td>([^<]*)<\/td>\s*<td>([\s\S]*?)<\/td>/g;

function parseOpenCaseList(html: string): OpenCaseRow[] {
  const resultsMatch = /Results:\s*([\d,]+)/i.exec(html);
  if (!resultsMatch) {
    throw new Error(
      "Idaho PUC case list response didn't contain a recognizable \"Results: N\" count — the page structure likely changed. Check parseOpenCaseList in src/lib/ingest/idPucDockets.ts against a fresh response.",
    );
  }
  const totalResults = Number(resultsMatch[1].replace(/,/g, ""));
  if (totalResults > LIST_PAGE_SIZE) {
    throw new Error(
      `Idaho PUC open electric case count (${totalResults}) exceeds this module's LIST_PAGE_SIZE (${LIST_PAGE_SIZE}) — results would be silently truncated. Raise LIST_PAGE_SIZE in src/lib/ingest/idPucDockets.ts (confirmed live 2026-08-24 that ps values up to at least 500 are honored in one request) or add pagination.`,
    );
  }

  const rows: OpenCaseRow[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    rows.push({
      caseId: m[1],
      caseNumber: stripTags(m[2]),
      company: stripTags(m[3]),
      description: stripTags(m[4]),
    });
  }

  if (totalResults > 0 && rows.length !== totalResults) {
    throw new Error(
      `Idaho PUC case list reported ${totalResults} results but ROW_RE parsed ${rows.length} rows — the row markup likely changed. Check ROW_RE in src/lib/ingest/idPucDockets.ts against a fresh response.`,
    );
  }
  return rows;
}

async function fetchOpenCaseList(): Promise<OpenCaseRow[]> {
  const html = await fetchText(`${OPEN_CASES_URL}&ps=${LIST_PAGE_SIZE}&pn=1`);
  return parseOpenCaseList(html);
}

interface CaseDetail {
  filedDate: Date | null;
  status: string | null;
}

// Real observed format: "03/11/2026". Same parseMDY shape as every other
// module in this series.
function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Targets `<td data-title="X">value</td>` specifically (not `<th
// data-title="X">X</th>`, the column header, which repeats the same
// data-title attribute with the label itself as its text — confirmed live
// this distinction is necessary: a tag-agnostic `data-title="Status">
// ([^<]*)<` regex matches the header cell ("Status") first, not the real
// value).
function extractDataCell(html: string, title: string): string | null {
  const re = new RegExp(`<td data-title="${title}">([^<]*)<\\/td>`, "i");
  const m = re.exec(html);
  return m ? stripTags(m[1]) : null;
}

async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  const html = await fetchText(DETAIL_URL(caseId));
  const filedRaw = extractDataCell(html, "Date Filed");
  const status = extractDataCell(html, "Status");
  return { filedDate: filedRaw ? parseMDY(filedRaw) : null, status };
}

// See module header STATUS for why a bare "certificate" (not the fuller
// "certificate of public convenience") is used, and why it's confirmed safe
// (zero false positives across Idaho's full real electric-case history).
// Deliberately no trailing \b: a real bug caught by the scratch dry-run
// before shipping (this project's standard verification step) — a first
// version used /\bcertificate\b/i (word-bounded on both sides), which
// silently excluded every real "CERTIFICATES OF PUBLIC CONVENIENCE" (plural)
// caption, since there's no word boundary between "certificate" and the
// trailing "s". This is the exact same singular/plural gap confirmed live
// against IPUC's own search box during research (searching "CERTIFICATE OF
// PUBLIC CONVENIENCE" there returns only 1 of the real 4 open candidates,
// missing the 3 phrased "CERTIFICATES OF...") — correctly avoided when
// choosing to filter locally on a bare substring instead of relying on the
// site's own search, but reintroduced by adding the trailing \b here. Caught
// by comparing the scratch script's dry-run output (1 real candidate) against
// the hand-verified real count (4) before shipping, not assumed correct.
const CONTENT_RE = /\bcertificate/i;

// See module header STATUS — the one real, confirmed exclusion pattern
// (Idaho Power's real petition to withdraw an already-granted certificate).
// No trailing \b after "certificate", matching the same singular/plural fix
// applied to CONTENT_RE above (not currently exercised by a real plural
// "withdraw certificates" case, but kept consistent on the same reasoning).
const EXCLUDE_RE = /\bwithdraw\w*\s+certificate/i;

// See module header STATUS: closed=0 (open) vs closed=1 (closed) is the
// authoritative "still waiting" signal; a candidate's own detail-page Status
// field is checked only as defense-in-depth against staleness (not currently
// exercised by any real candidate — see header).
const CLOSED_STATUS_RE = /\bclosed\b/i;

const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;
const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b|(?:^|[^0-9])\d[\d,]*[\s-]*kv\b/i;
const GENERATING_RE = /\bpower plants?\b|\bgenerat(?:e|ing|ion|or)\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/\bwind\b/i, "wind_onshore"],
  [/\bnatural gas\b|\bgas[- ]fired\b|\bgas plant\b|\bgas expansion\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Leftmost-in-text, not fixed-priority — same rationale as
// wvPscDockets.ts's pickFuelType (not currently exercised by any real
// candidate, since none of the 4 real open CPCN captions name a fuel/
// technology at all, but kept consistent with this series' standard for
// when a future hybrid caption does).
function pickFuelType(description: string): FuelType | null {
  let best: { fuel: FuelType; index: number } | null = null;
  for (const [re, fuel] of FUEL_KEYWORDS) {
    const m = re.exec(description);
    if (m && (best === null || m.index < best.index)) best = { fuel, index: m.index };
  }
  return best ? best.fuel : null;
}

function inferProjectTypeAndFuel(description: string): { projectType: ProjectType; fuelType: FuelType } {
  if (STORAGE_RE.test(description)) return { projectType: "storage", fuelType: "storage" };
  if (TRANSMISSION_RE.test(description)) return { projectType: "transmission", fuelType: "transmission" };
  if (GENERATING_RE.test(description)) {
    return { projectType: "generation", fuelType: pickFuelType(description) ?? "other" };
  }
  // Real confirmed gap (see module header FUEL/PROJECT TYPE): a genuine CPCN
  // caption can name neither a facility-type word nor a fuel (e.g. "SOUTH
  // HILLS AND PEREGRINE POWER PLANTS" is caught by GENERATING_RE via "power
  // plants", but a caption naming only a project name with none of these
  // words would fall through here). Generation is the plurality outcome
  // among Idaho's real classifiable CPCN population (2 of 4 real open
  // candidates are transmission, 1 is unclassified generation, matching this
  // series' "plurality default" convention — see moPscDockets.ts) — but
  // every real current candidate is in fact caught by one of the three
  // checks above, so this fallback is not currently exercised.
  return { projectType: "generation", fuelType: "other" };
}

// Not exercised by any real current candidate (see module header FUEL/
// PROJECT TYPE & CAPACITY) — kept for when a future caption states one,
// matching this series' standard `\d+\s*MW` pattern.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*MW\b/i;

function extractCapacityMw(description: string): number | null {
  const m = CAPACITY_RE.exec(description);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function normalizeCase(row: OpenCaseRow, detail: CaseDetail): NormalizedProject {
  const matchKey = resolveMatchKey("id-puc", row.caseNumber);
  const { projectType, fuelType } = inferProjectTypeAndFuel(row.description);
  const capacityMw = extractCapacityMw(row.description);

  // See module header STATUS: closed=0 (open) is the authoritative signal
  // this candidate came from; a Status of "Closed" here would mean IPUC's
  // own detail page disagrees with the list it was just found on
  // (staleness), not currently observed live but checked defensively.
  const resolved = detail.status != null && CLOSED_STATUS_RE.test(detail.status);
  const currentStage: ProjectStage = resolved ? "cancelled" : "local_review";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Idaho Public Utilities Commission's public electric case search (Certificate of Public Convenience and Necessity applications, Idaho Code §61-528).",
    '"Still waiting" here is primarily determined by IPUC\'s own case search "Open"/"Closed" status (this source\'s own Status field on the case detail page is not published to be more granular than that once a case closes — see the ingestion module header for why disposition text isn\'t separately parsed here).',
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the case description text, not a structured field — not independently verified.");
  }
  if (fuelType === "other" && projectType === "generation") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the case description text.");
  }
  dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");

  return {
    matchKey,
    name: `${row.company} (Idaho PUC Case ${row.caseNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "ID",
    county: null,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: detail.filedDate,
    dateConfidence: "exact",
    currentStatus: `Idaho PUC Case ${row.caseNumber}: ${detail.status ?? "open"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Idaho Public Utilities Commission — Case No. ${row.caseNumber}, "${row.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `Idaho PUC Case No. ${row.caseNumber}`,
        url: DETAIL_URL(row.caseId),
      },
    ],
    externalIds: { idPuc: row.caseNumber },
  };
}

// See module header VANISHED-CANDIDATE FIX. Minimal stub: since matchKey
// resolves directly to an existing DB row here (this matchKey was created by
// an earlier run of this same source), upsertNormalizedProject deletes it
// via the RESOLVED_STAGES path before ever reading most of these fields, so
// only matchKey/currentStage need to be meaningful.
function buildVanishedStub(matchKey: string, caseNumber: string): NormalizedProject {
  return {
    matchKey,
    name: `Idaho PUC Case ${caseNumber} (no longer open)`,
    projectType: "transmission",
    fuelType: "other",
    state: "ID",
    currentStatus: `Idaho PUC Case ${caseNumber}: no longer listed as open by IPUC's own case search`,
    currentStage: "cancelled",
    causeSlugs: ["local_state_opposition"],
    causeDetail: `Idaho PUC Case ${caseNumber} no longer appears in IPUC's own open-case search.`,
    sources: [],
    externalIds: { idPuc: caseNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestIdPucDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allOpenCases = await fetchOpenCaseList();

  const realCandidates = allOpenCases
    .filter((row) => CONTENT_RE.test(row.description) && !EXCLUDE_RE.test(row.description))
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const row of realCandidates) {
    try {
      const detail = await fetchCaseDetail(row.caseId);
      toUpsert.push(normalizeCase(row, detail));
    } catch (err) {
      errors.push({ matchKey: row.caseNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See module header VANISHED-CANDIDATE FIX: IPUC's own case search is
  // scoped to closed=0 (open only), so a case whose closed flag has already
  // flipped simply vanishes from `allOpenCases` above rather than being
  // caught by this module's own Status-field defense-in-depth check. Any
  // matchKey this source previously tracked that isn't present among this
  // run's full open-case set (all real open Electric cases, not just the
  // CPCN-scoped subset — mirrors wvPscDockets.ts's own choice, see header)
  // is pushed through as a resolved stub so upsertNormalizedProjects deletes
  // the stale row.
  const stillOpenMatchKeys = new Set(
    allOpenCases.map((row) => resolveMatchKey("id-puc", row.caseNumber)),
  );
  const previouslyTracked = await prisma.project.findMany({
    where: { matchKey: { startsWith: "id-puc:" } },
    select: { matchKey: true },
  });
  for (const { matchKey } of previouslyTracked) {
    if (matchKey && !stillOpenMatchKeys.has(matchKey)) {
      const caseNumber = matchKey.slice("id-puc:".length);
      toUpsert.push(buildVanishedStub(matchKey, caseNumber));
    }
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: allOpenCases.length,
    realApplicationCandidates: realCandidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestIdPucDockets()
    .then((summary) => {
      console.log(
        `Idaho PUC docket ingestion complete: ${summary.candidatesFound} open electric candidates found, ` +
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
