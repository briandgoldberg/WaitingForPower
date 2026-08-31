// Alabama Public Service Commission (PSC) Certificate of Convenience and
// Necessity (CCN/CPCN, Ala. Code §37-4-28) docket ingestion — one of several
// states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-24 via real HTTP requests (curl, no headless
// browser) against the live pscpublicaccess.alabama.gov site — no
// assumption below was taken from documentation or training-data memory
// alone.
//
// SCOPING: Ala. Code §37-4-28 requires "written application ... for the
// issuance of a certificate of convenience and necessity" before any new
// "plant, property or facility for the production, transmission, delivery
// or furnishing of gas, electricity, water or steam" may be constructed —
// confirmed by hand against the statute text. Unlike most states in this
// series, Alabama's CPCN statute is NOT electric-specific: the same filing
// type covers electric, gas, water, and steam utilities, and (confirmed
// live) the exact phrase "CERTIFICATE OF CONVENIENCE AND NECESSITY" also
// appears throughout unrelated telecommunications-CLEC-certificate and
// enforcement/investigation dockets that happen to reuse the same generic
// term. There is no dedicated "electric CPCN only" docket-number series or
// case-code the way KY/WV/etc. have — Alabama's docket numbers are a single
// flat sequence shared by every division (electric, gas, telecom,
// transportation, administrative). A "Filing Type" facet named "Energy -
// PETITION FOR CERTIFICATED NEW PLANT OR PURCHASE POWER AGREEMENT" DOES
// exist in the site's own document-search filing-type list (confirmed live:
// value 56c6e98c-2989-4b60-9667-e92cf3451d3c) and is exactly the right
// concept, but ATTEMPTING TO USE IT IS A CONFIRMED DEAD END — see FETCHING
// below. This module instead full-text-searches the CPCN phrase itself
// (broad, noisy) and applies client-side keyword filtering (ELECTRIC_RE /
// EXCLUDE_RE below) to keep only real electric generation/storage/
// transmission candidates, defaulting to EXCLUDE any candidate that doesn't
// carry a clear positive electric signal — confirmed necessary by a real
// false-positive: Docket 29120 ("INVESTIGATION OF OPERATIONS" / synopsis
// "REQUEST A CERTIFICATE OF CONVEYANCE AND NECESSITY" — note the real typo,
// "CONVEYANCE" for "CONVENIENCE", matched as a known alias below, not
// silently corrected) is an enforcement/delinquency sweep touching a
// telecom CLEC and a water system, with zero electric content, yet matches
// the CPCN phrase search.
//
// FETCHING: pscpublicaccess.alabama.gov/pscpublicaccess is an ASP.NET
// WebForms "ACOIS" public-access portal. Confirmed by hand: no auth wall,
// no CAPTCHA anywhere in this flow — every page here is reachable by a
// bare, unauthenticated `fetch()` (Google itself has indexed individual
// DocketDetailsPage.aspx/PSCDocumentDetailsPage.aspx URLs, confirmed via a
// live web search). However this app is NOT the stateless-postback style
// seen in wvPscDockets.ts/mdPscDockets.ts: its own `__VIEWSTATE` hidden
// field is always a literal empty string (ViewState is disabled), yet the
// search UI is still genuinely stateful — state is tracked server-side via
// the ASP.NET_SessionId cookie. Concretely: the search portal
// (page/psc-searches/portal.aspx) offers four search types via a radio
// group; switching from the default "Document Search" to the "Full-Text
// Parameterized Search" control requires an actual `__EVENTTARGET`-driven
// postback (confirmed live) that only takes effect for the SAME session
// cookie's subsequent requests — a single one-shot POST that both selects
// the control and submits a query in the same request is silently ignored
// (the server re-renders the default control instead). This module
// therefore does a real 2-step session dance per run: (1) GET portal.aspx
// to mint a session cookie, (2) POST with __EVENTTARGET targeting
// `searchesDropDownList$2` to switch that session onto the "Full-Text
// Parameterized Search" control (confirmed live: the response's own search
// form then reflects that control's fields), then (3) issue every actual
// search as a POST carrying that same session cookie.
//   CONFIRMED DEAD END — the site's own "Limit search to selected filing
//   types"/"Limit search to selected document types" checkbox+multiselect
//   filters (present on both the plain Document Search and the Full-Text
//   Parameterized Search controls) LOOK like they'd let this module search
//   directly for filing type "Energy - PETITION FOR CERTIFICATED NEW PLANT
//   OR PURCHASE POWER AGREEMENT", scoping straight to electric CPCN
//   petitions. Confirmed live this does not work: the multiselect renders
//   `disabled="disabled"` until a dedicated `__EVENTTARGET` postback on the
//   checkbox itself "enables" it (confirmed: the returned HTML then drops
//   the `disabled` attribute) — but even after that two-step dance, POSTing
//   a selected filing-type value alongside the checkbox produces IDENTICAL
//   results (byte-for-byte, aside from an internal postback counter) to not
//   filtering at all: the selected `<option>` is never echoed back as
//   `selected="selected"`, proving the server silently drops the submitted
//   selection. Not used by this module.
//   CONFIRMED LIVE SERVER BUG — a plain, unfiltered (no search phrase)
//   document search restricted only by a filed-date range throws a real
//   HTTP 500 ("System.ArgumentException: These columns don't currently
//   have unique values", stack trace naming
//   `ACOIS.PSC.BusinessObjects.PublicAccess.DocumentFileSearchDataProvider`
//   — a DataTable primary-key collision in APSC's own backend) for wide
//   date spans, and even for some narrow ones — confirmed live: a range
//   covering all of calendar year 2018 alone throws every time, while 2017
//   and 2019 alone do not. This is real, load-bearing signal, not a fluke
//   of one bad request: it reproduced identically across multiple fresh
//   sessions. This module never does a bare unfiltered date-range document
//   search for this reason — every search below always carries the
//   "CERTIFICATE OF CONVENIENCE AND NECESSITY" phrase filter, which
//   confirmed-live never triggers this bug even across a full 26-year span
//   (2000-01-01 through the run date, phrase-filtered, returned HTTP 200
//   with 146 real items) — the narrowed result set the phrase produces
//   evidently avoids whatever duplicate-key condition the bug depends on.
//   As defense in depth this module still treats any 500 response (or a
//   response containing the "columns don't currently have unique values"
//   text) as a hard error to surface, never silently swallowed.
//   CONFIRMED PAGINATION DEAD END (this control only) — the Full-Text
//   Parameterized Search results grid has real numbered page links
//   (`resultsGrid$ctl14$ctl0N`, not the `Page$N` style seen elsewhere in
//   this same app), but replaying that postback via direct POST could not
//   be made to work: every attempt (with or without re-sending the
//   search-type radio field) returned the blank/reset search form rather
//   than page 2 of results, across several variations. WORKED AROUND
//   instead of relying on server-side pagination: the search's own
//   `filedOnOrAfterTextBox`/`filedOnOrBeforeTextBox` date-range fields DO
//   reliably narrow the phrase-search result set (confirmed live: a
//   filed-in-2099 range returns zero items; single real years return item
//   counts from 1 to 27) and each page only ever renders the first 10
//   items ("Items Count: N" is the TRUE total, independent of how many rows
//   actually render). So `searchPhraseRange` below recursively bisects any
//   date window whose real Items Count exceeds 10 into two halves and
//   retries each half, down to a documented depth cap, rather than ever
//   trying to page a single search's results.
//   CONFIRMED WORKING PAGINATION (a different control) — the per-docket
//   Documents tab (page/docket-docs/PSC/DocketDetails.aspx?DocketId=...)
//   uses an ordinary GridView pager with the `Page$N` EVENTARGUMENT style,
//   and replaying THIS one via `__EVENTTARGET=...documentsGridView` +
//   `__EVENTARGUMENT=Page$N` on the same session cookie does work —
//   confirmed live against Docket 32953 (a heavily-litigated real CPCN
//   case with 10 document-list pages): page 2 returned genuinely different
//   documents than page 1. Used by fetchDocketDocuments below.
//
// STATUS: DocketDetailsPage.aspx has a literal "Status:" field (values seen
// live: "Open") — but IT IS CONFIRMED UNRELIABLE, never trusted alone, the
// same lesson this series has learned state after state in a new shape
// here. Every one of more than a dozen real dockets checked by hand shows
// Status="Open" regardless of true age or resolution — including dockets
// opened in 2005, 2007, 2009, and 2011 (Docket 31736, a CPCN for power
// lines filed by Walter Energy, Inc., a coal company that went bankrupt in
// 2015-2016 — this docket cannot plausibly still be "open" a decade later)
// AND, most conclusively, Docket 33513 (Alabama Power's real, current
// "Lindsay Hill Generating Station" acquisition CPCN, opened 10/30/2024):
// its own Documents tab carries a real Commission "ORDER GRANTING ALABAMA
// POWER COMPANY'S PETITION FOR CERTIFICATE OF PUBLIC CONVIENCE AND
// NECESSITY FOR LINDSAY HILL GENERATING STATION" (note the real source
// typo, "CONVIENCE" for "CONVENIENCE" — matched as a known alias in
// GRANT_RE below, not silently corrected) dated August 13, 2025 (confirmed
// via a companion "NOTICE OF ERRATA" document referencing that date) — yet
// DocketDetailsPage.aspx still reports Status="Open" for this docket as of
// this writing, over a year after it was actually granted. No "Closed"
// status value was ever observed across the whole sample, for whatever
// that's worth. Resolution is instead inferred, same as mdPscDockets.ts/
// ctCscDockets.ts, by scanning the docket's own Documents tab for an
// Order-class document whose title carries a dispositive verdict.
//   GRANT_RE: confirmed live via Docket 33513's real grant order (above).
//   DENY_RE: UNDER-CONFIRMED, same standing gap this series has documented
//   for several other states (e.g. mdPscDockets.ts, wvPscDockets.ts) — a
//   full-text search for "CERTIFICATE OF CONVENIENCE AND NECESSITY" AND
//   "DENYING" across Alabama's entire history returned 8 real hits, and
//   every one is a telecom formal-complaint case where "denying" refers to
//   denying an unrelated MOTION (e.g. a motion to dismiss), not a CPCN
//   application itself — zero real electric/gas/water CPCN denials exist
//   anywhere in the current population to calibrate DENY_RE against.
//   WITHDRAW_RE: modeled the same way mdPscDockets.ts's WITHDRAW_APPLICATION_RE
//   is, not yet confirmed live against a real Alabama withdrawal (none
//   turned up in the small real candidate population this module found —
//   kept as a documented, plausible, unconfirmed pattern rather than
//   omitted outright).
//
// FUEL/PROJECT TYPE & CAPACITY: Alabama Power Company is, by design of the
// state's 1984 Territorial Act, effectively the sole investor-owned
// electric utility that ever files a real generation/transmission CPCN —
// confirmed by hand across every real electric candidate found (Docket
// 33513 Lindsay Hill Generating Station acquisition, Docket 32382 and
// Docket 27785 general/purchased-power CPCNs, Docket 31301 "small-scale
// renewable energy and environmentally specialized generating resources").
// The one non-utility real candidate, Docket 31736 (Walter Energy, Inc. —
// a coal-mining company, not an electric utility), sought a CPCN "for the
// purpose of constructing, maintaining, operating ... power lines and
// appurtenant facilities" — a real transmission project whose DESCRIPTION
// field alone says nothing about power at all ("...FOR WALTER ENERGY,
// INC., AND BARBARA FRANKLIN HIGGINS"); only its SYNOPSIS field mentions
// "power lines". inferProjectTypeAndFuel below therefore always checks
// description + synopsis together, not description alone — the same
// "richer prose available" reasoning ctCscDockets.ts documents for its own
// candidates. Alabama Power CPCN captions rarely name a specific capacity
// or fuel/technology at all (most just say "...FOR ALABAMA POWER COMPANY"
// with the real technical detail buried in the underlying PDF petition,
// never fetched here — matching this series' standing PDF-avoidance
// convention); CAPACITY_RE and FUEL_KEYWORDS are kept for the real cases
// that do state one (e.g. Docket 33513's "GENERATING STATION" wording), but
// most candidates fall back to fuelType "other" with a dataQualityNote,
// same as kyPscDockets.ts's own thin-population caveat.
//
// County: extracted from a hardcoded whitelist of Alabama's 67 counties
// (standard, stable public list — not itself something that needed a live
// HTTP confirmation the way a site-specific dropdown would) rather than a
// free-form "capitalized words before COUNTY" regex — the exact
// greedy-regex hazard this series' Maryland module documented for its own
// county extraction. Confirmed live against Docket 33513's real caption
// ("...LOCATED IN AUTAUGA COUNTY, ALABAMA").
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): the classic shape this
// series documented (a candidate QUERY scoped to an "Active"/"Pending"
// status filter, so a resolved docket vanishes from the query before its
// new status is ever observed) does not apply here — `discoverCandidates`
// always re-scans the full LOOKBACK_YEARS window by FILED DATE, not
// status, so a previously-tracked docket is found again every run
// regardless of its outcome. A DIFFERENT real path to the same "stale row
// frozen forever" outcome was found live during this module's own
// development (this project's mandatory full live-DB-verification step,
// not a hypothetical): the first working version's content classification
// was too loose (see SCOPING's REQUEST_RE discussion) and upserted two
// real false positives before REQUEST_RE/PROCEDURAL_EXCLUDE_RE were
// tightened to correctly reject them — at which point they'd have frozen
// in the DB with no code path ever revisiting them. Originally fixed by
// pushing a resolved stub (guessing currentStage="cancelled") for any
// previously-tracked matchKey this run positively rejected by content
// filtering, so common.ts would delete it. That fix is now itself
// superseded: common.ts no longer deletes resolved-stage projects (they're
// kept and surfaced through the frontend's Status filter), so guessing
// "cancelled" would mean permanently mislabeling a docket that might
// actually be granted, in a bucket real users can now see. A docket that
// fails this run's content classification is therefore left untouched —
// not guessed into a resolved stage — the same call wvPscDockets.ts's
// header documents for its own superseded fix.
//
// Wired to Vercel Cron weekly, 09:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-al-psc/route.ts). Real full-population timing
// measured 2026-08-24 against the live shared DB (phrase-search discovery
// across the full LOOKBACK_YEARS window, the RECENT_MONTHS company-scoped
// supplemental discovery bisected down to single-day granularity where
// needed, per-candidate docket-detail + paginated-documents fetches, all
// at this series' standard 250ms politeness delay): ~132s — comfortably
// inside a 300s cron budget.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://www.pscpublicaccess.alabama.gov/pscpublicaccess";
const PORTAL_URL = `${BASE_URL}/page/psc-searches/portal.aspx`;
const DOCKET_DETAILS_URL = (docketId: string) => `${BASE_URL}/PSC/DocketDetailsPage.aspx?DocketId=${docketId}`;
const DOCKET_DOCS_URL = (docketId: string) => `${BASE_URL}/page/docket-docs/PSC/DocketDetails.aspx?DocketId=${docketId}`;

