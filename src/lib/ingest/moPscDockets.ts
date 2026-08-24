// Missouri Public Service Commission (PSC) Certificate of Convenience and
// Necessity (CCN — Missouri's own statute, RSMo 393.170, uses "certificate
// of convenience and necessity" directly, no separate CPCN acronym) docket
// ingestion — one of several states built in parallel in the per-state
// series started with vaSccDockets.ts (see that file's header for the
// overall rationale). Confirmed by hand 2026-08-23 via real requests
// against the live site — no assumption below was taken from documentation
// or training-data memory alone.
//
// FETCHING: efis.psc.mo.gov ("EFIS," Electronic Filing and Information
// System) is a plain server-rendered ASP.NET Core MVC site — no CAPTCHA, no
// bot-challenge, no paid API. But unlike several other states in this
// series, its search endpoint is a real AJAX POST guarded by ASP.NET Core's
// antiforgery double-submit cookie, so (confirmed by hand) a bare POST
// without the matching cookie+token pair 302-redirects to /Error/404
// instead of returning results:
//   1. GET /Case (any page render sets a fresh pair) returns a
//      `.AspNetCore.Antiforgery.<random>` Set-Cookie plus a same-valued
//      `__RequestVerificationToken` hidden field in the HTML. Both must be
//      threaded through — this module keeps a small manual cookie jar
//      (fetch doesn't do this automatically in Node) rather than hardcode
//      the antiforgery cookie's name, since nothing here says that name is
//      stable across deploys.
//   2. POST /Case with the token plus CaseTypeList[0].{Id,Code,Name}=4/
//      APPLICATIONFORC/"Application for Certificate" and
//      UtilityTypeList[0].{Id,Code,Name}=5/E/"Electric" (both confirmed
//      against the live search form's real <option> values — EFIS's search
//      widget builds these as indexed hidden-field triples per selected
//      item, not a plain multi-select) plus
//      GridResultOptions.SelectedResultLimit=1000 and sort-by-DateTimeFiled-
//      descending returns JSON: `{isValid, searchGridResultContent (an HTML
//      fragment table), resultsFound, message}`. Confirmed gotcha: the
//      response is a 404 redirect unless the request also carries
//      `X-Requested-With: XMLHttpRequest` — EFIS's MVC action is
//      AJAX-only and renders an error page for a "normal" POST navigation,
//      even with a valid antiforgery pair. Confirmed 2026-08-23: querying
//      Utility Type=Electric + Case Type="Application for Certificate"
//      returns every one of EFIS's 169 such cases ever filed (1978-2026) in
//      one response — SelectedResultLimit's max option is 3000, no
//      pagination needed at this population size.
//   3. Detail: GET /Case/Display/{internal id} (the id embedded in each
//      search result row's own /Case/Display/{id} link — NOT the public
//      case number) server-renders the ENTIRE docket filing history inline
//      in the HTML (no separate AJAX call, unlike NY DPS/NV PUCN's
//      detail-JSON pattern) — every filing's date/"Type of Filing"/"Title
//      of Filing" in one <table>. This is the only per-candidate request
//      this module makes. Confirmed real latency: a 62-candidate batch (see
//      LOOKBACK_YEARS below) took 31s total including the 250ms
//      per-candidate politeness delay — large dockets with 100+ filings run
//      up to ~1.4s each, but the total is comfortably inside the 300s cron
//      budget even at a much higher candidate count, unlike NY DPS's
//      module which had to trim MAX_CANDIDATES for exactly this reason.
//
// SCOPING: EFIS's "Application for Certificate" case type (server-side
// code APPLICATIONFORC) is Missouri's real, current CCN-application
// bucket, but it is NOT a clean 1:1 match for "project waiting on a
// construction certificate" — confirmed by hand against real Style-of-Case
// text pulled from all 169 real "Application for Certificate" + Electric
// cases ever filed:
//   - A real false positive found live: EA-2026-0344 ("In the Matter of
//     Evergy Metro, Inc. ... and Evergy Missouri West, Inc. ...'s Notice of
//     Intent to File an Application for Authority to Establish a
//     Demand-Side Programs Investment Mechanism") is filed under this same
//     case type but is a rate/tariff-mechanism notice with nothing to do
//     with siting or construction. CONTENT_RE below requires an explicit
//     "certificate ... convenience and necessity" or "permission and
//     authority/approval ... to construct" phrase in the Style of Case
//     text (both real, common phrasings confirmed across the corpus);
//     EXCLUDE_RE additionally drops "notice of intent to file" (this case),
//     "amendment" (see Grain Belt Express below), and bare asset-transfer
//     petitions. A real false-negative bug caught while building this: an
//     early version also excluded any style mentioning "waiver" or
//     "variance," which wrongly dropped EA-2026-0253 — a genuine CCN
//     construction application that also requests "a Waiver of Certain
//     Tariff Provisions" as an ancillary item in the same sentence — fixed
//     by only gating on CONTENT_RE (removing "waiver"/"variance" from
//     EXCLUDE_RE entirely; they're common, harmless riders on real
//     applications, not signals of a different case).
//   - GRAIN BELT EXPRESS: confirmed live that Missouri PSC has its own real
//     CCN history for this project — EA-2016-0358 ("In the Matter of the
//     Application of Grain Belt Express Clean Line LLC for a Certificate of
//     Convenience and Necessity Authorizing it to Const[ruct]...", filed
//     6/30/2016, Status Closed/Archived — the original CCN, resolved years
//     before this module's lookback window) and EA-2023-0017 ("...for an
//     Amendment to its Certificate of Convenience and Necessity...", filed
//     7/12/2022, Status Closed/Archived — an amendment to the
//     already-granted original, excluded by EXCLUDE_RE's "amendment" check
//     regardless). Neither is ingested by this module (one pre-dates any
//     reasonable lookback, the other is both resolved and an amendment,
//     not a new application) — see this module's PR/report for the
//     specific docket numbers to hand to whichever process maintains
//     manualOverrides.csv, in case a third matchKey entry (alongside the
//     existing eia/permittingDashboard entries for
//     "grain-belt-express-phase-1") is later wanted for completeness. This
//     module does NOT add one itself (out of scope per its own
//     instructions) and, since both real MO dockets are resolved/excluded,
//     creates no duplicate row either way.
//   - Case-number prefix is not a reliable filter: legacy/misfiled records
//     under this same case type+utility-type search occasionally carry an
//     "EO-" (not "EA-") prefix (e.g. EO-90-60, a waiver request unrelated
//     to any certificate) — content-based filtering catches these too,
//     the case-number prefix is never inspected.
//
// STATUS — same lesson as every prior state in this series, independently
// reconfirmed here, but unusually thoroughly: EFIS's own case-level
// "Status" field (Open/Closed-Archived/Reopened, `CaseMasterStatusId`) is
// actively unreliable, not just imprecise. Of 7 real "Reopened"/"Open"
// candidates spot-checked by hand against their own filed Orders (and, for
// the 3 whose Order titles didn't already say "certificate," the actual
// PDF order text), ALL 7 turned out to already be fully resolved:
//   - EA-2020-0371 (id 9774): Status "Reopened" as of 2026-08-23, but its
//     own docket has "Order Approving Stipulation and Agreement and
//     Granting Certificate of Convenience and Necessity," issued 3/24/2021
//     — over 5 years stale.
//   - EA-2022-0099 (id 9786): Status "Reopened," real order title is just
//     "Order Approving Stipulation and Agreement" (7/7/2022) — no
//     "certificate" in the title at all. Opened the actual PDF (this
//     module does not do this at runtime, only for calibration) and
//     confirmed it grants ATXI's CCN: "THE COMMISSION ORDERS THAT: 1. The
//     application for a certificate of convenience and necessity filed by
//     ATXI is granted..." A lone follow-up "Compliance Filing" appeared in
//     2026, 4 years later — routine post-grant reporting, not renewed
//     litigation of the certificate question.
//   - EA-2024-0302 (id 86962, ATXI's contested FDIM/MMRX transmission
//     case): Status "Reopened," but its docket's final substantive
//     decision is titled just "Report and Order" (12/11/2025) — no
//     "granting"/"certificate" in the title either. PDF text confirms:
//     "THE COMMISSION ORDERS THAT: 1. ATXI's application for a certificate
//     of convenience and necessity is granted, subject to..."
//   - EA-2025-0075 (id 90004, Evergy Missouri West gas-generation case):
//     Status "Open" as of 2026-08-23, but its own "Report and Order"
//     (7/31/2025) PDF confirms "Evergy Missouri West's application for a
//     certificate(s) of convenience and necessity ... is granted..." —
//     Status never updated in over a year.
//   - EA-2023-0286 (id 9795) and EA-2024-0212 (id 84159): both "Reopened,"
//     both have an "Order ... Granting Certificate(s) of Convenience and
//     Necessity" (6/12/2024 and 10/23/2024 respectively) already on file.
// The real, workable signal: scan every filing whose "Type of Filing" is
// "Order" for a title matching RESOLUTION_RE (below) — this covers all
// three real title patterns confirmed above ("Order Granting Certificate
// of Convenience and Necessity," "Order Approving Stipulation and
// Agreement" [with or without an explicit "...and Granting Certificate"
// suffix — confirmed both forms independently resolve the case], and the
// exact title "Report and Order" [MO PSC's standard name for the
// Commission's final substantive decision after a contested hearing]).
// Caveat carried over from this series' usual pattern (NV/NY): DENY_RE is
// unconfirmed against any real denial — none exists in the current
// population — and neither is "Report and Order" confirmed to ALWAYS mean
// "granted" specifically (both real examples found were grants; a denial
// would also file under this exact title with no way to tell from the
// title alone). This doesn't affect site behavior either way: both
// "approved_awaiting_construction" and "cancelled" are RESOLVED_STAGES
// (see common.ts) and get deleted from the site identically, so an
// unconfirmed grant/deny guess on an ambiguous "Report and Order" title
// only affects the (soon-deleted) stage label, never whether the project
// stays listed as "waiting." No case in the real population studied showed
// genuine NEW litigation of the certificate question reopening after an
// already-filed grant/deny order (unlike NV PUCN's multi-phase UEPA
// pattern) — post-resolution activity observed was always compliance
// filings/reports, so this module treats the presence of ANY qualifying
// Order anywhere in a docket's history as resolved, without NV's
// "no later substantive filing" recency check.
//
// FUEL/PROJECT TYPE & CAPACITY: Style of Case text here is often much
// terser than other states' — confirmed real gotcha: several genuine,
// currently-relevant CCN applications (e.g. EA-2025-0344, EA-2024-0212,
// EA-2020-0371 — all citing "4 CSR 240-3.105," apparently Missouri's rule
// for a streamlined/short-form CCN track) carry a caption that says only
// "...for Permission and Approval and a Certificate of Public Convenience
// and Necessity," with the actual facility type disclosed only in the
// underlying application PDF (not fetched — this module doesn't add a PDF
// dependency, matching the rest of this series' regex/HTML-only
// discipline). These fall back to projectType "transmission" (the
// plurality outcome among the classifiable population: 62 transmission vs.
// 43 generation) and fuelType "other", flagged in dataQualityNote. Style
// text also essentially never states a capacity figure (unlike NY/NV
// titles) — capacityValue is null for effectively every MO PSC project.
// County IS usually present for transmission-type filings ("...in Stoddard
// County, Missouri") and extracted the same way as NV's COUNTY_RE.
//
// Confirmed real per-candidate detail-fetch timing above (~40s for 62
// candidates) leaves large headroom under the 300s cron budget, so
// MAX_CANDIDATES is set above (not capped down to) the current real
// population within LOOKBACK_YEARS, unlike ny-dps's module.
//
// Wired to Vercel Cron weekly, 03:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-mo-psc/route.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://efis.psc.mo.gov";

