// West Virginia Public Service Commission (PSC) Certificate of Public
// Convenience and Necessity (CPCN, W. Va. Code §24-2-11) + Siting
// Certificate (W. Va. Code §24-2-11c) docket ingestion — one of several
// states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23 via real GET requests against the live
// psc.state.wv.us "WebDocket" site — no assumption below was taken from
// documentation or training-data memory alone.
//
// SCOPING: West Virginia splits its construction-certificate authority
// across two distinct docket types, both confirmed live and both searchable
// by a simple case-number substring:
//   - "E-CN" (W. Va. Code §24-2-11): the general utility CPCN — every
//     regulated-utility generation/transmission construction application
//     found live carries this code, e.g. Case 26-0075-E-CN (NextEra Energy
//     Transmission MidAtlantic, "the West Virginia portions of the
//     MidAtlantic Resiliency Link Project"), Case 26-0108-E-CN (Mon
//     Power/Potomac Edison, a ~1200 MW gas plant + 70 MW solar at Fort
//     Martin), Case 26-0135-E-CN-PW (Potomac Edison, a 138kV transmission
//     line rebuild). The "-PW" suffix ("Petition for Waiver") is a real,
//     common variant — WV lets an applicant request a CPCN "or a waiver
//     therefrom" in one filing for smaller/ordinary-extension projects —
//     and is included automatically since the search is a substring match
//     on "E-CN".
//   - "E-CS" (W. Va. Code §24-2-11c, "Siting certificates for certain
//     electric generating facilities"): WV's separate process for exempt
//     wholesale generators, confirmed live via 38 real historical cases
//     (e.g. Case 05-1590-E-CS, Beech Ridge Energy's wind farm; Case
//     03-1860-E-CS-CN, Longview Power's coal plant) — the direct structural
//     analog of Kentucky's "026 - Merchant Plant" case code in
//     kyPscDockets.ts. Confirmed live 2026-08-23: zero currently-ACTIVE
//     E-CS cases exist (WV's merchant-generator pipeline is presently empty
//     — the real historical population is all wind/coal projects from
//     2003-2009). Included anyway, unlike this series' usual practice of
//     dropping a confirmed-zero case code, because E-CS is unambiguously
//     the correct docket type for a merchant solar/wind/storage project
//     filing in WV tomorrow — dropping it would silently blind this module
//     to exactly the kind of project this site exists to track. A stray
//     E-CS-GI case (Case 06-0573-E-CS-GI, "General Investigation ...
//     Noise Rules Task Force Report" — not a real project at all) confirms
//     the search needs the same content-based filtering as the E-CN pool;
//     see EXCLUDE_RE/CONTENT_RE below.
// Both docket types are searched via the same case-number-CONTAINS query
// against WebDocket's own "Status: Active" filter — confirmed live: as of
// 2026-08-23 this returns exactly 4 real, currently-open candidates (all
// under E-CN), all four independently checked by hand (see STATUS) to
// still be genuinely pending. A "PC" suffix code ("Petition for Consent")
// was checked and confirmed to be an unrelated financing/securitization/
// cost-recovery docket type, not part of this scope — excluded by
// construction, since the search only ever looks for "E-CN"/"E-CS"
// substrings, never "E-PC". Gas-utility CNs ("G-CN") were not searched,
// matching this series' convention of excluding gas-utility (as opposed to
// gas-fired generation, which IS in scope) filings.
//
// FETCHING: psc.state.wv.us/scripts/WebDocket/ is a plain, decades-old
// ColdFusion site (frameset UI, .cfm scripts) with NO auth, NO CAPTCHA, NO
// session requirement of any kind — confirmed by hand: a bare, cookie-less
// `curl` GET against `viewCaseForWebList.cfm` with the case-search form's
// own field names returns real filtered results every time (the site does
// issue CFID/CFTOKEN cookies on response, but never requires them echoed
// back — every request in this module is a fresh, stateless GET, unlike
// moPscDockets.ts's antiforgery-cookie dance or nvPucnDockets.ts's
// User-Agent sniffing). Two request types are used:
//   1. `GET viewCaseForWebList.cfm?chkActiveCriteria=1&txtCaseNumberCriteria=
//      E-CN&txtCaseNumberOperator=CONTAINS&...` — the case-search results
//      list. Confirmed live: this ONE response already contains everything
//      needed per candidate (Case Number, Filed date, Final/closed date,
//      Case Name = the applicant, and the full Case Description text) — no
//      separate per-candidate detail-page fetch is needed at all, unlike
//      every other WebDocket-style state in this series (KY/MO both need a
//      second per-candidate request for exactly this data). Paginated 25
//      rows/page (confirmed live via the response's own "Page X of Y" /
//      "Next" links); this module loops pages defensively even though the
//      real current candidate count (4) fits on one page.
//   2. `GET tblCaseActivitiesList.cfm?txtCaseNumberCriteria=<case>&
//      txtCaseNumberOperator=EQUAL&txtActivityTypeCriteria=Order&
//      txtActivityTypeOperator=EQUAL&MaxRecs=100&SortOrder=1` — the case's
//      own Order-type activity log, confirmed live to return rows sorted
//      most-recent-first, each with the ACTUAL FULL TEXT of the order's own
//      summary inline in the HTML (no PDF fetch, no zlib/FlateDecode
//      decompression needed at all — unlike utPscDockets.ts/njBpuDockets.ts,
//      which both had to read final-order PDFs directly because no
//      structured summary existed; WV's own activity log already IS that
//      structured summary). This is the only per-candidate request this
//      module makes. MaxRecs=100 is assumed sufficient for any single CN/CS
//      docket's Order-type activity count — confirmed generously true for
//      every real case checked (the busiest real docket, Case 26-0075-E-CN,
//      has 702 TOTAL activities but only a handful are Order-type; most are
//      "Incoming Document" protest letters) — not re-verified against a
//      pathological outlier.
//
// STATUS — same lesson as every prior state in this series, reconfirmed
// here with an unusually rich, unusually well-calibrated real dataset (7
// distinct real closed dockets spanning grant/deny/dismiss/partial/edge-case
// outcomes, plus all 4 real currently-"Active" dockets independently
// cross-checked): WV's own case-level Active/Closed flag (chkActiveCriteria)
// held up as reliable for every real case checked, but is NOT trusted alone
// — every candidate's own Order-type activity log is also scanned as a
// defense-in-depth cross-check, per this series' standing practice.
//   - GRANTED, plain: Case 24-0038-E-CN — "Commission Final Order that the
//     Application of AEP West Virginia Transmission Company, lnc. and
//     Wheeling Power Company is approved and the request for a certificate
//     for public convenience and necessity is granted; etc. Case Final.
//     Removing from open docket." Case 24-0479-E-CN uses a third real
//     phrasing: "...are approved and that AEP West Virginia Transmission
//     Company, Inc. and Appalachian Power Company are issued a Certificate
//     of Public Convenience and Necessity...".
//   - GRANTED, partial: Case 25-0637-E-CN — "Commission Final Order that
//     the Application of West Virginia Transmission Company, Inc. and
//     Appalachian Power Company for a Certificate of Public Convenience and
//     Necessity pursuant to W. Va. Code § 24-2-11 and General Order No. 265
//     is granted in part and denied in part, as set forth herein; that
//     [applicant] are granted a Certificate of Public Convenience and
//     Necessity to construct the 69-kV Accoville/Becco Project... [but] are
//     not authorized to construct the proposed Tin Branch station...".
//     Treated as "granted" here (a real CPCN was issued authorizing real
//     construction, just a scoped-down version of what was requested) — the
//     word "denied" never appears adjacent to "is"/"are" in this real text
//     ("and denied in part", not "is denied"), so GRANT_RE alone correctly
//     classifies it without needing a dedicated partial-grant pattern.
//   - DENIED, confirmed real (unlike most sibling states in this series,
//     which never found a real denial to calibrate against): Case
//     24-0942-E-CN — "Commission Final Order that the AEP West Virginia
//     Transmission Company, Inc. and Appalachian Power Company application
//     for a certificate of public convenience and necessity to construct
//     the proposed transmission Project in Fayette County, West Virginia is
//     denied; etc. Case Final. Removing from open docket."
//   - DISMISSED via an unopposed ALJ Recommended Decision, not a Commission
//     order at all: Case 23-0922-E-CN. WV PSC refers contested CN cases to
//     an Administrative Law Judge; the ALJ's own "Recommended Decision" is
//     logged under Activity Type "Order" (confirmed live: "Recommended
//     Decision dismisses the case; etc.", 2/29/2024) and becomes final
//     automatically if no party files exceptions within 15/20 days — a
//     SEPARATE, later, non-Order "Process" activity then logs "Twenty Days
//     expire on Recommended Decision. Removing from open docket." with no
//     grant/deny text of its own. Scanning Activity Type="Order" (rather
//     than literally requiring the phrase "Commission Final Order," as an
//     early version of this module did) is what catches this pattern —
//     Recommended Decisions share the same Order activity type as Commission
//     Final Orders, so no separate detection path is needed. (Real
//     side-note, not a bug: this same physical transmission project — AEP's
//     "George Washington-Kammer Project" — was refiled three days later as
//     Case 24-0252-E-CN-PW and granted; the dismissal was procedural, not a
//     rejection of the underlying project. Not specially handled here — WV
//     PSC's own case numbers make this a routine same-project-two-dockets
//     situation, same as MO's Grain Belt Express history in
//     moPscDockets.ts.)
//   - Real edge case, no clean grant/deny at all: Case 24-0605-E-CN-PW —
//     "Commission Final Order that the project described in the July 15,
//     2024 application does not require a certificate of convenience and
//     necessity; etc. Case Final. Removing from open docket." The PSC ruled
//     its own CN process doesn't apply to this specific project, not that
//     the project itself was approved or rejected. Mapped to
//     "closed-unclear" (→ "cancelled" stage, see common.ts) — the least-wrong
//     bucket for "this specific docket concluded with no CN granted or
//     denied," matching this series' standing convention for ambiguous
//     closures (e.g. kyPscDockets.ts's CLOSED_FALLBACK_RE).
//   - CONFIRMED FALSE-POSITIVE RISK, caught before shipping: bare "is
//     granted"/"is approved" is NOT enough on its own. Case 26-0108-E-CN's
//     most recent real Procedural Order (as of 2026-08-23, while the case is
//     genuinely still pending) reads "...that the request for admission Pro
//     Hac Vice of Cassandra R. McCrae is hereby granted subject to
//     continuing compliance...; etc." — a routine attorney-admission motion,
//     nothing to do with the certificate. GRANT_RE/DENY_RE below require
//     "certificate" or "application" within 150 characters of the
//     grant/deny verb specifically because of this real, live false-positive
//     — confirmed it does NOT trigger on this text.
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): a real structural bug
// found and fixed before shipping (this project's own standard
// verification step). Every search this module runs is scoped
// chkActiveCriteria=1 (Active only) — so once WV PSC's OWN Active flag
// flips a case to Closed, that case simply vanishes from every future
// search entirely; this module's own Order-activity defense-in-depth
// check (see STATUS above) only ever runs on candidates that DO still
// appear in the Active search, so it can never catch a case whose Active
// flag has already flipped. Originally fixed by diffing this run's active
// candidates against previously-tracked "wv-psc:" matchKeys and pushing a
// resolved stub (guessing currentStage="cancelled") for anything that
// vanished, so common.ts would delete the stale row. That fix is now
// itself superseded: common.ts no longer deletes resolved-stage projects
// at all (they're kept and surfaced through the frontend's Status
// filter), so guessing "cancelled" for a vanished case would mean
// permanently mislabeling it — possibly wrongly, since a vanished case is
// just as likely to have been granted as cancelled — in a bucket real
// users can now see. This module therefore no longer touches a vanished
// case's DB row at all; it's simply left at its last-known real stage
// until/unless a future enhancement teaches this module to look up a
// truly-vanished case's real outcome directly, rather than guess it.
//
// FUEL/PROJECT TYPE & CAPACITY: extracted from the Case Description
// (Case Name, i.e. the applicant, is also checked — see next paragraph).
// GENERATING_RE/STORAGE_RE/TRANSMISSION_RE and a small FUEL_KEYWORDS table,
// same structure as kyPscDockets.ts. Two real, confirmed gotchas:
//   - Real source typo, not silently corrected: Case 26-0108-E-CN's own
//     caption reads "...an approximate 1200 MV combined cycle gas plant..."
//     — "MV" (megavolts, a voltage unit) is obviously meant as "MW"
//     (megawatts, a power unit) here; a combined-cycle plant's capacity is
//     never meaningfully described in megavolts. CAPACITY_RE matches "MV"
//     as a documented known-typo alias for "MW", the same "match, don't
//     silently fix" treatment this series gave Maryland's "Dorcester" and
//     Wisconsin's "Signed ad Served" typos.
//   - Real gotcha: a genuine transmission project's own Case Description
//     doesn't always say "transmission" anywhere. Case 26-0075-E-CN's full
//     description — "Application for a certificate of public convenience
//     and necessity authorizing the construction, financing, ownership, and
//     operation of the West Virginia portions of the MidAtlantic Resiliency
//     Link Project." — never uses the word. Its Case Name (the applicant),
//     "NextEra Energy Transmission MidAtlantic, Inc.", does. inferType()
//     below checks the applicant name together with the description for
//     exactly this reason; checked only for TRANSMISSION_RE (not
//     GENERATING_RE/STORAGE_RE, where an applicant's own corporate name
//     mentioning "Energy" or similar generic terms could false-positive).
// No battery/storage E-CN or E-CS docket has ever been filed in WV, and
// only one real wind docket exists (both confirmed live via full-text
// search across the site's entire history) — STORAGE_RE and the "wind"
// FUEL_KEYWORDS entry are kept as an easy, live-UNconfirmed add, the same
// caveat kyPscDockets.ts documents for its own thin fuel-type population.
// Capacity is rarely stated at all (only 2 real "MW" mentions found across
// the entire E-CN/E-CS history); when a caption states two figures for a
// hybrid application (26-0108's gas + solar), only the first is captured,
// flagged in dataQualityNote — same limitation kyPscDockets.ts documents.
//
// County: extracted from the Case Description against a hardcoded
// whitelist of WV's 55 counties, pulled directly from WV PSC's OWN
// case-search form's County dropdown (confirmed live 2026-08-23, count
// matches WV's real 55 counties) rather than a bare capitalized-word
// regex — the exact greedy-regex hazard this series' Maryland module
// documented for its own county extraction.
//
// EXCLUDE_RE/CONTENT_RE: confirmed live against every real active
// candidate. Case 26-0130-E-CN, "Application for Certificate of Public
// Convenience and Necessity to Construct a Mechanical Draft Cooling Tower
// at the Mitchell Power Plant," passes CONTENT_RE (has "certificate" +
// "construct") but is an emissions-control retrofit at an EXISTING plant,
// not a new generation/storage/transmission project — the same category of
// exclusion kyPscDockets.ts found for its own Case Code 030 cooling-tower
// CPCN. EXCLUDE_RE also drops "General Investigation" dockets (Case
// 06-0573-E-CS-GI, a noise-rules rulemaking, not a real project).
//
// Real per-run timing measured 2026-08-23 against the live population (2
// search requests + 4 per-candidate activity requests, each
// politeness-delayed): well under 5 seconds — no MAX_CANDIDATES trimming
// needed for the 300s cron budget at this population size.
//
// Wired to Vercel Cron weekly, 05:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-wv-psc/route.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://www.psc.state.wv.us";
const SEARCH_URL = `${BASE_URL}/scripts/WebDocket/viewCaseForWebList.cfm`;
const ACTIVITY_URL = `${BASE_URL}/scripts/WebDocket/tblCaseActivitiesList.cfm`;
const DETAIL_URL = (caseId: string) => `${BASE_URL}/scripts/WebDocket/viewCaseForWebViewForm.cfm?CaseID=${caseId}`;