const SEARCH_PHRASE = '"CERTIFICATE OF CONVENIENCE AND NECESSITY"';
const FULL_TEXT_PARAM_CONTROL = "~/UserControls/Searches/PSC/PSCDocumentParamFullTxtSearchControl.ascx";

// Real live candidate population found across the full lookback (see
// module header) is small — a handful of real electric CPCN dockets per
// decade. Set generously above that for headroom.
export const MAX_CANDIDATES = 60;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
// See module header VANISHED-CANDIDATE FIX for why a bounded lookback (not
// full history) is safe here — every real electric CPCN found in this
// investigation was filed well within 10 years of the run date.
const LOOKBACK_YEARS = 10;
// Confirmed live: the Full-Text Parameterized Search results view only
// ever renders the first 10 rows of a larger "Items Count" — see module
// header FETCHING for why this module bisects date ranges instead of
// paging.
const MAX_ITEMS_PER_PAGE = 10;
const MIN_CHUNK_DAYS = 32;
const MAX_BISECT_DEPTH = 4;
// Confirmed live 2026-08-24 per-docket Documents tab page size.
const DOC_PAGE_SIZE = 25;
const MAX_DOC_PAGES = 20;

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
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

function formatMDY(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// Real observed docket-detail "Date Opened" / document "Date Filed" format:
// "10/30/2024" (no zero-padding).
function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// See module header FETCHING: ViewState is disabled site-wide (always a
// literal empty string), but the search UI is still genuinely stateful via
// the ASP.NET_SessionId cookie.
async function mintSessionCookie(): Promise<string> {
  const res = await fetch(PORTAL_URL);
  if (!res.ok) throw new Error(`AL PSC portal GET failed (${res.status})`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = /ASP\.NET_SessionId=[^;]+/i.exec(setCookie);
  if (!m) {
    throw new Error(
      "AL PSC portal response carried no ASP.NET_SessionId cookie — the site's session mechanism likely changed. Check mintSessionCookie in src/lib/ingest/alPscDockets.ts.",
    );
  }
  return m[0];
}

async function postForm(url: string, cookie: string, fields: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await res.text();
  if (!res.ok || /These columns don.t currently have unique values/i.test(text) || /Server Error in/i.test(text)) {
    // See module header FETCHING CONFIRMED LIVE SERVER BUG — surfaced as a
    // hard error rather than silently treated as zero results.
    throw new Error(
      `AL PSC search POST to ${url} failed (HTTP ${res.status})${/unique values/i.test(text) ? " — live server DataTable error (\"columns don't currently have unique values\"), see module header" : ""}`,
    );
  }
  return text;
}

// See module header FETCHING: switching search-type controls requires a
// real __EVENTTARGET postback that only takes effect for later requests on
// the SAME session cookie — a one-shot combined request is silently
// ignored.
async function switchToFullTextParamSearch(cookie: string): Promise<void> {
  await postForm(PORTAL_URL, cookie, {
    __VIEWSTATE: "",
    __VIEWSTATE1: "1",
    __EVENTTARGET: "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$searchesDropDownList$2",
    __EVENTARGUMENT: "",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$searchesDropDownList": FULL_TEXT_PARAM_CONTROL,
  });
}

interface PhraseCandidate {
  docketId: string;
  docketNumber: string;
}

function parseItemCount(html: string): number {
  const m = /Items Count:\s*([\d,]+)/i.exec(html);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

// Confirmed live 2026-08-24 against real Full-Text Parameterized Search
// results — each docket link's anchor text IS the docket number. Real
// observed quirk, not a parsing bug: a document filed into more than one
// related docket at once renders as ONE link whose anchor text is both
// docket numbers joined with " and " (e.g. "18117 and 18416", confirmed
// live) — this module keeps that combined string as-is rather than
// guessing which of the two is "the" docket number, matching this series'
// "match, don't silently fix" convention for real source quirks.
const DOCKET_LINK_RE = /DocketDetailsPage\.aspx\?DocketId=([a-f0-9-]+)">([^<]+)</gi;

function parsePhraseCandidates(html: string): PhraseCandidate[] {
  const seen = new Set<string>();
  const candidates: PhraseCandidate[] = [];
  for (const m of html.matchAll(DOCKET_LINK_RE)) {
    const docketId = m[1];
    if (seen.has(docketId)) continue;
    seen.add(docketId);
    candidates.push({ docketId, docketNumber: decodeHtmlEntities(m[2]).trim() });
  }
  return candidates;
}

async function searchPhraseChunk(cookie: string, after: Date, before: Date): Promise<{ itemCount: number; candidates: PhraseCandidate[] }> {
  const html = await postForm(PORTAL_URL, cookie, {
    __VIEWSTATE: "",
    __VIEWSTATE1: "1",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$searchesDropDownList": FULL_TEXT_PARAM_CONTROL,
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentParamFullTxtSearchControl1$searchPhrase": SEARCH_PHRASE,
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentParamFullTxtSearchControl1$filedOnOrAfterTextBox": formatMDY(after),
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentParamFullTxtSearchControl1$filedOnOrBeforeTextBox": formatMDY(before),
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentParamFullTxtSearchControl1$docketNumber": "",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentParamFullTxtSearchControl1$docNumber": "",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentParamFullTxtSearchControl1$companyName": "",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentParamFullTxtSearchControl1$searchButton": "Search",
  });
  return { itemCount: parseItemCount(html), candidates: parsePhraseCandidates(html) };
}

// Splits an inclusive whole-day [after, before] range into two adjacent
// whole-day sub-ranges with no gap and no overlap, regardless of how many
// days the range spans (including down to a 2-day range, which the
// company-scoped search's COMPANY_MIN_CHUNK_DAYS=0 can reach). A naive
// midpoint-plus-one-day split (an earlier version of this module used) is
// only safe when every range is guaranteed wide — it can push the right
// half's start past its own end once the range gets narrow, which
// COMPANY_MIN_CHUNK_DAYS=0 makes a real, not just theoretical, case.
function splitDateRange(after: Date, before: Date): [Date, Date, Date, Date] {
  const totalDays = Math.round((before.getTime() - after.getTime()) / 86_400_000);
  const leftSpanDays = Math.floor(totalDays / 2);
  const leftBefore = new Date(after.getTime() + leftSpanDays * 86_400_000);
  const rightAfter = new Date(leftBefore.getTime() + 86_400_000);
  return [after, leftBefore, rightAfter, before];
}

// See module header FETCHING CONFIRMED PAGINATION DEAD END: rather than
// paging a single search's results (confirmed unreplayable via direct
// POST for this control), this narrows the search itself by recursively
// bisecting the filed-date range whenever the real Items Count exceeds one
// page's worth of rows.
async function searchPhraseRange(cookie: string, after: Date, before: Date, depth = 0): Promise<PhraseCandidate[]> {
  const { itemCount, candidates } = await searchPhraseChunk(cookie, after, before);
  const spanDays = (before.getTime() - after.getTime()) / 86_400_000;
  if (itemCount > MAX_ITEMS_PER_PAGE && spanDays > MIN_CHUNK_DAYS && depth < MAX_BISECT_DEPTH) {
    const [leftAfter, leftBefore, rightAfter, rightBefore] = splitDateRange(after, before);
    await sleep(REQUEST_DELAY_MS);
    const left = await searchPhraseRange(cookie, leftAfter, leftBefore, depth + 1);
    await sleep(REQUEST_DELAY_MS);
    const right = await searchPhraseRange(cookie, rightAfter, rightBefore, depth + 1);
    return [...left, ...right];
  }
  // Depth cap reached but still over one page: real candidates beyond the
  // first page for this narrowest chunk are missed — flagged loudly rather
  // than silently, though never observed live at MIN_CHUNK_DAYS granularity
  // (see module header per-year item counts, max real single-year count
  // was 27, resolved by one bisection).
  if (itemCount > MAX_ITEMS_PER_PAGE) {
    console.error(
      `AL PSC full-text search: date range ${formatMDY(after)}-${formatMDY(before)} still has ${itemCount} items at max bisection depth — some candidates in this window were likely missed. Check MIN_CHUNK_DAYS/MAX_BISECT_DEPTH in src/lib/ingest/alPscDockets.ts.`,
    );
  }
  return candidates;
}

async function discoverCandidates(cookie: string): Promise<PhraseCandidate[]> {
  const now = new Date();
  const startYear = now.getFullYear() - LOOKBACK_YEARS;
  const seen = new Set<string>();
  const all: PhraseCandidate[] = [];
  for (let year = startYear; year <= now.getFullYear(); year++) {
    const after = new Date(year, 0, 1);
    const before = year === now.getFullYear() ? now : new Date(year, 11, 31);
    const found = await searchPhraseRange(cookie, after, before);
    for (const c of found) {
      if (!seen.has(c.docketId)) {
        seen.add(c.docketId);
        all.push(c);
      }
    }
    await sleep(REQUEST_DELAY_MS);
  }
  return all;
}

// CONFIRMED LIVE INDEXING GAP, caught only by the mandatory full live-DB
// verification step (not a hypothetical): the Full-Text Parameterized
// Search above searches an OCR'd/indexed copy of each document's content,
// and that index is NOT current for at least some real, recent documents.
// Docket 33513 (Alabama Power's real, current "Lindsay Hill Generating
// Station" CPCN, opened 10/30/2024, with a real Commission order granting
// it in August 2025) is completely invisible to searchPhraseRange even
// across the full 2000-2026 lookback — confirmed three separate ways: (1)
// the correctly-spelled phrase "CERTIFICATE OF CONVENIENCE AND NECESSITY"
// scoped to a 2024-2025 window returns zero results even though the
// docket's own DocketDetailsPage synopsis uses that exact correct spelling;
// (2) searching the misspelled "CERTIFICATE OF PUBLIC CONVIENCE" variant
// that Docket 33513's OWN filed documents actually use in their titles also
// returns zero results; (3) searching the single word "CONVIENCE" alone
// across the ENTIRE database returns exactly one hit, and it's a totally
// unrelated auto-rental-company letter (Docket 30378) — proving Docket
// 33513's real documents simply aren't in the full-text index at all, not
// that they're indexed under different wording. This is a real, structural
// blind spot: the exact kind of very-recently-filed, still-most-likely-to-
// be-open docket this project cares about most is precisely what a
// full-text-only discovery mechanism would systematically miss.
// FIXED by adding a second, independent discovery path that never depends
// on full-text indexing at all: the plain Document Search control
// (PSCDocumentSearchControl.ascx, not the full-text one) searches
// STRUCTURED metadata — company name and filed date — which is populated
// immediately when a document is filed, confirmed live to already include
// Docket 33513 (its 10/30/2024-2026 company-scoped search results include
// it). Since Alabama Power Company is confirmed (see module header
// SCOPING) to be effectively the sole real filer of electric generation/
// transmission CPCN petitions, this path is scoped to companyName="ALABAMA
// POWER COMPANY" and a shorter RECENT_MONTHS window (not the full
// LOOKBACK_YEARS — Alabama Power's total document volume is far higher
// than the phrase-search's own CPCN-specific volume, confirmed live: 293
// items in just the most recent ~2 years alone, vs. single digits per year
// for the phrase search), specifically to close the gap for documents too
// new to be indexed yet. Every candidate this path finds still goes
// through the exact same DocketDetailsPage-based REQUEST_RE/
// PROCEDURAL_EXCLUDE_RE/ELECTRIC_RE/NON_ELECTRIC_RE content filtering as
// the phrase-search path (see ingestAlPscDockets below) — this only widens
// discovery, it never widens what counts as a real candidate.
const RECENT_MONTHS = 24;
const COMPANY_NAME = "ALABAMA POWER COMPANY";
const COMPANY_MAX_BISECT_DEPTH = 11;
// Confirmed live necessary, unlike the phrase path's shared MIN_CHUNK_DAYS
// (32): Alabama Power's routine filing volume clusters densely enough
// (confirmed live: a single ~3-week window still had 27 items) that
// bisection needs to be allowed down to single-day windows to reliably
// separate same-week bursts into under-cap chunks.
const COMPANY_MIN_CHUNK_DAYS = 0;

async function searchCompanyChunk(cookie: string, after: Date, before: Date): Promise<{ itemCount: number; candidates: PhraseCandidate[] }> {
  const html = await postForm(PORTAL_URL, cookie, {
    __VIEWSTATE: "",
    __VIEWSTATE1: "1",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$searchesDropDownList": "~/UserControls/Searches/PSC/PSCDocumentSearchControl.ascx",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentSearchControl1$filedOnOrAfterTextBox": formatMDY(after),
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentSearchControl1$filedOnOrBeforeTextBox": formatMDY(before),
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentSearchControl1$docketNumber": "",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentSearchControl1$docNumber": "",
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentSearchControl1$companyName": COMPANY_NAME,
    "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl31$PSCDocumentSearchControl1$searchButton": "Search",
  });
  return { itemCount: parseItemCount(html), candidates: parsePhraseCandidates(html) };
}

// Same date-bisection strategy as searchPhraseRange (see its own comment
// for why — this control's own results pager is unreplayable too) — a
// deeper bisect cap since Alabama Power's overall document volume is much
// higher than the phrase search's CPCN-specific volume (confirmed live:
// 293 items across ~2 years, vs. single digits per year for the phrase).
async function searchCompanyRange(cookie: string, after: Date, before: Date, depth = 0): Promise<PhraseCandidate[]> {
  const { itemCount, candidates } = await searchCompanyChunk(cookie, after, before);
  const spanDays = (before.getTime() - after.getTime()) / 86_400_000;
  if (itemCount > MAX_ITEMS_PER_PAGE && spanDays > COMPANY_MIN_CHUNK_DAYS && depth < COMPANY_MAX_BISECT_DEPTH) {
    const [leftAfter, leftBefore, rightAfter, rightBefore] = splitDateRange(after, before);
    await sleep(REQUEST_DELAY_MS);
    const left = await searchCompanyRange(cookie, leftAfter, leftBefore, depth + 1);
    await sleep(REQUEST_DELAY_MS);
    const right = await searchCompanyRange(cookie, rightAfter, rightBefore, depth + 1);
    return [...left, ...right];
  }
  if (itemCount > MAX_ITEMS_PER_PAGE) {
    // Real, confirmed possibility with COMPANY_MIN_CHUNK_DAYS=0: a single
    // calendar day can itself carry more than 10 real filings (a batch
    // submission), at which point date-bisection has no further dimension
    // left to divide on — flagged loudly rather than silently, same
    // convention as searchPhraseRange.
    console.error(
      `AL PSC company-scoped search: date range ${formatMDY(after)}-${formatMDY(before)} still has ${itemCount} items at max bisection depth/granularity — some recent candidates in this window were likely missed. Check COMPANY_MIN_CHUNK_DAYS/COMPANY_MAX_BISECT_DEPTH in src/lib/ingest/alPscDockets.ts.`,
    );
  }
  return candidates;
}

async function discoverRecentCompanyCandidates(cookie: string): Promise<PhraseCandidate[]> {
  const now = new Date();
  const after = new Date(now.getFullYear(), now.getMonth() - RECENT_MONTHS, now.getDate());
  return searchCompanyRange(cookie, after, now);
}

interface DocketDetail {
  docketNumber: string;
  dateOpened: Date | null;
  description: string;
  synopsis: string;
}

function extractLabelValue(html: string, labelId: string): string {
  const re = new RegExp(`${labelId}"[^>]*>([^<]*)<`);
  const m = re.exec(html);
  return m ? decodeHtmlEntities(m[1]) : "";
}

// Confirmed live 2026-08-24 against real DocketDetailsPage.aspx responses
// — see module header STATUS for why the page's own "Status:" field is
// deliberately never read here.
async function fetchDocketDetail(docketId: string): Promise<DocketDetail> {
  const res = await fetch(DOCKET_DETAILS_URL(docketId));
  if (!res.ok) throw new Error(`AL PSC docket detail request failed (${res.status}) for DocketId ${docketId}`);
  const html = await res.text();
  const docketNumber = extractLabelValue(html, "docketNumberLabel");
  if (!docketNumber) {
    throw new Error(
      `AL PSC docket detail page for DocketId ${docketId} didn't contain a recognizable docket number — the page structure likely changed. Check fetchDocketDetail in src/lib/ingest/alPscDockets.ts.`,
    );
  }
  return {
    docketNumber,
    dateOpened: parseMDY(extractLabelValue(html, "dateOpenedLabel")),
    description: extractLabelValue(html, "descriptionLabel"),
    synopsis: extractLabelValue(html, "synopsisLabel"),
  };
}

interface DocRow {
  docType: string;
  description: string;
}

// Confirmed live 2026-08-24 against real docket-docs GridView rows (see
// module header FETCHING) — matches the anchor's own "View Document
// Details: ..." title (present on a single line, unlike the docDescLabel
// span which can have an arbitrarily large file-list block between it and
// the row's closing tag), then the immediately-following Document Type
// cell.
const DOC_ROW_RE = /title="View Document Details:\s*([^"]*)"[\s\S]*?<\/td><td>(Order|Filing|Other)<\/td>/g;

function parseDocRows(html: string): DocRow[] {
  const rows: DocRow[] = [];
  for (const m of html.matchAll(DOC_ROW_RE)) {
    rows.push({ docType: m[2], description: stripTags(m[1]) });
  }
  return rows;
}

// See module header FETCHING CONFIRMED WORKING PAGINATION — loops pages
// defensively; real litigated CPCN cases (e.g. Docket 32953) can carry
// hundreds of documents across many pages.
async function fetchDocketDocuments(cookie: string, docketId: string): Promise<DocRow[]> {
  const firstHtml = await (await fetch(DOCKET_DOCS_URL(docketId), { headers: { Cookie: cookie } })).text();
  const all = [...parseDocRows(firstHtml)];

  const totalMatch = /\((\d+)\s+records?\)|of\s+(\d+)\s*<\/td>/i.exec(firstHtml);
  const estimatedTotal = totalMatch ? Number(totalMatch[1] ?? totalMatch[2]) : all.length;
  const totalPages = Math.min(MAX_DOC_PAGES, Math.max(1, Math.ceil(estimatedTotal / DOC_PAGE_SIZE)));

  for (let page = 2; page <= totalPages; page++) {
    await sleep(REQUEST_DELAY_MS);
    const html = await postForm(DOCKET_DOCS_URL(docketId), cookie, {
      __VIEWSTATE: "",
      __VIEWSTATE1: "1",
      __EVENTTARGET: "ctl00$ContentPlaceHolder1$PortalPageControl1$ctl21$documentsGridView",
      __EVENTARGUMENT: `Page$${page}`,
    });
    const rows = parseDocRows(html);
    if (rows.length === 0) break;
    all.push(...rows);
  }
  return all;
}

type Resolution = "granted" | "denied" | "withdrawn" | null;

// See module header STATUS for how each pattern was calibrated against
// real Alabama dockets — including the real "CONVIENCE"/"CONVEYANCE" typos
// (matched as known aliases, not silently corrected) and the confirmed
// under-population for DENY_RE.
const GRANT_RE = /\b(?:is|are)\s+granted\b|\bORDER GRANTING\b|\bGRANTING\b[\s\S]{0,120}?\bCERTIFICATE\b/i;
const DENY_RE = /\bORDER DENYING\b[\s\S]{0,80}?\bCERTIFICATE\b|\bCERTIFICATE\b[\s\S]{0,80}?\bis\s+denied\b/i;
const WITHDRAW_RE = /\bwithdraw\w*\s+(?:of\s+)?(?:the\s+|its\s+)?(?:pending\s+)?(?:petition|application)\b/i;

function detectResolution(docs: DocRow[]): Resolution {
  const orderDocs = docs.filter((d) => d.docType === "Order");
  for (const d of orderDocs) {
    if (WITHDRAW_RE.test(d.description)) return "withdrawn";
    if (DENY_RE.test(d.description)) return "denied";
    if (GRANT_RE.test(d.description)) return "granted";
  }
  // Real applicants also sometimes file their own notice of withdrawal
  // directly (a Filing-class document), same as mdPscDockets.ts's
  // WITHDRAW_APPLICATION_RE convention.
  for (const d of docs) {
    if (d.docType === "Filing" && WITHDRAW_RE.test(d.description)) return "withdrawn";
  }
  return null;
}

// REQUEST_RE: a real, live-confirmed false-positive class caught only by
// the mandatory full live-DB verification step (this project's standard
// practice) after the first dry run — see module header SCOPING. Two real
// candidates matched the bare "CERTIFICATE OF CONVENIENCE AND NECESSITY"
// phrase search AND the (at-the-time) ELECTRIC_RE check without being real
// CPCN applications at all: Docket 18117/18416, "INFORMAL MEETING REGARDING
// RSE (RATE STABILIZATION AND EQUALIZATION) AND RATE CNP(CERTIFIED NEW
// PLANT) FOR ALABAMA POWER COMPANY" — a rate-mechanism informal meeting
// ("Rate CNP" is a cost-recovery RIDER named after "Certificated New
// Plant," not an actual certificate application); and Docket 32694,
// "INSTITUTING A GENERIC PROCEEDING TO DETERMINE WETHER AN ENTITY THAT OWNS
// OR OPERATE AN ELECTRIC VEHICLE CHARING STATION COULD BE SUBJECT OF THE
// REQUIREMENTS OF TITLE 37..." — a generic rulemaking about EV-charging
// jurisdiction, not a project. Exactly the "not a rate case, not a general
// rulemaking" exclusion this project's brief calls for. Fixed: a candidate
// must ALSO be an actual PETITION/APPLICATION/REQUEST asking FOR a
// certificate (REQUEST_RE), not merely a docket that references the CPCN
// phrase in passing — confirmed against every real positive candidate
// found in this investigation (Docket 33513, 32382, 31301, 27785, 31736 —
// all open with "PETITION FOR...", "REQUEST APPROVAL OF A CERTIFICATE...",
// or "APPLICATION FOR APPROVAL OF A CERTIFICATE...") and confirmed to
// correctly reject both false positives above (neither contains the word
// "CERTIFICATE" — Docket 18117/18416 says "CNP(CERTIFIED NEW PLANT)", not
// "CERTIFICATE"; Docket 32694 never uses the word at all).
const REQUEST_RE = /\b(?:PETITION|APPLICATION|REQUEST)\b[\s\S]{0,60}?\bCERTIFICATE\b/i;
// Additional real non-project docket types confirmed live that REQUEST_RE
// alone might not always catch (kept as defense in depth, same
// belt-and-suspenders approach wvPscDockets.ts's EXCLUDE_RE documents for
// its own cooling-tower/general-investigation exclusions).
const PROCEDURAL_EXCLUDE_RE = /\bgeneric proceeding\b|\brulemaking\b|\binformal meeting\b|\binvestigation of operations\b|\brate stabilization\b/i;

// See module header FUEL/PROJECT TYPE & CAPACITY / SCOPING — checked
// against description + synopsis together, and defaults to EXCLUDING a
// candidate unless a clear positive electric signal is found (confirmed
// necessary by Docket 29120, a telecom/water enforcement sweep that
// otherwise matches the bare CPCN phrase search — see module header
// SCOPING).
const ELECTRIC_RE =
  /\belectric\b|\bgenerat(?:e|ing|ion)\b|\bpower plant\b|\bpower line\b|\bpurchased? power\b|\btransmission\b|\bsubstation\b|\bsolar\b|\bwind\s?power\b|\bbattery\b|\benergy storage\b|\bALABAMA POWER COMPANY\b|\bMISSISSIPPI POWER\b/i;
const NON_ELECTRIC_RE =
  /\bwater service\b|\bwater works\b|\bsewer\b|\btelecommunications?\b|\btelephone\b|\blocal exchange\b|\binterexchange\b|\bwireless\b|\bCMRS\b|\bpaging\b|\bgas service\b|\bgas distribution\b|\bnatural gas service\b|\bgas pipeline\b|\bpipeline safety\b|\bmotor carrier\b|\bhousehold goods\b|\bpassenger\b|\bfreight\b/i;

const GENERATING_RE = /\bgenerat(?:e|ing|ion|ing station|ing resources)\b|\bpower plant\b|\bcombined cycle\b|\bcombustion turbine\b/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;
const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b|\bpower line\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/\bwind\s?power\b|\bwind\s+energy\b|\bwind\s+turbine/i, "wind_onshore"],
  [/\bnatural gas\b|\bgas[- ]fired\b|\bgas plant\b|\bcombined cycle\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
];

