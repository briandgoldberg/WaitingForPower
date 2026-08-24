// New Hampshire Site Evaluation Committee (SEC) docket ingestion — one of
// several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-24 via real GET requests (Node's own `fetch`,
// the same runtime this module uses in production) against the live
// puc.nh.gov / nhsec.nh.gov sites — no assumption below was taken from
// documentation or training-data memory alone.
//
// WHY SEC, NOT PUC: the task brief started from the hint that New
// Hampshire's Public Utilities Commission (PUC, recently reorganized) runs
// the public docket search — the same hint that turned out wrong for
// Washington (WUTC vs EFSEC), Oregon (PUC vs EFSC), Massachusetts (DPU vs
// EFSB), and Connecticut (PURA vs CSC). Checked here too, per this
// project's "confirm before guessing" rule. New Hampshire is a genuine,
// statute-confirmed instance of the same pattern: RSA 162-H:4 assigns the
// power to "evaluate and issue any certificate ... for an energy facility"
// (a "Certificate of Site and Facility," NH's real CPCN-equivalent for
// large generation/transmission/storage/LNG-type facilities) exclusively
// to "the committee" — the New Hampshire Site Evaluation Committee (SEC) —
// never to the PUC by name. Confirmed live by reading RSA 162-H directly at
// gencourt.state.nh.us: energy-facility jurisdiction thresholds are
// generating stations of 30+ MW (§162-H:2,VII(b)), electric storage
// facilities with 30+ MW peak capacity (VII(g)), transmission lines of
// 100kV+ paired with a covered generator or >10 miles, or any new line
// >200kV (VII(c)-(e)), any "renewable energy facility" regardless of size
// (VII(f)), and certain gas/LNG/oil facilities meeting specific storage-day
// thresholds (VII(a)) — none of this is PUC's own ratemaking/tariff
// docket business (PUC's own docket types, confirmed live in its Docket
// Book: DE=electric, DW=water, DG=gas, DT=telecom, none of them siting).
//
// THE TWIST — SEC is administratively attached to PUC, and as of December
// 2025 its documents are HOSTED on PUC's own website, which is what makes
// this look like "PUC does siting" at first glance: RSA 162-H:3 confirmed
// live: SEC's 5 statutory members are the PUC's own 3 commissioners (whose
// chair also chairs SEC) plus the DES commissioner plus one public member,
// and "IV. The committee shall be administratively attached to the public
// utilities commission." Critically, though, §162-H:3,III also confirms
// "the 3 public utilities commissioners alone shall not constitute a
// quorum" — PUC cannot issue a Certificate of Site and Facility by itself;
// SEC (which requires participation from the DES commissioner or public
// member) is the exclusive decision-maker per §162-H:4(a). Confirmed live
// on nhsec.nh.gov/sec-dockets (2026-08-24): "As of December 2025, all
// active Site Evaluation Committee (SEC) dockets are available in the
// Public Utilities Commission's Virtual File Room and will use the prefix
// SEC-. ... To view historic SEC dockets, visit the SEC dockets archive."
// This module therefore scopes to SEC-prefixed dockets specifically within
// PUC's Virtual File Room, the same "real siting authority isn't the
// obvious body, even though its records now live on that body's own
// website" situation maEfsbDockets.ts documented for EFSB sitting
// administratively inside DPU.
//
// FETCHING: puc.nh.gov/VirtualFileRoom/ is a plain ASP.NET WebForms site —
// server-rendered HTML, no auth, no JS execution required. IMPORTANT
// caveat confirmed by hand: a bare `curl` GET against any *.nh.gov host
// (including this one) returns a hard Akamai 403 "Access Denied" — even
// for /robots.txt — but this is a TLS-fingerprint-based bot block specific
// to curl's ClientHello, NOT an IP block and NOT a CAPTCHA: the exact same
// request via Node's own `fetch()` (undici — the real runtime this module
// and Vercel's serverless functions both use) returns a clean 200 with no
// special headers or cookies needed. Confirmed by testing both curl and
// `node -e "fetch(...)"` against puc.nh.gov, nhsec.nh.gov, and
// energy.nh.gov back-to-back from the same machine. Documented here so a
// future maintainer troubleshooting with curl doesn't mistake this for a
// real access blocker.
//   - GET VirtualFileRoom/DocketBook.aspx?DocketYear=<year> — one page per
//     calendar year, listing every PUC docket opened that year (DE/DW/DG/
//     DT/SEC-prefixed, in one shared HTML table) with Docket#, Petitioner,
//     and free-text Description already inline — no extra request needed
//     for the base fields, unlike most WebDocket-style states in this
//     series. Confirmed live: SEC-prefixed rows appear in this system
//     starting ONLY in the 2025 year page (full-text-scanned every year
//     2012-2024 for "Site and Facility"/"Site Evaluation Committee" and
//     found zero matches in any of them) — see LOOKBACK below.
//   - GET VirtualFileRoom/Docket.aspx?DocketNumber=<encoded number> — one
//     docket's full filing history: Docket#, Petitioner, Description again
//     (redundant with DocketBook, not re-parsed), and a table of every
//     filed document with a Tab number, filed date, filer, and a hyperlink
//     whose own `aria-label` attribute redundantly restates the full
//     "TITLE, Tab N, filed on M/D/YYYY, filed by FILER" string — parsed
//     from that single aria-label per row (self-contained per document,
//     avoiding any risk of separately-captured Tab/Date/Title arrays
//     desyncing on a malformed trailing row, which a first version of this
//     module's parser did hit against SEC 25-072's real 196-filing
//     history). Real, confirmed-live oddity, not a bug: the very first row
//     in this table is sometimes a duplicate "most recent filing" pinned
//     ahead of the true chronological Tab-1 start (SEC 25-072's real table
//     opens with a 7/20/2026 order labeled "Tab 1", immediately followed by
//     the true Tab 1, dated 10/2/2025) — handled correctly here without
//     special-casing since this module scans the WHOLE filing table for
//     both the earliest date (application filed date) and any resolution
//     language (STATUS), never assuming strict order.
//
// LOOKBACK / SEC_ERA_START_YEAR: this module only ever fetches
// DocketBook.aspx for years from SEC_ERA_START_YEAR (2025) through the
// current year — not a volume-control measure but a correctness one,
// confirmed live: pre-2025 SEC dockets (old numbering like "2015-04") were
// never part of PUC's own docket-numbering system at all; they lived
// entirely on the separate nhsec.nh.gov site (confirmed via the Wayback
// Machine: nhsec.nh.gov's old docket-archive page linked "1985-1998",
// "2000-2010", and "2011-2024" historic-docket ranges under its own
// numbering, wholly independent of PUC's). As of the December 2025
// migration, any SEC docket still active is described as now living in
// PUC's Virtual File Room "with the prefix SEC-" — and every SEC-prefixed
// docket found live to date (5 total: SEC 25-072 through 25-075, SEC
// 26-005) was opened in 2025 or later, i.e. the migration point itself is
// also effectively this docket type's start-of-history in the system this
// module reads. Documents from BEFORE the migration are only available via
// a Box.com-hosted "SEC Docket Archive" folder (linked from
// nhsec.nh.gov/sec-dockets) — an unstructured folder of PDFs, not a
// queryable/structured docket system, so it is NOT ingested here. Known,
// accepted gap, same shape as maEfsbDockets.ts's LOOKBACK_YEARS exclusion
// of MA's own pre-digitization-era dockets: any SEC matter that was both
// (a) still genuinely active as of the Dec 2025 cutover and (b) NOT
// re-hosted under a new SEC-prefixed PUC number (none were found in this
// research) would be invisible to this module. No evidence of such a case
// was found — RSA 162-H's high MW/kV thresholds mean SEC's real caseload is
// inherently small, and this module's fetches (see VANISHED-CANDIDATE
// note below) would in any case pick up such a docket automatically the
// moment NH assigns it any SEC-prefixed number.
//
// SCOPING to real applications: DocketBook rows include non-application SEC
// matters sharing the same "SEC" prefix — confirmed live, of the 5 total
// SEC-prefixed dockets that exist as of this writing, 3 are administrative
// RULEMAKING dockets (SEC 25-073/074/075, "New Hampshire Code of
// Administrative Rules Chapter Site ..." — not projects at all, Petitioner
// field is literally "Rulemaking") and 1 is an ownership-TRANSFER petition
// for an already-built, already-operating facility (SEC 26-005, "Joint
// Petition ... for Approval of the Transfer of Ownership of Essential Power
// Newington, LLC" — RSA 162-H requires SEC sign-off on ownership transfers
// too, but this is not a project "waiting" to be built; it was in fact
// already granted live, "Order Approving Transfer of Ownership...",
// 3/26/2026/5/5/2026 depending on docket). CONTENT_RE requires a
// candidate's own Description mention "Certificate of Site and Facility"
// at all (which naturally excludes the 3 rulemaking dockets, whose
// descriptions only mention "Administrative Rules"); EXCLUDE_RE is layered
// on top specifically for transfer/amendment/rehearing-type filings that
// DO legitimately mention a Certificate of Site and Facility without being
// a new-construction application, the same two-filter shape
// maEfsbDockets.ts and ctCscDockets.ts both use for their own non-project
// docket types. This leaves exactly ONE real, currently open candidate as
// of this writing: SEC 25-072 (Eversource, rebuilding the existing X-178
// transmission line) — a thin population, but confirmed correct for the
// same reason wvPscDockets.ts kept its own confirmed-zero E-CS docket type:
// RSA 162-H's own MW/kV thresholds make this an inherently low-volume
// docket type in a small state, not a sign the scoping is wrong.
//
// STATUS — no structured status field exists at either the DocketBook or
// Docket-detail level (same root problem as ctCscDockets.ts/mdPscDockets.ts);
// inferred by scanning every filed document's title (from the aria-label
// text) for resolving language. CONFIRMED REAL FALSE-POSITIVE RISK, caught
// before shipping (this project's standard verification step, same class
// of bug as wvPscDockets.ts's Pro-Hac-Vice gotcha): SEC 25-072's own real
// filing history is full of "Order Denying ..." and "Order Granting ..."
// titles that have NOTHING to do with the underlying Certificate —
// "Order Denying Petition to Intervene of Kristina Pastoriza and Ruth Ward
// Without Prejudice", "Order Denying Applicant's Assented-To Motion to
// Postpone Pre-Hearing Conference", "Order Denying Motion to Amend
// Procedural Schedule", "Order Granting Applicant's Assented-To Motion to
// Reschedule Technical Session", "Order Granting in Part with Conditions
// [a] Petition to Intervene" — all real, all procedural, none a final
// disposition. GRANT_RE/DENY_RE below therefore require "application" (not
// "petition to intervene", "motion", or "request for intervention") appear
// close to the grant/deny verb. An even sharper real gotcha found live in
// this same docket: Tab 12, "Order Rejecting Application for Certificate of
// Site and Facility" (1/5/2026) — reads exactly like a final denial by
// keyword ("Application" + "Certificate of Site and Facility" +
// "Rejecting" all present) but is NOT one: it's a "deemed incomplete,
// please supplement" procedural bounce, and the docket continued for 190+
// more filings afterward, including Tab 18's "Memorandum Decision and
// Order Accepting PSNH's Supplemented Application for Certificate of Site
// and Facility" (2/9/2026). DENY_RE below deliberately triggers only on
// "den(y/ies/ied/ying)", never "reject", for exactly this reason — a
// docket rejected-as-incomplete is correctly left as still "local_review"
// here, not misclassified as resolved. GRANT_RE is calibrated against one
// real confirmed grant, but of a transfer petition rather than a new
// construction application (SEC 26-005: "Order Approving Transfer of
// Ownership of Essential Power Newington, LLC") — this module's SEC-era
// history (started December 2025) does not yet contain a single real
// granted OR denied new-construction Certificate to calibrate against, so
// GRANT_RE/DENY_RE's construction-application path is written defensively
// (requiring "certificate of site and facility" itself, not just
// "application", adjacent to the grant/deny verb) but is genuinely
// UNTESTED against a live example — flagged here honestly rather than
// guessed at, same as ctCscDockets.ts's and maEfsbDockets.ts's own admitted
// calibration gaps for their least-common outcomes.
//
// VANISHED-CANDIDATE FIX: does NOT apply here, and no diffing/stub code is
// needed — unlike the WV/CT/TN/CA bug class this project's brief warns
// about, this module's own candidate-fetching query is never scoped to
// "active only." DocketBook.aspx?DocketYear=<year> permanently lists every
// docket ever opened in that year, resolved or not (there is no "hide
// closed dockets" filter to fall out of) — so a docket this module
// previously tracked as still-pending will keep appearing as a candidate
// on every future run regardless of its real-world outcome, get correctly
// re-classified as resolved by this module's own STATUS scan, and get
// pushed through with a RESOLVED_STAGES stage so upsertNormalizedProjects
// deletes the stale row — the same "search everything, not just what's
// currently active, and let STATUS scanning do the work" shape as
// maEfsbDockets.ts's IndustryId=4/TypeId=9 search.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields — parsed from the
// candidate's own Description (from DocketBook) plus its own filed
// documents' titles (already fetched for STATUS, no extra request),
// combined into one text blob. Real, confirmed live: the only real
// candidate's Description ("Application for a Certificate of Site and
// Facility to Rebuild the Existing X-178 Transmission Line") never states
// a capacity figure at all (unsurprising — it's a transmission rebuild,
// not a generator), so CAPACITY_RE is written but unexercised by any live
// candidate; kept for the next real generation/storage application, same
// "real capacity is rarely stated" caveat wvPscDockets.ts documents for its
// own thin population.
//
// LOCATION: no structured field; New Hampshire has only 10 counties, so
// (per this project brief's own suggestion, and the exact hazard
// mdPscDockets.ts's own greedy county regex ran into) a hardcoded
// whitelist is used rather than a free-form "capitalized words before
// County" pattern. Confirmed live against SEC 25-072's own filing titles:
// "Notice of Public Hearings in Grafton and Coos Counties" is real,
// multi-county text this module's COUNTY_PHRASE_RE correctly extracts both
// tokens from.
//
// One notable simplification vs. this series' MA/CT/WV siblings: NH's
// Virtual File Room publishes Petitioner as its own clean, already-labeled
// field on both DocketBook and Docket-detail pages — no free-text
// "Petition of X for approval..." regex-extraction gymnastics are needed
// here the way maEfsbDockets.ts/ctCscDockets.ts both require.
//
// Wired to Vercel Cron weekly, 07:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-nh-sec/route.ts). Real timing measured
// 2026-08-24 against the live shared DB (2 DocketBook year-page fetches
// [2025, 2026] + 1 per-real-candidate detail fetch, politeness-delayed):
// ~4s, comfortably inside the 300s cron budget.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://www.puc.nh.gov/VirtualFileRoom";