// See module header SCOPING for why exactly these two, and why E-CS is
// kept despite a confirmed-live zero current population.
interface DocketTypeSource {
  pattern: string;
  label: string;
}
const DOCKET_TYPE_SOURCES: DocketTypeSource[] = [
  { pattern: "E-CN", label: "Certificate of Public Convenience and Necessity (W. Va. Code §24-2-11)" },
  { pattern: "E-CS", label: "Siting Certificate for wholesale/exempt generating facilities (W. Va. Code §24-2-11c)" },
];

// Real live population as of 2026-08-23 is 4 (all E-CN; E-CS currently
// empty — see SCOPING). Set generously above that for headroom; real timing
// (see module header) leaves enormous margin under the 300s cron budget at
// this population size.
export const MAX_CANDIDATES = 50;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
const PAGE_SIZE = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as every other module in this series, not a full HTML-entity
// library. &#x2f; / &#x3b; / &#x27; / &#x28; / &#x29; / &sect; all
// confirmed live in real WV PSC order/caption text.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&#x2f;/gi, "/")
    .replace(/&#x3b;/gi, ";")
    .replace(/&#x28;/gi, "(")
    .replace(/&#x29;/gi, ")")
    .replace(/&sect;/g, "§")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

interface CaseListRecord {
  caseId: string;
  caseNumber: string;
  filedDate: Date | null;
  applicant: string;
  description: string;
}

// Confirmed live 2026-08-23 against real viewCaseForWebList.cfm responses —
// see module header FETCHING. The description-field capture deliberately
// uses [\s\S]*? (not a "no & or <" character class) so it tolerates a real
// applicant name or caption containing an HTML entity (e.g. an apostrophe
// as &#x27;), which an earlier, stricter version of this regex silently
// dropped whole records for.
const RESULT_ROW_RE =
  /<a href="viewCaseForWebViewForm\.cfm\?CaseID=(\d+)">([^<]+)<\/a>&nbsp;<\/td>\s*<td valign="bottom" height="25">([^<]*)&nbsp;<\/td>\s*<td valign="bottom" height="25">([^<]*)&nbsp;<\/td>[\s\S]*?<td valign="top" colspan="4">&nbsp;&nbsp;&nbsp;([\s\S]*?)&nbsp;<\/td>[\s\S]*?<td valign="top" colspan="4">&nbsp;&nbsp;&nbsp;([\s\S]*?)&nbsp;<\/a>/g;

function parseCaseListPage(html: string): { records: CaseListRecord[]; totalRecords: number } {
  if (/No Cases Found/i.test(html)) return { records: [], totalRecords: 0 };
  const totalMatch = /Formal Case List\s*(?:&nbsp;)*\(([\d,]+) records\)/i.exec(html);
  if (!totalMatch) {
    throw new Error(
      "WV PSC WebDocket case-search response didn't contain a recognizable result count or \"No Cases Found\" — the page structure likely changed. Check parseCaseListPage in src/lib/ingest/wvPscDockets.ts against a fresh response.",
    );
  }
  const totalRecords = Number(totalMatch[1].replace(/,/g, ""));
  const records: CaseListRecord[] = [];
  for (const m of html.matchAll(RESULT_ROW_RE)) {
    records.push({
      caseId: m[1],
      caseNumber: stripTags(m[2]),
      filedDate: parseMDY(m[3]),
      applicant: stripTags(m[5]),
      description: stripTags(m[6]),
    });
  }
  if (totalRecords > 0 && records.length === 0) {
    throw new Error(
      "WV PSC WebDocket case-search response reported records but none were parsed — RESULT_ROW_RE likely no longer matches the page's row structure. Check parseCaseListPage in src/lib/ingest/wvPscDockets.ts against a fresh response.",
    );
  }
  return { records, totalRecords };
}

async function searchActiveCases(pattern: string): Promise<CaseListRecord[]> {
  const baseParams: Record<string, string> = {
    chkActiveCriteria: "1",
    txtCaseNumberOperator: "CONTAINS",
    txtCaseNumberCriteria: pattern,
    txtCaseNameOperator: "CONTAINS",
    txtCaseNameCriteria: "",
    memCaseDescrOperator: "CONTAINS",
    memCaseDescrCriteria: "",
    dteOriginalFilingOperator: "EQUAL",
    dteOriginalFilingCriteria: "",
    dteClosedOperator: "EQUAL",
    dteClosedCriteria: "",
    CountyOperator: "EQUAL",
    CountyCriteria: "",
    SortOrder: "1",
    CaseSearchFormSubmission: "Search",
  };

  async function fetchPage(page: number): Promise<{ records: CaseListRecord[]; totalRecords: number }> {
    const params = new URLSearchParams({ ...baseParams, Page: String(page) });
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`WV PSC WebDocket case search failed (${res.status}) for pattern "${pattern}" page ${page}`);
    }
    return parseCaseListPage(await res.text());
  }

  const first = await fetchPage(1);
  const all = [...first.records];
  const totalPages = Math.ceil(first.totalRecords / PAGE_SIZE);
  for (let page = 2; page <= totalPages; page++) {
    await sleep(REQUEST_DELAY_MS);
    const next = await fetchPage(page);
    all.push(...next.records);
  }
  return all;
}

type Resolution = "granted" | "denied" | "dismissed" | "closed-unclear" | null;

// See module header STATUS for how each pattern below was calibrated
// against real, live-confirmed WV PSC dockets (including a real denial and
// a real "false positive" that GRANT_RE/DENY_RE deliberately avoid).
const NO_CN_REQUIRED_RE = /does not require a certificate/i;
const DENY_RE = /\b(?:application|certificate)\b[\s\S]{0,150}?\bis\s+denied\b/i;
const GRANT_RE = /\b(?:certificate|application)\b[\s\S]{0,150}?\b(?:is\s+granted\b|are\s+granted\b|is\s+approved\b|issued\s+a\s+certificate\b)/i;
const DISMISS_RE = /\bdismisses?\s+the\s+case\b|\bcase\s+is\s+dismissed\b/i;
const CLOSED_FALLBACK_RE = /\bcase\s+final\b|\bremoving\s+from\s+open\s+docket\b/i;

// Matches each Order-type activity row's Activity Date + summary <p> text —
// see module header FETCHING. Confirmed live: rows come back most-recent
// activity first, so the FIRST regex match here is the docket's own latest
// Order-type activity.
const ORDER_ROW_RE =
  /<td valign="bottom" height="25">([^<]*)&nbsp;<\/td>\s*<td valign="bottom" height="25">Order&nbsp;<\/td>[\s\S]*?<p>([\s\S]*?)<\/p>/g;

async function fetchOrderTexts(caseNumber: string): Promise<string[]> {
  const params = new URLSearchParams({
    txtCaseNumberOperator: "EQUAL",
    txtCaseNumberCriteria: caseNumber,
    memActivitySummaryOperator: "CONTAINS",
    memActivitySummaryCriteria: "",
    txtActivityTypeOperator: "EQUAL",
    txtActivityTypeCriteria: "Order",
    MaxRecs: "100",
    SortOrder: "1",
  });
  const res = await fetch(`${ACTIVITY_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`WV PSC WebDocket activity search failed (${res.status}) for case ${caseNumber}`);
  const html = await res.text();
  const texts: string[] = [];
  for (const m of html.matchAll(ORDER_ROW_RE)) texts.push(stripTags(m[2]));
  return texts;
}

// Scans a case's Order-type activities, most-recent-first, for the first
// one carrying a resolving verdict — see module header STATUS.
function detectResolution(orderTexts: string[]): Resolution {
  for (const text of orderTexts) {
    if (NO_CN_REQUIRED_RE.test(text)) return "closed-unclear";
    if (DENY_RE.test(text)) return "denied";
    if (GRANT_RE.test(text)) return "granted";
    if (DISMISS_RE.test(text)) return "dismissed";
    if (CLOSED_FALLBACK_RE.test(text)) return "closed-unclear";
  }
  return null;
}

// See module header FUEL/PROJECT TYPE & CAPACITY.
const GENERATING_RE = /\bgenerat(?:e|ing|ion)\b|\bpower plant\b|\bcombined cycle\b|\bcombustion turbine\b/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;
const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b|\bswitchyard\b|\bswitching station\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/\bwind\s?power\b|\bwind\s+energy\b|\bwind\s+turbine/i, "wind_onshore"],
  [/\bnatural gas\b|\bgas[- ]fired\b|\bgas plant\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Picks whichever fuel keyword appears FIRST in the text (not the first
// entry in FUEL_KEYWORDS) — confirmed necessary against a real hybrid
// application, Case 26-0108-E-CN: "...an approximate 1200 MV combined
// cycle gas plant ... and to construct 70 MW of solar generation at three
// sites." A fixed-priority array checked in declaration order would tag
// this "solar" (whichever fuel happened to be listed first in
// FUEL_KEYWORDS) even though the plant is overwhelmingly gas by both
// capacity (1200 MW vs. 70 MW) and by being the technology named first in
// the caption; leftmost-in-text instead correctly tracks the caption's own
// emphasis and stays consistent with extractCapacityMw, which also returns
// the leftmost (here, the gas) figure.
function pickFuelType(description: string): FuelType | null {
  let best: { fuel: FuelType; index: number } | null = null;
  for (const [re, fuel] of FUEL_KEYWORDS) {
    const m = re.exec(description);
    if (m && (best === null || m.index < best.index)) best = { fuel, index: m.index };
  }
  return best ? best.fuel : null;
}

function inferProjectTypeAndFuel(description: string, applicant: string): { projectType: ProjectType; fuelType: FuelType } {
  if (GENERATING_RE.test(description)) {
    return { projectType: "generation", fuelType: pickFuelType(description) ?? "other" };
  }
  if (STORAGE_RE.test(description)) return { projectType: "storage", fuelType: "storage" };
  // Applicant name checked here (not above) — see module header gotcha
  // about Case 26-0075-E-CN's "NextEra Energy Transmission MidAtlantic"
  // applicant name being the only place "transmission" appears at all.
  if (TRANSMISSION_RE.test(description) || TRANSMISSION_RE.test(applicant)) {
    return { projectType: "transmission", fuelType: "transmission" };
  }
  // Real, confirmed gap: several genuine CN captions carry no
  // facility-type-revealing language at all. Transmission is the
  // plurality outcome among WV's real classifiable population — same
  // "plurality default" convention moPscDockets.ts documents.
  return { projectType: "transmission", fuelType: "other" };
}

// Real confirmed typo: Case 26-0108-E-CN's own caption says "1200 MV" where
// it means "1200 MW" — see module header. Matched as a known alias, not
// silently corrected.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*M[WV]\b/i;

function extractCapacityMw(description: string): number | null {
  const m = CAPACITY_RE.exec(description);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Confirmed live 2026-08-23 directly from WV PSC's own case-search form's
// County <select> dropdown (viewCaseForWebSearch.cfm) — all 55 real WV
// counties, used as a hardcoded whitelist rather than a bare
// capitalized-word regex. See module header for why (the greedy-regex
// hazard this series' Maryland module documented).
const WV_COUNTIES = [
  "Barbour", "Berkeley", "Boone", "Braxton", "Brooke", "Cabell", "Calhoun", "Clay", "Doddridge", "Fayette",
  "Gilmer", "Grant", "Greenbrier", "Hampshire", "Hancock", "Hardy", "Harrison", "Jackson", "Jefferson", "Kanawha",
  "Lewis", "Lincoln", "Logan", "Marion", "Marshall", "Mason", "McDowell", "Mercer", "Mineral", "Mingo",
  "Monongalia", "Monroe", "Morgan", "Nicholas", "Ohio", "Pendleton", "Pleasants", "Pocahontas", "Preston", "Putnam",
  "Raleigh", "Randolph", "Ritchie", "Roane", "Summers", "Taylor", "Tucker", "Tyler", "Upshur", "Wayne",
  "Webster", "Wetzel", "Wirt", "Wood", "Wyoming",
];
const WV_COUNTY_LOOKUP = new Map(WV_COUNTIES.map((c) => [c.toLowerCase(), c]));

// Captures a run of capitalized-word(s) joined by "and"/"&" immediately
// preceding "County"/"Counties", then each token is validated against the
// WV_COUNTIES whitelist — confirmed against real multi-county captions
// (e.g. "...in Greenbrier and Fayette Counties" and "...in Greenbrier
// County and Nicholas County...").
const COUNTY_PHRASE_RE = /([A-Z][A-Za-z]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z]+)*)\s+Count(?:y|ies)\b/g;

function extractCounties(description: string): string[] {
  const found: string[] = [];
  for (const m of description.matchAll(COUNTY_PHRASE_RE)) {
    for (const token of m[1].split(/\s+(?:and|&)\s+/)) {
      const canonical = WV_COUNTY_LOOKUP.get(token.trim().toLowerCase());
      if (canonical && !found.includes(canonical)) found.push(canonical);
    }
  }
  return found;
}

// See module header EXCLUDE_RE/CONTENT_RE — confirmed against every real
// active candidate as of 2026-08-23.
const CONTENT_RE = /\bcertificate\b/i;
const CONSTRUCTION_RE = /\bconstruct\b|\bconstruction\b|\brebuild\b|\bsiting\b|\bextension\b|\bgenerat|\btransmission\b/i;
const EXCLUDE_RE = /\bcooling tower\b|\bgeneral investigation\b/i;

function normalizeCase(record: CaseListRecord, docketLabel: string, resolution: Resolution): NormalizedProject {
  const matchKey = resolveMatchKey("wv-psc", record.caseNumber);
  const { projectType, fuelType } = inferProjectTypeAndFuel(record.description, record.applicant);
  const capacityMw = extractCapacityMw(record.description);
  const counties = extractCounties(record.description);
  const county = counties.length > 0 ? counties.join(", ") : null;

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "dismissed" || resolution === "closed-unclear") {
    currentStage = "cancelled";
  } else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    `Sourced from the West Virginia Public Service Commission's public WebDocket case search and case activity log (${docketLabel} dockets).`,
    "\"Still waiting\" here is primarily determined by the PSC's own case search \"Active\" status filter, cross-checked against the case's own Order-type activity log for a Commission Final Order or ALJ Recommended Decision granting/denying/dismissing the application — see the ingestion module header for how this was calibrated against real dockets, including a confirmed real denial and a confirmed false-positive (an unrelated attorney-admission motion also using the word \"granted\" in the same docket) that the resolution check is written to avoid.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the case caption text, not a structured field — not independently verified, and may reflect only one of several technologies named in a hybrid application (e.g. a combined gas-plus-solar filing).");
  }
  if (fuelType === "other" && projectType === "generation") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the case caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, West Virginia, per the case caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${record.applicant} (WV PSC Case ${record.caseNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "WV",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: record.filedDate,
    dateConfidence: "exact",
    applicant: record.applicant,
    currentStatus: `West Virginia PSC Case ${record.caseNumber}: ${resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a ${docketLabel} from the West Virginia Public Service Commission — Case No. ${record.caseNumber}, "${record.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `WV PSC Case No. ${record.caseNumber}`,
        url: DETAIL_URL(record.caseId),
      },
    ],
    externalIds: { wvPsc: record.caseNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestWvPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const perType = await Promise.all(DOCKET_TYPE_SOURCES.map((source) => searchActiveCases(source.pattern)));

  const byCaseNumber = new Map<string, { record: CaseListRecord; docketLabel: string }>();
  perType.forEach((records, i) => {
    for (const record of records) {
      if (!byCaseNumber.has(record.caseNumber)) {
        byCaseNumber.set(record.caseNumber, { record, docketLabel: DOCKET_TYPE_SOURCES[i].label });
      }
    }
  });
  const allCandidates = [...byCaseNumber.values()];

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let realApplicationCandidates = 0;

  const rotatedCandidates = selectWithRotation(allCandidates, maxCandidates, ROTATING_RECENT_SLOTS);
  const rotatingTier = new Set(rotatedCandidates.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  for (const entry of rotatedCandidates) {
    const { record, docketLabel } = entry;
    try {
      if (!CONTENT_RE.test(record.description) || !CONSTRUCTION_RE.test(record.description) || EXCLUDE_RE.test(record.description)) {
        // Not a real generation/storage/transmission construction project —
        // see module header EXCLUDE_RE/CONTENT_RE.
        continue;
      }
      realApplicationCandidates += 1;
      const orderTexts = await fetchOrderTexts(record.caseNumber);
      const resolution = detectResolution(orderTexts);
      const normalized = normalizeCase(record, docketLabel, resolution);
      toUpsert.push(normalized);
      if (rotatingTier.has(entry)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: record.caseNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a case whose
  // Active flag flips to Closed simply vanishes from `allCandidates`
  // above without this module ever learning its real resolution. Rather
  // than guess a specific resolved stage for it (which would now be
  // permanently visible and possibly wrong, since resolved-stage projects
  // are no longer deleted — see common.ts), this module deliberately does
  // nothing for a vanished case: its DB row is simply left at its
  // last-known real stage until/unless a future enhancement teaches this
  // module to look up a truly-vanished case's real outcome directly.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = allCandidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allCandidates.length,
    realApplicationCandidates,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestWvPscDockets()
    .then((summary) => {
      console.log(
        `West Virginia PSC docket ingestion complete: ${summary.candidatesFound} open candidates found, ` +
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