function pickFuelType(text: string): FuelType | null {
  let best: { fuel: FuelType; index: number } | null = null;
  for (const [re, fuel] of FUEL_KEYWORDS) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { fuel, index: m.index };
  }
  return best ? best.fuel : null;
}

function inferProjectTypeAndFuel(text: string): { projectType: ProjectType; fuelType: FuelType } {
  if (STORAGE_RE.test(text)) return { projectType: "storage", fuelType: "storage" };
  if (GENERATING_RE.test(text)) return { projectType: "generation", fuelType: pickFuelType(text) ?? "other" };
  if (TRANSMISSION_RE.test(text)) return { projectType: "transmission", fuelType: "transmission" };
  // Real, confirmed gap: several genuine Alabama Power CPCN captions
  // ("...FOR ALABAMA POWER COMPANY") carry no facility-type-revealing
  // language at all — see module header. Generation is the plurality
  // outcome among real classifiable Alabama Power CPCN candidates found in
  // this investigation, same "plurality default" convention
  // moPscDockets.ts/wvPscDockets.ts document for their own residual cases.
  return { projectType: "generation", fuelType: "other" };
}

const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*MW\b/i;

function extractCapacityMw(text: string): number | null {
  const m = CAPACITY_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Alabama's 67 counties, standard/stable public list — used as a
// hardcoded whitelist rather than a free-form "capitalized words before
// COUNTY" regex, the same greedy-regex hazard this series' Maryland
// module documented for its own county extraction.
const AL_COUNTIES = [
  "Autauga", "Baldwin", "Barbour", "Bibb", "Blount", "Bullock", "Butler", "Calhoun", "Chambers", "Cherokee",
  "Chilton", "Choctaw", "Clarke", "Clay", "Cleburne", "Coffee", "Colbert", "Conecuh", "Coosa", "Covington",
  "Crenshaw", "Cullman", "Dale", "Dallas", "DeKalb", "Elmore", "Escambia", "Etowah", "Fayette", "Franklin",
  "Geneva", "Greene", "Hale", "Henry", "Houston", "Jackson", "Jefferson", "Lamar", "Lauderdale", "Lawrence",
  "Lee", "Limestone", "Lowndes", "Macon", "Madison", "Marengo", "Marion", "Marshall", "Mobile", "Monroe",
  "Montgomery", "Morgan", "Perry", "Pickens", "Pike", "Randolph", "Russell", "St. Clair", "Shelby", "Sumter",
  "Talladega", "Tallapoosa", "Tuscaloosa", "Walker", "Washington", "Wilcox", "Winston",
];
const AL_COUNTY_LOOKUP = new Map(AL_COUNTIES.map((c) => [c.toLowerCase().replace(/[.\s]/g, ""), c]));

// Confirmed live against Docket 33513's real caption ("...LOCATED IN
// AUTAUGA COUNTY, ALABAMA").
const COUNTY_PHRASE_RE = /([A-Z][A-Za-z.]+(?:\s+(?:AND|&)\s+[A-Z][A-Za-z.]+)*)\s+COUNT(?:Y|IES)\b/g;

function extractCounties(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(COUNTY_PHRASE_RE)) {
    for (const token of m[1].split(/\s+(?:AND|&)\s+/)) {
      const key = token.trim().toLowerCase().replace(/[.\s]/g, "");
      const canonical = AL_COUNTY_LOOKUP.get(key);
      if (canonical && !found.includes(canonical)) found.push(canonical);
    }
  }
  return found;
}

