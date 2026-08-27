// North Carolina Utilities Commission (NCUC) docket ingestion — one of
// several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23,
// picking up from a prior research session's findings — every claim below
// was independently re-verified via real requests before writing this
// module, per this project's standing practice, and one of those claims
// (see the STATUS/SCOPING gotchas) needed real correction, not just
// confirmation.
//
// FETCHING: starw1.ncuc.gov is a classic ASP.NET WebForms site behind
// Cloudflare, with no public JSON API (unlike AZ). Two portal pages matter:
//   - Dockets: POST /NCUC/page/Dockets/portal.aspx — a real docket search
//     with real captions and a real docket-TYPE taxonomy (see SCOPING).
//   - Orders: POST /NCUC/page/Orders/portal.aspx — a *separate* search
//     screen (not embedded in the docket detail page — see STATUS) that
//     can be scoped to one docket number and lists every order filed in it.
//
// CLOUDFLARE: confirmed — a bare request with no realistic header set (curl
// default User-Agent) gets Cloudflare's "Just a moment..." interstitial
// (HTTP 403, title "Just a moment..."). A browser-realistic header set
// (User-Agent, Accept, Accept-Language, Sec-Fetch-*) reliably gets through
// — confirmed against dozens of real requests in this session, from both
// curl and Node's own `fetch`. One real fragility found along the way,
// worth flagging even though it didn't block this module shipping: after
// roughly 40 rapid hand-verification requests in one research session
// (far more than one real ingestion run would ever make), Cloudflare
// started serving the same interstitial to *every* client regardless of
// headers — including curl, which had been working fine seconds before —
// with a `Cf-Mitigated: challenge` response header. That's a JS-executing
// challenge; neither curl nor Node's fetch can solve it, so once tripped,
// requests were flat blocked until the elevated-suspicion window passed on
// its own. A real ingestion run (one search + ~15-30 candidates, ~3
// requests each, 250ms apart) is a much lower, steadier request volume
// than that manual probing burst, but if this module ever starts seeing
// persistent 403s with `Cf-Mitigated: challenge`, that's what's happening —
// back off and retry later, don't retry in a tight loop.
//
// SESSION / VIEWSTATE MECHANICS (the real gotcha, confirmed by hand):
//   - A `GOVNCUC_SessionId` cookie (plus Cloudflare's own `__cf_bm`) is
//     set on the very first GET and must be echoed back (via a `Cookie`
//     header) on every subsequent request for the rest of the run.
//   - This is NOT standard ASP.NET ViewState: `__VIEWSTATE` is always sent
//     as an empty string, and the field that actually matters is a
//     custom `__VIEWSTATE1` hidden field — a small integer that the server
//     increments on every single postback (GET *or* POST) and that must be
//     echoed back exactly on the next request. Get it wrong (e.g. reuse a
//     stale value, or skip incrementing after a GET) and the postback
//     doesn't error — it just returns nonsense (see next point). This
//     module tracks the current `__VIEWSTATE1` value on every response and
//     threads it into every subsequent request (see `NcucSession`).
//   - Bigger, sharper gotcha, confirmed by direct A/B test: this
//     `__VIEWSTATE1` counter (and whatever server-side state it keys) is
//     tracked per *page URL*, not just per session. Doing a POST to
//     /page/Orders/portal.aspx right after a POST to
//     /page/Dockets/portal.aspx — even with the session cookie intact and
//     the freshest `__VIEWSTATE1` value correctly echoed — silently
//     returns the *previous page's* last-rendered content (confirmed: the
//     response's `<title>`/breadcrumb said "Orders" but the actual results
//     grid in the body was still the Dockets search grid from the prior
//     request). No error, no redirect, just the wrong page's HTML. The fix
//     (confirmed working): always do one fresh GET of the destination page
//     immediately after switching page URLs, before posting to it. Once
//     positioned on a page, repeated same-page postbacks (e.g. one Orders
//     search per candidate docket) work correctly back to back with no
//     re-GET needed between them — confirmed by chaining a
//     many-orders docket search, an explicit "Show All" postback, and a
//     different zero-orders docket search, all on the same page load,
//     and getting correct, uncontaminated results for each.
//   - Selecting the docket-type filter has its own two-step trap: the
//     `filingTypesList` multi-select is rendered `disabled="disabled"` by
//     the server until its own "Limit search to the selected docket types"
//     checkbox fires an auto-postback (`__EVENTTARGET` set to the
//     checkbox's unique ID) that re-renders the page with the list
//     enabled. Selections submitted in the *same* request as first
//     checking that box are silently ignored — the search runs as if no
//     type filter were applied at all (confirmed: posting
//     `filterByDocketTypeCheckBox=on` + two `filingTypesList` values
//     together in one shot returned ~10 assorted telecom/water dockets,
//     not a single EGC/ETL match). The working sequence is the toggle
//     postback first, then a second postback with the selections.
//
// SCOPING — real docket-type codes, a first for this series: the Dockets
// search form's `filingTypesList` <select> is North Carolina's own filing
// classification taxonomy, and two of its ~45 options are exact matches
// for what this site tracks, not keyword guesses: "EGC - Electric
// Generation Certificate" (guid 6cbd0771-a78f-40dd-bc00-bc007f6a00df) and
// "ETL - Electric Transmission Line Certificate" (guid
// c40f4c26-7a0d-459a-a1ea-14ffe6650e0f). Both were confirmed against real
// results before shipping: EGC-only search over 2016-2026 returned real
// generation CPCN applications (a 402 MW gas combustion-turbine plant, a
// 21 MW combined-heat-and-power facility, several solar+battery microgrid
// petitions, a 5 MW solar facility, a diesel-generator certificate) with
// zero off-topic results; ETL-only results were all real transmission/tap
// line CPCN applications. Because the type itself is a structured field
// (not inferred from caption text the way SC/AZ/TX have to), this module
// does NOT need a keyword-search-then-locally-filter pass the way those
// do — the type-filtered server-side search *is* the scope. A caption
// prefix check ("must start with Application/Petition") was tried as extra
// defense-in-depth and then dropped: confirmed against a real candidate
// (EC-52 Sub 48, "Certificate of Environmental Compatibility and Public
// Convenience for a 230kV Tap Line...") that it produces a false negative
// — a real, correctly ETL-typed CPCN docket whose caption simply doesn't
// use the "Application of X for a..." preamble most others do. The
// server-side type filter is trusted as the sole scope signal instead.
// Real volume, confirmed by hand: an 8-year EGC+ETL search
// (01/01/2018-08/23/2026) returned ~21-30 candidates (3 pages of the
// search grid's 10-per-page default) — comfortably inside MAX_CANDIDATES.
//
// STATUS — real correction to the prior research's claim that docket
// status was "a real structured field, found on each docket's detail
// page": the docket detail page's `statusLabel` field ("Open"/"Closed")
// exists, but confirmed unreliable the same way SC's and AZ's status
// fields were: docket E-7 Sub 1134 (a 402 MW gas CT CPCN filed 1/12/2017)
// still reads Status="Open" on its detail page even though its Orders
// history (fetched separately, see below) shows "Order Issuing Certificate
// of Public Convenience and Necessity with Conditions" from years earlier
// — the docket just stayed procedurally open afterward for unrelated
// later rate/compliance filings under the same docket number. (Contrast:
// docket E-2 Sub 1347, resolved quickly via a single "Order Waiving Notice
// and Hearing Requirement and Issuing Certificate", correctly shows
// Status="Closed" — so the field isn't universally wrong, just not
// trustworthy evidence of resolution either way, so this module never
// reads it.) There is also no per-docket "Orders" tab on the detail page
// the way SC has (its "Companies Involved" list is similarly unreliable —
// observed to list a dozen boilerplate/unrelated entities like "Generic
// Electric" and "Docket Skipped" on one docket, a single correct company
// on another — not used here). The real signal, confirmed against three
// real cases, is a *separate* search of the Orders portal scoped to the
// docket number:
//   - No orders at all ("** NO RESULTS FOUND **", confirmed on docket
//     EC-58 Sub 42, filed 6/3/2026, ~2.5 months old at research time):
//     still pending.
//   - An order whose title matches GRANT_RE ("granting"/"issuing" within
//     ~40 chars of "certificate" — confirmed on E-7 Sub 1134's "Order
//     Issuing Certificate of Public Convenience and Necessity with
//     Conditions", E-2 Sub 1347's "...Issuing Certificate", and EMP-114
//     Sub 0's "Order Issuing Certificate for Merchant Generating
//     Facility"): resolved as granted.
//   - An order matching DENY_RE ("denying" within ~40 chars of
//     "certificate", excluding "...at this time" — see below): resolved as
//     cancelled. No real denial was found among the EGC/ETL candidates
//     sampled by hand (same as AZ's DENY_RE caveat — best-effort, not
//     confirmed against an in-scope example), so this was calibrated
//     against real denial orders found via a broader full-text order
//     search instead: "Order Denying Certificate of Authority" (WR-644
//     Sub 3), "Recommended Order Denying Certificate" (P-665 Sub 0),
//     "Order Denying Certificate, Motion for Preliminary & Permanent
//     Injunctive Relief & Granting Transfer" (W-1063 Sub 0). That same
//     search also surfaced a real trap the exclusion clause exists for:
//     "Recommended Order Denying Certificate At This Time But Holding
//     Docket Open" (seen on three different SP- water dockets) is
//     explicitly *not* a final resolution — the docket stays open pending
//     further filings — so DENY_RE requires "certificate" NOT to be
//     immediately followed by "at this time".
//   - Orders exist but none match either pattern (extensions, intervenor
//     rulings, scheduling orders, etc.): treated as still pending, same as
//     no orders at all.
//   Docket histories longer than the Orders search's default page size
//   need an explicit "Show All" postback to see every order (confirmed:
//   E-7 Sub 1134 has 23 orders, only ~11 shown before clicking Show All;
//   the real granting order was near the end of the full list) — this
//   module always requests Show All whenever any orders are found, rather
//   than trying to detect whether pagination is needed.
//
// FUEL/PROJECT TYPE, CAPACITY, COUNTY, APPLICANT: not structured fields,
// extracted from the caption text with the same regex approach and caveats
// as SC/AZ. Capacity in particular sometimes reflects a tap line's load
// *threshold* ("Tap Line Over 80MW") rather than a generator's nameplate
// capacity — flagged in dataQualityNote like every other approximate
// figure in this series, not specially distinguished.
//
// NOT WIRED TO CRON YET, same as the other per-state modules. Also
// politeness-delayed between per-candidate Orders requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://starw1.ncuc.gov";
const DOCKETS_URL = `${BASE_URL}/NCUC/page/Dockets/portal.aspx`;
const ORDERS_URL = `${BASE_URL}/NCUC/page/Orders/portal.aspx`;