export const MAX_CANDIDATES = 70;
const REQUEST_DELAY_MS = 250;
// Confirmed live 2026-08-23: 62 real candidates exist within this window
// (see module header timing note). Real still-pending dockets were found
// spanning several years, not just the most recent one (unlike this
// series' usual "oldest pending case is under a year old" pattern) — 10
// years is a deliberate, generous margin here, not just copied from NV
// PUCN/NY DPS's own bound.
const LOOKBACK_YEARS = 10;

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
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#x2019;/g, "’")
    .replace(/&#xD;&#xA;|&#xd;&#xa;/g, " ")
    .replace(/&#x9;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

// --- Manual cookie jar --------------------------------------------------
// Node's fetch doesn't manage cookies automatically. EFIS's antiforgery
// validation needs whatever cookie(s) accompanied the page that issued the
// __RequestVerificationToken echoed back verbatim on the POST — captured
// generically (not hardcoded by name) since nothing confirms the
// `.AspNetCore.Antiforgery.<random>` cookie's name is stable across
// deploys.
function parseSetCookies(res: Response): Map<string, string> {
  const jar = new Map<string, string>();
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const headers = raw.length > 0 ? raw : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
  for (const line of headers) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return jar;
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

interface Session {
  cookieHeader: string;
  requestVerificationToken: string;
}

async function bootstrapSession(): Promise<Session> {
  const res = await fetch(`${BASE_URL}/Case`);
  if (!res.ok) throw new Error(`MO PSC EFIS bootstrap request failed (${res.status})`);
  const jar = parseSetCookies(res);
  const html = await res.text();
  const m = /__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/.exec(html);
  if (!m) {
    throw new Error(
      "MO PSC EFIS /Case response didn't contain __RequestVerificationToken — the page structure likely changed. Check bootstrapSession in src/lib/ingest/moPscDockets.ts against a fresh response.",
    );
  }
  return { cookieHeader: cookieHeader(jar), requestVerificationToken: m[1] };
}

interface CaseSearchResult {
  caseId: string;
  caseNo: string;
  filedDate: Date | null;
  status: string;
  styleOfCase: string;
}

function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Matches each search-result row pair: the case-number row (id/case
// no./filed date/status), immediately followed by its own two-row-span
// "Style of Case:" caption row. Confirmed live 2026-08-23 against the real
// /Case POST response's searchGridResultContent fragment.
const ROW_RE =
  /<tr>\s*<td data-label="Case No\.">[\s\S]*?<a href="[^"]*\/Case\/Display\/(\d+)"[^>]*>([^<]+)<\/a>[\s\S]*?<td data-label="Date Filed">\s*([^<]*?)\s*<\/td>[\s\S]*?<td data-label="Status">\s*([^<]*?)\s*<\/td>\s*<\/tr>\s*<tr>\s*<td colspan="7">\s*<div class="commentText[^"]*">\s*<span class="font-weight-bold">\s*Style of Case:\s*<\/span>\s*<br[^>]*\/?>\s*([\s\S]*?)<\/div>/g;

async function searchCandidates(session: Session): Promise<CaseSearchResult[]> {
  const params = new URLSearchParams();
  params.set("__RequestVerificationToken", session.requestVerificationToken);
  params.set("CaseTypeList[0].Id", "4");
  params.set("CaseTypeList[0].Code", "APPLICATIONFORC");
  params.set("CaseTypeList[0].Name", "Application for Certificate");
  params.set("UtilityTypeList[0].Id", "5");
  params.set("UtilityTypeList[0].Code", "E");
  params.set("UtilityTypeList[0].Name", "Electric");
  params.set("GridResultOptions.SelectedResultLimit", "1000");
  params.set("GridResultOptions.SortBy", "DateTimeFiled");
  params.set("GridResultOptions.SortDirection", "DESC");

  const res = await fetch(`${BASE_URL}/Case`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE_URL}/Case/NewSearch`,
      Cookie: session.cookieHeader,
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`MO PSC EFIS case search failed (${res.status})`);
  const payload = (await res.json()) as { isValid?: boolean; searchGridResultContent?: string };
  if (!payload.isValid || typeof payload.searchGridResultContent !== "string") {
    throw new Error(
      "MO PSC EFIS case search response wasn't the expected {isValid, searchGridResultContent} shape — the endpoint likely changed. Check searchCandidates in src/lib/ingest/moPscDockets.ts against a fresh response.",
    );
  }

  const results: CaseSearchResult[] = [];
  for (const m of payload.searchGridResultContent.matchAll(ROW_RE)) {
    results.push({
      caseId: m[1],
      caseNo: stripTags(m[2]),
      filedDate: parseMDY(m[3]),
      status: stripTags(m[4]),
      styleOfCase: stripTags(m[5]),
    });
  }
  if (results.length === 0) {
    throw new Error(
      "MO PSC EFIS case search returned zero parsed rows — the search grid row structure likely changed. Check ROW_RE in src/lib/ingest/moPscDockets.ts against a fresh response.",
    );
  }
  return results;
}

// See module header SCOPING. Requires an explicit certificate/construction
// phrase (both real, common phrasings confirmed across the live corpus).
const CONTENT_RE =
  /certificate(?:\(s\))?s? of (?:public )?convenience and necessity|permission and (?:authority|approval)(?: and (?:approval|authority))? to construct/i;
// "Waiver"/"variance" deliberately NOT excluded here — see module header
// SCOPING for the real false-negative (EA-2026-0253) that caused.
const EXCLUDE_RE =
  /\bnotice of intent to file\b|\bterritorial agreement\b|\bexclusive service territor|\bamendment\b|\btransfer of\b[\s\S]{0,40}\bassets\b(?![\s\S]*\bcertificate\b)/i;

interface FilingRow {
  date: Date | null;
  typeOfFiling: string;
  titleOfFiling: string;
}

// Matches each row of the docket's inline "Docket Filings" table on
// Case/Display/{id} — confirmed live 2026-08-23. No separate AJAX call
// needed; the full filing history is server-rendered in the initial page.
const FILING_ROW_RE =
  /<tr class="trFiling"[^>]*>[\s\S]*?<td data-label="Date Filed">[\s\S]*?<div>\s*([^<]+?)\s*<\/div>[\s\S]*?<td data-label="Type of Filing">\s*([^<]+?)\s*<\/td>\s*<td data-label="Title of Filing">\s*([^<]+?)\s*<\/td>/g;

async function fetchFilings(session: Session, caseId: string): Promise<FilingRow[]> {
  const res = await fetch(`${BASE_URL}/Case/Display/${caseId}`, {
    headers: { Cookie: session.cookieHeader },
  });
  if (!res.ok) throw new Error(`MO PSC EFIS case detail request failed (${res.status}) for case ${caseId}`);
  const html = await res.text();
  const rows: FilingRow[] = [];
  for (const m of html.matchAll(FILING_ROW_RE)) {
    rows.push({
      date: parseMDY(decodeHtmlEntities(m[1])),
      typeOfFiling: stripTags(m[2]),
      titleOfFiling: stripTags(m[3]),
    });
  }
  return rows;
}

type Resolution = "granted" | "denied" | "closed-unclear" | null;

// See module header STATUS: several real, confirmed title patterns for a
// case-resolving filing, none of which reliably includes all of
// "granting"/"certificate" together —
//   - GRANT_RE: "Order Granting Certificate(s) of Convenience and
//     Necessity" and "...Granting Certificate(s)..." variants.
//   - DENY_RE: mirror of GRANT_RE — unconfirmed against any real denial,
//     kept for correctness only (see header caveat).
//   - STIPULATION_RE: "Order Approving Stipulation and Agreement," but
//     also its real ordinal/modifier variants — confirmed live: "Order
//     Approving Third Stipulation and Agreement" (case EA-2019-0021) and
//     "Order Approving Unanimous Stipulation and Agreement" (case
//     EA-2018-0327) both resolve the case identically to the bare form; an
//     earlier version of this regex anchored directly on "stipulation,"
//     which silently missed both and left two real, already-closed 2018/
//     2019 dockets showing as "still waiting" — caught in a post-run
//     data-quality check against the live DB, not assumed fixed.
//   - REPORT_AND_ORDER_RE: exact "Report and Order" — MO PSC's standard
//     title for the Commission's final substantive decision after a
//     contested hearing, confirmed by hand (PDF text) on two real cases.
//   - CLOSING_FILE_RE: "Order Closing File" (confirmed live on 2 real
//     2018/2019 dockets) and "Notice Closing File" (confirmed live on a
//     3rd) — a real administrative-closure signal missed entirely by an
//     earlier version of this function, which only ever scanned
//     `typeOfFiling === "Order"` and only for the four grant/deny/
//     stipulation/report patterns above; "Notice Closing File" files under
//     typeOfFiling "Notice", not "Order", so it was invisible to that
//     filter regardless of title. Its own title never says granted/denied,
//     so it resolves to "closed-unclear" rather than a guessed verdict —
//     RESOLVED_STAGES (common.ts) removes the project from the site either
//     way, so the specific stage label is the only thing this affects.
const GRANT_RE = /\bgranting\b[\s\S]{0,80}\bcertificate/i;
const DENY_RE = /\bdenying\b[\s\S]{0,80}\bcertificate/i;
const STIPULATION_RE = /^order approving\b[\s\S]{0,40}\bstipulation and agreement\b/i;
const REPORT_AND_ORDER_RE = /^report and order$/i;
const CLOSING_FILE_RE = /\bclosing file\b/i;

function resolveDocket(filings: FilingRow[]): Resolution {
  const dated = filings.filter((f) => f.date != null);
  // CLOSING_FILE_RE is checked across every filing type (see header — a
  // real closing signal appears under both "Order" and "Notice"); the other
  // four patterns are Order-type-only, matching every real example they
  // were confirmed against.
  const qualifying = dated.filter(
    (f) =>
      (f.typeOfFiling === "Order" &&
        (GRANT_RE.test(f.titleOfFiling) ||
          DENY_RE.test(f.titleOfFiling) ||
          STIPULATION_RE.test(f.titleOfFiling) ||
          REPORT_AND_ORDER_RE.test(f.titleOfFiling))) ||
      CLOSING_FILE_RE.test(f.titleOfFiling),
  );
  if (qualifying.length === 0) return null;
  qualifying.sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime());
  const latest = qualifying[0];
  if (DENY_RE.test(latest.titleOfFiling) && !GRANT_RE.test(latest.titleOfFiling)) return "denied";
  if (GRANT_RE.test(latest.titleOfFiling) || STIPULATION_RE.test(latest.titleOfFiling) || REPORT_AND_ORDER_RE.test(latest.titleOfFiling)) {
    return "granted";
  }
  return "closed-unclear";
}

// See module header FUEL/PROJECT TYPE & CAPACITY.
const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b|photovoltaic/i, "solar"],
  [/\bwind\b/i, "wind_onshore"],
  [/natural gas|gas[- ]fired|combustion turbine/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];
const GENERATING_RE =
  /generation facilit|generating facilit|electrical production facilit|generation and battery|renewable generation|solar facilit|wind generation|combustion turbine/i;
const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b|\bswitching station\b|\bswitchyard\b|kilo-?volt|\bkv\b|\bdistribution\b/i;
const STORAGE_RE = /battery energy storage|battery storage/i;

function inferProjectTypeAndFuel(style: string): { projectType: ProjectType; fuelType: FuelType } {
  const fuelMatch = FUEL_KEYWORDS.find(([re]) => re.test(style));
  if (fuelMatch || GENERATING_RE.test(style)) {
    return { projectType: "generation", fuelType: fuelMatch ? fuelMatch[1] : "other" };
  }
  if (TRANSMISSION_RE.test(style)) return { projectType: "transmission", fuelType: "transmission" };
  if (STORAGE_RE.test(style)) return { projectType: "storage", fuelType: "storage" };
  // Real, confirmed gap: several genuine CCN applications carry a terse
  // caption with no facility-type detail at all (see module header) — the
  // plurality outcome among the classifiable population was transmission.
  return { projectType: "transmission", fuelType: "other" };
}

// Two real, confirmed grammar variants for the applicant clause — see
// module header. "to obtain" alongside "for" as the terminal word:
// Empire District's real captions use "...to Obtain a Certificate..."
// instead of "...for a Certificate...".
const STANDARD_RE = /^in the matter of the (?:joint )?application of (.+?) (?:for|to obtain)\b/i;
const POSSESSIVE_RE = /^in the matter of (.+?)'s application for\b/i;

function extractApplicant(style: string): string {
  let m = STANDARD_RE.exec(style);
  if (m) return m[1].trim();
  m = POSSESSIVE_RE.exec(style);
  if (m) return m[1].trim();
  return style.slice(0, 80);
}

// Confirmed against the real corpus — real captions sometimes name more
// than one county for a single line; every match is kept, same approach as
// nyDpsDockets.ts's extractCounties. Anchored on a preceding "in"/"In" —
// without it, a real caption ("...Transmission Interconnection In Knox
// County, Missouri") captured the whole preceding capitalized run
// ("Transmission Interconnection In Knox") instead of just "Knox", caught
// in a post-run data-quality check against the live DB.
const COUNTY_RE = /\b[Ii]n\s+([A-Z][A-Za-z']+(?:,?\s+(?:and\s+)?[A-Z][A-Za-z']+)*)\s+Count(?:y|ies),?\s+Missouri/;

function extractCounty(style: string): string | null {
  const m = COUNTY_RE.exec(style);
  return m ? m[1].trim() : null;
}

function normalizeCase(candidate: CaseSearchResult, resolution: Resolution): NormalizedProject {
  const matchKey = resolveMatchKey("mo-psc", candidate.caseNo);
  const { projectType, fuelType } = inferProjectTypeAndFuel(candidate.styleOfCase);
  const applicant = extractApplicant(candidate.styleOfCase);
  const county = extractCounty(candidate.styleOfCase);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "closed-unclear") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Missouri Public Service Commission's EFIS docket system, Certificate of Convenience and Necessity applications (RSMo 393.170).",
    "EFIS's own case \"Status\" field (Open/Closed-Archived/Reopened) does not reliably indicate whether the certificate has been decided — multiple real dockets remain marked \"Open\" or \"Reopened\" for years after a granting order is already on file. \"Still waiting\" here is instead inferred from scanning every filed Order's title for a granting/denying/settlement-approval/final-decision signal — see the ingestion module header for how this was calibrated against real dockets, including cases confirmed via the underlying order PDF text where the title alone was ambiguous.",
  ];
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket's Style of Case text, which is often terse for Missouri filings (the underlying application PDF is not parsed by this ingestion module).");
  }
  dataQualityNoteParts.push("Capacity figures are not published in Missouri EFIS docket captions and are not available here.");
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Missouri, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (MO PSC Case ${candidate.caseNo})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "MO",
    county,
    capacityValue: null,
    capacityUnit: null,
    applicationFiledDate: candidate.filedDate,
    dateConfidence: "exact",
    currentStatus: `Missouri PSC Case ${candidate.caseNo}: ${resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Convenience and Necessity from the Missouri Public Service Commission — Case No. ${candidate.caseNo}, "${candidate.styleOfCase}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `MO PSC Case No. ${candidate.caseNo}`,
        url: `${BASE_URL}/Case/Display/${candidate.caseId}`,
      },
    ],
    externalIds: { moPsc: candidate.caseNo },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestMoPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const session = await bootstrapSession();
  const allCandidates = await searchCandidates(session);

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const realApplications = allCandidates
    .filter((c) => CONTENT_RE.test(c.styleOfCase) && !EXCLUDE_RE.test(c.styleOfCase))
    .filter((c) => c.filedDate != null && c.filedDate >= cutoff)
    .sort((a, b) => (b.filedDate as Date).getTime() - (a.filedDate as Date).getTime())
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of realApplications) {
    try {
      const filings = await fetchFilings(session, candidate.caseId);
      const resolution = resolveDocket(filings);
      toUpsert.push(normalizeCase(candidate, resolution));
    } catch (err) {
      errors.push({ matchKey: candidate.caseNo, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: allCandidates.length,
    realApplicationCandidates: realApplications.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestMoPscDockets()
    .then((summary) => {
      console.log(
        `Missouri PSC docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.realApplicationCandidates} real CCN applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