// Real observed caption patterns (see module header FUEL/PROJECT TYPE):
// "...CERTIFICATE OF CONVENIENCE AND NECESSITY FOR ALABAMA POWER COMPANY",
// "...CERTIFICATE OF CONVENIENCE AND NECESSITY OF ALABAMA POWER COMPANY TO
// ACQUIRE...". Falls back to the raw description when neither matches.
const APPLICANT_RE = /CONV\w*\s+AND\s+NECESSITY\s+(?:FOR|OF)\s+(.+?)(?:\s+TO\s+ACQUIRE\b|\s+LOCATED\s+IN\b|,?\s*$)/i;

function extractApplicant(description: string): string {
  const m = APPLICANT_RE.exec(description);
  if (m) return m[1].trim().replace(/[.,]+$/, "");
  return description.slice(0, 80);
}

function normalizeCandidate(detail: DocketDetail, resolution: Resolution): NormalizedProject {
  const matchKey = resolveMatchKey("al-psc", detail.docketNumber);
  const combinedText = `${detail.description} ${detail.synopsis}`;
  const { projectType, fuelType } = inferProjectTypeAndFuel(combinedText);
  const capacityMw = extractCapacityMw(combinedText);
  const counties = extractCounties(combinedText);
  const county = counties.length > 0 ? counties.join(", ") : null;
  const applicant = extractApplicant(detail.description);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "withdrawn") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Alabama Public Service Commission's public docket search (Certificate of Convenience and Necessity, Ala. Code §37-4-28).",
    "The docket's own \"Status\" field is not used to determine whether it's still waiting — every real docket checked while building this source showed \"Open\" regardless of true age or resolution, including one confirmed to have already been granted over a year earlier. \"Still waiting\" here is instead inferred from scanning the docket's own filed Order documents for a granting/denying/withdrawal disposition — see the ingestion module header for how this was calibrated, including a confirmed real grant and the standing gap that no real denial exists in the current population to calibrate against.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket caption/synopsis text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket's caption and synopsis text alone (Alabama CPCN captions rarely state one).");
  }
  if (county) {
    const word = county.includes(",") ? "Counties" : "County";
    dataQualityNoteParts.push(`Located in ${county} ${word}, Alabama, per the docket caption/synopsis — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (AL PSC Docket ${detail.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "AL",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: detail.dateOpened,
    dateConfidence: "exact",
    currentStatus: `Alabama PSC Docket ${detail.docketNumber}: ${resolution ?? "pending"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Convenience and Necessity from the Alabama Public Service Commission — Docket No. ${detail.docketNumber}, "${detail.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `AL PSC Docket No. ${detail.docketNumber}`,
        url: DOCKET_DETAILS_URL(detail.docketNumber),
      },
    ],
    externalIds: { alPsc: detail.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestAlPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const cookie = await mintSessionCookie();
  await switchToFullTextParamSearch(cookie);
  const phraseCandidates = await discoverCandidates(cookie);

  // See discoverRecentCompanyCandidates above (CONFIRMED LIVE INDEXING GAP)
  // — a fresh session is used here rather than reusing `cookie`, since the
  // plain Document Search control (this path's target) is only guaranteed
  // to be the loaded control on a session that hasn't already been
  // switched to a different search type — a fresh GET's default control is
  // confirmed live to already be PSCDocumentSearchControl, no switch
  // postback needed.
  await sleep(REQUEST_DELAY_MS);
  const companyCookie = await mintSessionCookie();
  const recentCompanyCandidates = await discoverRecentCompanyCandidates(companyCookie);

  const seenDocketIds = new Set<string>();
  const candidates: PhraseCandidate[] = [];
  for (const c of [...phraseCandidates, ...recentCompanyCandidates]) {
    if (!seenDocketIds.has(c.docketId)) {
      seenDocketIds.add(c.docketId);
      candidates.push(c);
    }
  }

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let realApplicationCandidates = 0;

  const selected = selectWithRotation(candidates, maxCandidates, ROTATING_RECENT_SLOTS);
  const rotatingTier = new Set(selected.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  for (const candidate of selected) {
    try {
      const detail = await fetchDocketDetail(candidate.docketId);
      const combinedText = `${detail.description} ${detail.synopsis}`;
      if (
        !REQUEST_RE.test(combinedText) ||
        PROCEDURAL_EXCLUDE_RE.test(combinedText) ||
        NON_ELECTRIC_RE.test(combinedText) ||
        !ELECTRIC_RE.test(combinedText)
      ) {
        // Not a real electric generation/storage/transmission CPCN
        // application — see module header SCOPING.
        continue;
      }
      realApplicationCandidates += 1;
      await sleep(REQUEST_DELAY_MS);
      const docs = await fetchDocketDocuments(cookie, candidate.docketId);
      const resolution = detectResolution(docs);
      const normalized = normalizeCandidate(detail, resolution);
      toUpsert.push(normalized);
      if (rotatingTier.has(candidate)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: candidate.docketNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a docket that
  // fails this run's content classification after a previous run upserted
  // it real is deliberately left untouched now, not guessed into a
  // resolved stage — see the header for why.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: candidates.length,
    realApplicationCandidates,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestAlPscDockets()
    .then((summary) => {
      console.log(
        `Alabama PSC CPCN docket ingestion complete: ${summary.candidatesFound} phrase-search candidates found, ` +
          `${summary.realApplicationCandidates} real electric generation/storage/transmission applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