const DOCKET_CTRL = "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl86$DocketSearchControlNCUC1";
const ORDER_CTRL = "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl86$PSCOrderParamFullTextSearchControl1";

// Confirmed against the search form's real <option> list — see module
// header SCOPING.
const FILING_TYPE_EGC = "6cbd0771-a78f-40dd-bc00-bc007f6a00df"; // Electric Generation Certificate
const FILING_TYPE_ETL = "c40f4c26-7a0d-459a-a1ea-14ffe6650e0f"; // Electric Transmission Line Certificate

export const MAX_CANDIDATES = 100;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
const LOOKBACK_YEARS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as scPscDockets.ts, not a full HTML-entity library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

// "5/1/2026" — M/D/YYYY, not zero-padded in real responses.
function parseShortDate(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Browser-realistic header set — confirmed required to get past Cloudflare
// (see module header). Sec-Fetch-Site varies by call site.
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

type FormFields = [string, string][];

function buildBody(fields: FormFields): string {
  const params = new URLSearchParams();
  for (const [k, v] of fields) params.append(k, v);
  return params.toString();
}

const VIEWSTATE1_RE = /__VIEWSTATE1" id="__VIEWSTATE1" value="([^"]*)"/;

function extractViewState1(html: string): string {
  const m = VIEWSTATE1_RE.exec(html);
  if (!m) {
    throw new Error(
      "NCUC page didn't contain the expected __VIEWSTATE1 hidden field — either the page structure changed, or this is a Cloudflare challenge page (check for 'Just a moment...' / Cf-Mitigated). Check src/lib/ingest/ncNcucDockets.ts against a fresh response.",
    );
  }
  return m[1];
}

// Bundles the tiny hand-rolled cookie jar and the __VIEWSTATE1 counter that
// NCUC's postback engine requires on every request — see module header
// SESSION / VIEWSTATE MECHANICS. `get()` must be used (not `post()`) every
// time the session switches to a different page URL, or the response
// silently contains the previous page's stale content.
class NcucSession {
  private cookies = new Map<string, string>();
  private viewState1 = "1";

  private applySetCookie(res: Response): void {
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const pair = raw.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private cookieHeader(): string | undefined {
    return this.cookies.size > 0 ? [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ") : undefined;
  }

  async get(url: string): Promise<string> {
    const cookie = this.cookieHeader();
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": cookie ? "same-origin" : "none",
        "Sec-Fetch-User": "?1",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    this.applySetCookie(res);
    if (!res.ok) throw new Error(`NCUC GET failed (${res.status}): ${url}`);
    const html = await res.text();
    this.viewState1 = extractViewState1(html);
    return html;
  }

  /** `eventTarget` is the ASP.NET __EVENTTARGET — required for auto-postback
   * controls (checkboxes, pager links), empty for a normal button submit. */
  async post(url: string, eventTarget: string, fields: FormFields): Promise<string> {
    const body = buildBody([
      ["__EVENTTARGET", eventTarget],
      ["__EVENTARGUMENT", ""],
      ["__VIEWSTATE1", this.viewState1],
      ["__VIEWSTATE", ""],
      ...fields,
    ]);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: BASE_URL,
        Referer: url,
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() as string } : {}),
      },
      body,
    });
    this.applySetCookie(res);
    if (!res.ok) throw new Error(`NCUC POST failed (${res.status}): ${url}`);
    const html = await res.text();
    this.viewState1 = extractViewState1(html);
    return html;
  }
}