// Confirmed live 2026-08-24: zero SEC-prefixed DocketBook rows in any year
// 2012-2024 (full-text-scanned for "Site and Facility"/"Site Evaluation
// Committee" and found none) — see module header LOOKBACK. SEC-prefixed
// dockets only start appearing in the 2025 year page, coinciding with the
// December 2025 PUC/SEC hosting migration.
const SEC_ERA_START_YEAR = 2025;

// Comfortably above the current real population (5 total SEC-prefixed
// dockets ever, 1 of them a real still-open construction application as of
// this writing) — see module header SCOPING. RSA 162-H's own MW/kV
// jurisdiction thresholds make this an inherently low-volume docket type in
// a small state, so there's no realistic scenario of this cap silently
// dropping a genuinely-still-open one.
export const MAX_CANDIDATES = 50;
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: "text/html" } });
  if (!res.ok) throw new Error(`NH SEC request failed (${res.status}): ${url}`);
  return res.text();
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
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

interface DocketBookRow {
  docketNumber: string;
  petitioner: string;
  description: string;
}

// Confirmed live 2026-08-24 against DocketBook.aspx's real row structure —
// see module header FETCHING. Each row is a plain 3-column table row:
// Docket# (as a link), Petitioner, Description (wrapped in a <p>).
const DOCKET_ROW_RE =
  /<a href="Docket\.aspx\?DocketNumber=([^"]+)">[^<]+<\/a><\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*><p>([\s\S]*?)<\/p>/g;