interface DocketCandidate {
  docketId: string;
  docketNumber: string;
  caption: string;
  filedDate: Date | null;
}

// Matches one search-result row: docket link (DocketId + docket number),
// then the caption `<td>`, then (skipping a spacer row) the Date Filed
// span. Confirmed against real responses 2026-08-23.
const RESULT_ROW_RE =
  /hDocketLink" href="https:\/\/starw1\.ncuc\.gov\/NCUC\/PSC\/DocketDetails\.aspx\?DocketId=([0-9a-f-]+)">([^<]+)<\/a>[\s\S]{0,300}?<td class="width-full">([^<]*)<\/td>[\s\S]{0,500}?Date Filed:<\/span>\s*([\d/]+)/g;

export function parseSearchResults(html: string): DocketCandidate[] {
  const out: DocketCandidate[] = [];
  for (const m of html.matchAll(RESULT_ROW_RE)) {
    out.push({
      docketId: m[1],
      docketNumber: decodeHtmlEntities(m[2]),
      caption: decodeHtmlEntities(m[3]),
      filedDate: parseShortDate(m[4]),
    });
  }
  if (out.length === 0 && /resultsGrid/.test(html)) {
    throw new Error(
      "NCUC docket search returned a results grid but parseSearchResults matched zero rows — the row structure likely changed. Check RESULT_ROW_RE in src/lib/ingest/ncNcucDockets.ts against a fresh response.",
    );
  }
  return out;
}

// Pager links list every OTHER page (not the current one), HTML-entity
// quoted — confirmed against a real 3-page (21-30 candidate) result set.
const PAGE_TARGET_RE = /__doPostBack\(&#39;([^&]*\$resultsGrid\$ctl14\$ctl\d+)&#39;/g;

function extractPageTargets(html: string): string[] {
  return [...html.matchAll(PAGE_TARGET_RE)].map((m) => m[1]);
}

async function searchCandidates(session: NcucSession): Promise<DocketCandidate[]> {
  await session.get(DOCKETS_URL);

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);
  const dateFields: FormFields = [
    [`${DOCKET_CTRL}$filedOnOrAfterTextBox`, formatDate(cutoff)],
    [`${DOCKET_CTRL}$filedOnOrBeforeTextBox`, formatDate(new Date())],
    [`${DOCKET_CTRL}$docketNumberTextBox`, ""],
    [`${DOCKET_CTRL}$companyNameTextBox`, ""],
  ];

  // Step 1: toggle "Limit search to the selected docket types" — required
  // before filingTypesList selections are honored. See module header
  // SESSION / VIEWSTATE MECHANICS.
  await session.post(DOCKETS_URL, `${DOCKET_CTRL}$filterByDocketTypeCheckBox`, [
    ...dateFields,
    [`${DOCKET_CTRL}$filterByDocketTypeCheckBox`, "on"],
  ]);

  // Step 2: the real search, now that filingTypesList is enabled.
  const page1 = await session.post(DOCKETS_URL, "", [
    ...dateFields,
    [`${DOCKET_CTRL}$filterByDocketTypeCheckBox`, "on"],
    [`${DOCKET_CTRL}$filingTypesList`, FILING_TYPE_EGC],
    [`${DOCKET_CTRL}$filingTypesList`, FILING_TYPE_ETL],
    [`${DOCKET_CTRL}$searchButton`, "Search"],
  ]);

  const results = parseSearchResults(page1);
  for (const target of extractPageTargets(page1)) {
    const pageHtml = await session.post(DOCKETS_URL, target, [
      ...dateFields,
      [`${DOCKET_CTRL}$filterByDocketTypeCheckBox`, "on"],
      [`${DOCKET_CTRL}$filingTypesList`, FILING_TYPE_EGC],
      [`${DOCKET_CTRL}$filingTypesList`, FILING_TYPE_ETL],
    ]);
    results.push(...parseSearchResults(pageHtml));
    await sleep(REQUEST_DELAY_MS);
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.docketId)) return false;
    seen.add(r.docketId);
    return true;
  });
}