function parseDocketBookYear(html: string, year: number): DocketBookRow[] {
  const rows: DocketBookRow[] = [...html.matchAll(DOCKET_ROW_RE)].map((m) => ({
    docketNumber: decodeHtmlEntities(m[1]),
    petitioner: stripHtml(m[2]),
    description: stripHtml(m[3]),
  }));
  // A genuine year with zero PUC dockets at all would be a sign the page
  // structure changed, not a real outcome — every year in NH PUC's own
  // history has dozens to hundreds of dockets (DE/DW/DG/DT alone). SEC rows
  // specifically being zero (true for every pre-2025 year, by design — see
  // module header LOOKBACK) is NOT an error and is not checked here.
  if (rows.length === 0) {
    throw new Error(
      `NH PUC DocketBook response for year ${year} matched zero rows at all — the page structure likely changed. Check parseDocketBookYear in src/lib/ingest/nhSecDockets.ts against a fresh response.`,
    );
  }
  return rows;
}

async function fetchDocketBookYear(year: number): Promise<DocketBookRow[]> {
  const html = await fetchText(`${BASE_URL}/DocketBook.aspx?DocketYear=${year}`);
  return parseDocketBookYear(html, year);
}

// See module header SCOPING. Requires the phrase this docket type's real
// Certificate is actually named, which naturally excludes the 3 real
// rulemaking dockets confirmed live (SEC 25-073/074/075, whose descriptions
// only mention "Administrative Rules").
const CONTENT_RE = /certificate of site and facility/i;

// Real non-construction SEC matters confirmed sharing the "SEC" prefix and
// mentioning a Certificate of Site and Facility without being a new
// construction application — see module header SCOPING (SEC 26-005, an
// ownership-transfer petition for an already-operating facility, is the
// live-confirmed case for the transfer branch).
const EXCLUDE_RE =
  /\btransfer of (?:ownership|control)\b|\bamendment\b|\brenewal\b|\bpetition for rehearing\b|\bmotion for rehearing\b|\breconsideration\b|\bdeclaratory ruling\b/i;

interface DocketFiling {
  title: string;
  tab: string;
  date: Date | null;
  filedBy: string;
}

// Confirmed live 2026-08-24 against SEC 25-072's real 196-filing history
// and SEC 26-005's real 17-filing history — see module header FETCHING.
// Parses each row entirely from its own hyperlink's `aria-label` attribute
// (which redundantly restates "TITLE, Tab N, filed on M/D/YYYY, filed by
// FILER" as one string) rather than separately matching the Tab/Date/Title
// table cells and zipping the resulting arrays together — a first version
// of this module did the latter and silently desynced near the end of
// SEC 25-072's real filing table, where a handful of trailing rows have no
// hyperlink (and so no title) at all.
const FILING_RE =
  /<a id="Main_DocumentsID_HyperLink1_\d+" aria-label="(.*?), Tab (\d+), filed on ([\d/]+) [^,]*, filed by ([^"]*)" href="ShowDocument\.aspx\?DocumentId=[a-f0-9-]+"/g;