interface DocketResolution {
  resolution: "granted" | "denied" | null;
}

// See module header STATUS. Requires "certificate" within ~40 chars of
// "granting"/"issuing" — confirmed against real granting orders.
const GRANT_RE = /\b(?:granting|issuing)\b[\s\S]{0,40}\bcertificate/i;
// Requires "certificate" within ~40 chars of "denying", but not
// immediately followed by "at this time" — see module header STATUS for
// the real "Recommended Order Denying Certificate At This Time But
// Holding Docket Open" case this excludes.
const DENY_RE = /\bdenying\b[\s\S]{0,40}\bcertificate\b(?!\s+at this time)/i;

async function fetchResolution(session: NcucSession, docketNumber: string): Promise<DocketResolution> {
  // Fresh GET required here even on an already-open session — switching
  // page URLs (Dockets -> Orders) without one returns the previous page's
  // stale content. See module header SESSION / VIEWSTATE MECHANICS.
  await session.get(ORDERS_URL);

  const searchHtml = await session.post(ORDERS_URL, "", [
    [`${ORDER_CTRL}$searchPhraseTextBox`, ""],
    [`${ORDER_CTRL}$orderNumberTextBox`, ""],
    [`${ORDER_CTRL}$docketNumberTextBox`, docketNumber],
    [`${ORDER_CTRL}$orderReceivedOnOrAfterTextBox`, ""],
    [`${ORDER_CTRL}$orderReceivedOnOrBeforeTextBox`, ""],
    [`${ORDER_CTRL}$companyNameTextBox`, ""],
    [`${ORDER_CTRL}$SearchButton`, "Search"],
  ]);

  if (/NO RESULTS FOUND/i.test(searchHtml)) return { resolution: null };

  // Always fetch the full order list — a docket's default first page can
  // omit the order that actually resolved it. See module header STATUS.
  let html = searchHtml;
  if (/searchResultsData\$ShowAllButton/.test(searchHtml)) {
    html = await session.post(ORDERS_URL, "", [[`${ORDER_CTRL}$searchResultsData$ShowAllButton`, "Show All"]]);
  }

  const descriptions = [...html.matchAll(/docDescLabel">([^<]*)</g)].map((m) => decodeHtmlEntities(m[1]));
  if (descriptions.length === 0) {
    throw new Error(
      `NCUC orders search for docket ${docketNumber} returned neither "NO RESULTS FOUND" nor any order descriptions — the page structure likely changed. Check fetchResolution in src/lib/ingest/ncNcucDockets.ts against a fresh response.`,
    );
  }

  // Descriptions are listed newest-first — take the first (i.e. most
  // recent) matching signal as authoritative.
  for (const desc of descriptions) {
    if (DENY_RE.test(desc)) return { resolution: "denied" };
    if (GRANT_RE.test(desc)) return { resolution: "granted" };
  }
  return { resolution: null };
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(battery|storage|bess)\b/i, "storage"],
  [/\b(combined cycle|combustion turbine|natural gas|gas-fired)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Checked before any fuel keyword, same reasoning as the other regex-based
// sources in this series: a transmission/tap line's own route/voltage
// shouldn't be misread as a generation fuel. NC's ETL captions
// consistently say "Transmission Line" or "Tap Line" — confirmed against
// every real ETL-type result sampled by hand.
const TRANSMISSION_RE = /\btransmission line\b|\btap line\b/i;
const STORAGE_RE = /\bbattery\b|\bstorage\b|\bbess\b/i;

function inferProjectType(caption: string): ProjectType {
  if (TRANSMISSION_RE.test(caption)) return "transmission";
  if (STORAGE_RE.test(caption)) return "storage";
  return "generation";
}

function inferFuelType(caption: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(caption)) return fuel;
  }
  return "other";
}

function extractCapacityMw(caption: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW(?:ac)?\b/i.exec(caption);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Handles both "...in Lincoln County" (no state suffix) and "...in
// Chatham County, North Carolina" (the trailing state name, if present,
// falls outside the captured group either way) — confirmed against real
// captions of both forms. Falls back to the abbreviated "...Co." form seen
// on a handful of real captions.
function extractCounty(caption: string): string | null {
  const m = /\bin\s+([A-Z][A-Za-z.'\s]*?)\s+Count(?:y|ies)\b/i.exec(caption);
  if (m) return m[1].trim();
  const abbrev = /\bin\s+([A-Z][A-Za-z.'\s]*?)\s+Co\./i.exec(caption);
  return abbrev ? abbrev[1].trim() : null;
}

// Handles "Application of X for a Certificate...", "Petition of X for a
// Certificate...", and "CPCN for Application of X for a Certificate..."
// (a real prefix variant seen in NC captions) — confirmed against real
// captions. Many real captions never name an applicant at all ("Petition
// for CPCN for Microgrid Solar & Battery Storage Facility Located on..."),
// in which case this returns null and the caller falls back to the
// caption text itself, same as scPscDockets.ts.
function extractApplicant(caption: string): string | null {
  const m = /^(?:CPCN\s+for\s+)?(?:Joint\s+)?(?:Application|Petition)\s+of\s+(?:the\s+)?(.+?)\s+for\s+a\s+Certificate/i.exec(
    caption,
  );
  return m ? m[1].trim() : null;
}

function normalizeDocket(candidate: DocketCandidate, resolution: DocketResolution): NormalizedProject {
  const matchKey = resolveMatchKey("nc-ncuc", candidate.docketNumber);
  const projectType = inferProjectType(candidate.caption);
  const fuelType = inferFuelType(candidate.caption, projectType);
  const capacityMw = extractCapacityMw(candidate.caption);
  const county = extractCounty(candidate.caption);
  const applicant = extractApplicant(candidate.caption) ?? candidate.caption.slice(0, 80);

  let currentStage: ProjectStage;
  if (resolution.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution.resolution === "denied") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the North Carolina Utilities Commission's public eDocket system (Dockets and Orders search).",
    'The docket\'s own "Status" field on the docket detail page is not reliable evidence of resolution (observed to still read "Open" on a docket whose certificate had been granted years earlier, apparently because the same docket number stayed procedurally active for unrelated later filings); "still waiting" here is instead inferred by searching the Commission\'s separate Orders database for this docket number and scanning order titles for a granting/denying signal — see the ingestion module header for how this was calibrated.',
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push(
      "Capacity figure is parsed from the docket caption text, not a structured field — not independently verified, and for transmission/tap-line dockets may reflect a load threshold rather than generation capacity.",
    );
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(
      `Located in ${county} County, North Carolina, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`,
    );
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (NC NCUC Docket ${candidate.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "NC",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: candidate.filedDate,
    dateConfidence: "exact",
    currentStatus: `North Carolina NCUC docket ${candidate.docketNumber}: ${resolution.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Environmental Compatibility and Public Convenience and Necessity from the North Carolina Utilities Commission — Docket No. ${candidate.docketNumber}, "${candidate.caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `NC NCUC Docket No. ${candidate.docketNumber}`,
        url: `${BASE_URL}/NCUC/PSC/DocketDetails.aspx?DocketId=${candidate.docketId}`,
      },
    ],
    externalIds: { ncNcuc: candidate.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  processedCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestNcNcucDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const session = new NcucSession();
  const allCandidates = await searchCandidates(session);
  const candidates = selectWithRotation(allCandidates, maxCandidates, ROTATING_RECENT_SLOTS);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const resolution = await fetchResolution(session, candidate.docketNumber);
      toUpsert.push(normalizeDocket(candidate, resolution));
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
    processedCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestNcNcucDockets()
    .then((summary) => {
      console.log(
        `North Carolina NCUC docket ingestion complete: ${summary.candidatesFound} EGC/ETL candidates found, ` +
          `${summary.processedCandidates} processed, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