function parseDocketFilings(html: string): DocketFiling[] {
  const filings: DocketFiling[] = [];
  for (const m of html.matchAll(FILING_RE)) {
    const [, title, tab, dateRaw, filedBy] = m;
    const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateRaw);
    const date = dm ? new Date(Number(dm[3]), Number(dm[1]) - 1, Number(dm[2])) : null;
    filings.push({ title: decodeHtmlEntities(title), tab, date: date && !Number.isNaN(date.getTime()) ? date : null, filedBy: decodeHtmlEntities(filedBy) });
  }
  return filings;
}

async function fetchDocketFilings(docketNumber: string): Promise<DocketFiling[]> {
  const html = await fetchText(`${BASE_URL}/Docket.aspx?DocketNumber=${encodeURIComponent(docketNumber)}`);
  const filings = parseDocketFilings(html);
  if (filings.length === 0) {
    throw new Error(
      `NH SEC Docket.aspx response for "${docketNumber}" matched zero filings — the page structure likely changed. Check parseDocketFilings in src/lib/ingest/nhSecDockets.ts against a fresh response.`,
    );
  }
  return filings;
}

type Resolution = "granted" | "denied" | null;

// See module header STATUS for how these were calibrated against SEC
// 25-072's real, live, noisy filing history. DENY_RE deliberately triggers
// only on "den(y/ies/ied/ying)" — never "reject" — because "Order Rejecting
// Application for Certificate of Site and Facility" (a real filing on
// SEC 25-072) is a procedural incompleteness bounce, not a final denial;
// requiring "application" near the deny verb (not "petition to intervene",
// "motion", or "request for intervention") avoids the many real procedural
// "Order Denying ..." filings confirmed live on the same docket.
const DENY_RE =
  /\bapplication\b[\s\S]{0,100}?\bis\s+denied\b|\bdenies?\s+(?:the\s+)?application\s+for\s+a\s+certificate\b|\border\s+denying\s+(?:the\s+)?application\s+for\s+a\s+certificate\b/i;
// Calibrated against one real confirmed grant (SEC 26-005's "Order
// Approving Transfer of Ownership...") plus the RSA's own "Certificate ...
// is granted" phrasing — genuinely untested against a real granted
// CONSTRUCTION application, since none exists yet in this <1-year-old
// hosting system. See module header STATUS.
const GRANT_RE =
  /\bcertificate of site and facility\b[\s\S]{0,100}?\b(?:is\s+granted|is\s+hereby\s+granted|is\s+approved)\b|\b(?:grants?|granting|approv(?:es|ing|ed))\b[\s\S]{0,100}?\bcertificate of site and facility\b|\border\s+approving\b[\s\S]{0,150}?\b(?:application|transfer)\b/i;

function detectResolution(filings: DocketFiling[]): Resolution {
  for (const f of filings) {
    if (DENY_RE.test(f.title)) return "denied";
    if (GRANT_RE.test(f.title)) return "granted";
  }
  return null;
}

const TRANSMISSION_RE = /\btransmission\s+line\b|\bsubstation\b|(?:^|[^0-9])\d[\d,]*\s*kv\b/i;
const LNG_RE = /\bliquefied natural gas\b|\bLNG\b/i;
const PIPELINE_RE = /\benergy transmission pipeline\b|\bgas pipeline\b/i;
const STORAGE_RE = /\bbattery energy storage\b|\benergy storage facility\b|\bbattery storage\b/i;
const WIND_RE = /\bwind\b/i;
const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const GAS_RE = /\bnatural gas\b|\bgas[- ]fired\b|\bcombined[- ]cycle\b/i;
const HYDRO_RE = /\bhydro/i;
const NUCLEAR_RE = /\bnuclear\b/i;
const GEOTHERMAL_RE = /\bgeothermal\b/i;

function inferProjectType(text: string): ProjectType {
  if (TRANSMISSION_RE.test(text)) return "transmission";
  if (LNG_RE.test(text)) return "lng";
  if (PIPELINE_RE.test(text)) return "pipeline";
  if (STORAGE_RE.test(text)) return "storage";
  return "generation";
}

function inferFuelType(text: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "lng") return "lng";
  if (projectType === "pipeline") return "pipeline";
  if (projectType === "storage") return "storage";
  if (WIND_RE.test(text)) return "wind_onshore";
  if (SOLAR_RE.test(text)) return "solar";
  if (GAS_RE.test(text)) return "gas";
  if (HYDRO_RE.test(text)) return "hydro";
  if (NUCLEAR_RE.test(text)) return "nuclear";
  if (GEOTHERMAL_RE.test(text)) return "geothermal";
  return "other";
}

// See module header FUEL/PROJECT TYPE & CAPACITY — unexercised by the one
// live candidate (a transmission-line rebuild, no capacity figure stated)
// but kept for the next real generation/storage application.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*(?:MW|megawatts?)\b/i;

function extractCapacityMw(text: string): number | null {
  const m = CAPACITY_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// New Hampshire has exactly 10 counties — confirmed live 2026-08-24 — so a
// hardcoded whitelist is used rather than a free-form "capitalized words
// before County" pattern, the same greedy-regex hazard mdPscDockets.ts
// documents for its own county extraction.
const NH_COUNTIES = [
  "Belknap", "Carroll", "Cheshire", "Coos", "Grafton",
  "Hillsborough", "Merrimack", "Rockingham", "Strafford", "Sullivan",
];
const NH_COUNTY_LOOKUP = new Map(NH_COUNTIES.map((c) => [c.toLowerCase(), c]));

// Confirmed live against SEC 25-072's own real filing text: "Notice of
// Public Hearings in Grafton and Coos Counties".
const COUNTY_PHRASE_RE = /([A-Z][A-Za-z]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z]+)*)\s+Count(?:y|ies)\b/g;

function extractCounties(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(COUNTY_PHRASE_RE)) {
    for (const token of m[1].split(/\s+(?:and|&)\s+/)) {
      const canonical = NH_COUNTY_LOOKUP.get(token.trim().toLowerCase());
      if (canonical && !found.includes(canonical)) found.push(canonical);
    }
  }
  return found;
}

function normalizeCandidate(row: DocketBookRow, filings: DocketFiling[]): NormalizedProject {
  const matchKey = resolveMatchKey("nh-sec", row.docketNumber);

  const filingTitles = filings.map((f) => f.title).join(" ");
  const combinedText = `${row.description} ${filingTitles}`;

  const projectType = inferProjectType(combinedText);
  const fuelType = inferFuelType(combinedText, projectType);
  const capacityMw = extractCapacityMw(combinedText);
  const counties = extractCounties(combinedText);
  const county = counties.length > 0 ? counties.join(", ") : null;

  const filedDates = filings.map((f) => f.date).filter((d): d is Date => d !== null);
  const filedDate = filedDates.length > 0 ? new Date(Math.min(...filedDates.map((d) => d.getTime()))) : null;

  const resolution = detectResolution(filings);
  const currentStage: ProjectStage = resolution === "granted" ? "approved_awaiting_construction" : resolution === "denied" ? "cancelled" : "local_review";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the New Hampshire Site Evaluation Committee (SEC)'s docket records, hosted (since a December 2025 restructuring) inside the Public Utilities Commission's own Virtual File Room under the \"SEC\" docket prefix — SEC, not the PUC itself, is the body that actually issues New Hampshire's Certificate of Site and Facility (the state's real CPCN equivalent for large energy facilities) under RSA 162-H; the PUC's 3 commissioners are 3 of SEC's 5 statutory members and cannot alone constitute a quorum. See the ingestion module header for the full statutory citation.",
    "\"Still waiting\" here is determined by scanning every filed document's own title for resolving language, since no structured status field is published. This is deliberately NOT triggered by a docket being \"rejected\" as incomplete (a real, confirmed-live procedural bounce-back distinct from a final denial) — only by an explicit grant or denial of the underlying Certificate. See the ingestion module header for a real docket (SEC 25-072) where a naive keyword match on \"Application\"+\"Certificate\"+\"Rejecting\" would have wrongly flagged a still-very-much-open docket as resolved.",
    "Fuel/technology and capacity are parsed from the docket's own free-text description and filed-document titles (the only project-detail text this source publishes in structured form), not a structured field — not independently verified against the underlying application documents.",
  ];
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from this docket's description and filing titles.");
  }
  if (county) {
    const word = county.includes(",") ? "Counties" : "County";
    dataQualityNoteParts.push(`Located in ${word} ${county}, New Hampshire, per the docket's own filing text — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }
  dataQualityNoteParts.push(
    "This source's hosting system only began listing SEC dockets in December 2025; any SEC matter that predates that migration and was not carried forward under a new SEC-prefixed docket number is not covered here (pre-migration records are only available as an unstructured PDF archive). See the ingestion module header for details.",
  );

  return {
    matchKey,
    // row.docketNumber already carries its own "SEC " prefix (e.g. "SEC
    // 25-072") — not repeated again here to avoid a doubled "SEC SEC 25-072".
    name: `${row.petitioner} (NH ${row.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "NH",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: resolution
      ? `NH Docket ${row.docketNumber}: ${resolution} (no longer pending before the Site Evaluation Committee)`
      : `NH Docket ${row.docketNumber}: pending before the Site Evaluation Committee`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Site and Facility (or related siting approval) from the New Hampshire Site Evaluation Committee — Docket ${row.docketNumber}, "${row.description.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `NH Docket ${row.docketNumber}`,
        url: `${BASE_URL}/Docket.aspx?DocketNumber=${encodeURIComponent(row.docketNumber)}`,
      },
    ],
    externalIds: { nhSec: row.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestNhSecDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = SEC_ERA_START_YEAR; y <= currentYear; y++) years.push(y);

  const allRowsPerYear = await Promise.all(years.map((y) => fetchDocketBookYear(y)));
  const allRows = allRowsPerYear.flat();
  const secRows = allRows.filter((r) => r.docketNumber.startsWith("SEC "));

  const realCandidates = secRows
    .filter((r) => CONTENT_RE.test(r.description) && !EXCLUDE_RE.test(r.description))
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const row of realCandidates) {
    try {
      const filings = await fetchDocketFilings(row.docketNumber);
      toUpsert.push(normalizeCandidate(row, filings));
    } catch (err) {
      errors.push({ matchKey: row.docketNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: secRows.length,
    realApplicationCandidates: realCandidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  const started = Date.now();
  ingestNhSecDockets()
    .then((summary) => {
      const elapsedMs = Date.now() - started;
      console.log(
        `New Hampshire SEC docket ingestion complete: ${summary.candidatesFound} SEC-prefixed candidates found, ` +
          `${summary.realApplicationCandidates} real siting applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors. (${elapsedMs}ms)`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
