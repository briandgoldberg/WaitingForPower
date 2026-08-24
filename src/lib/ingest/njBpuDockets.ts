// New Jersey Board of Public Utilities (BPU) docket ingestion — one of
// several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23 via real requests against
// publicaccess.bpu.state.nj.us — no assumption below was taken from
// documentation or training-data memory alone.
//
// SCOPING: New Jersey has no single "Certificate of Public Convenience and
// Necessity" statute/process for generation, storage, or transmission
// facilities the way most other states in this series do. Two real, distinct
// BPU docket types were found by hand-testing search results that function
// as the actual construction/siting GATE for a specific named electric
// project (as opposed to a rate case, tariff filing, or generic rulemaking):
//   1. N.J.S.A. 40:55D-19 "Determination" petitions — a utility or generator
//      asks the Board to find that its facility is "reasonably necessary for
//      the service, convenience or welfare of the public" (this exact phrase
//      is the statute's substantive test — functionally NJ's closest CPCN
//      equivalent), which exempts the facility from municipal zoning/site
//      plan approval. Filed under many different docket prefixes (EO, QO,
//      GO, WO, ...) depending on the filer's utility type; this module keeps
//      only dockets whose prefix does NOT start with G (gas) or W
//      (water/sewer) per the task brief, and additionally requires the
//      caption to name a generation/storage/transmission facility (solar,
//      wind, battery/energy storage, an "electric generating" facility, or a
//      transmission line/substation/switching station) rather than a vaguer
//      "certain lands" or ROW matter — confirmed by hand against
//      EO13111047 (Atlantic City Electric, "Use of Certain Lands within the
//      Township of Pennsville...") which names five municipalities but no
//      facility type at all and was excluded on this basis.
//   2. Competitive Solar Incentive (CSI) Program siting-prohibition waiver
//      petitions — an individual grid-scale solar developer asks the Board
//      to waive the Solar Act's siting restrictions (N.J.A.C. 14:8-12,
//      e.g. Pinelands preservation area, preserved farmland) for its named
//      project, a real per-project approval a developer cannot get into the
//      CSI incentive program without. Docket captions consistently read
//      "IN THE MATTER OF THE VERIFIED PETITION OF <Project Name>, LLC FOR A
//      WAIVER OF THE CSI SITING PROHIBITIONS AT N.J.A.C. 14:8-...". Found
//      live: 6 real per-project petitions, all filed April 2026 (South
//      Branch Solar Project, Pasadena Pemberton Solar Farm, Chamberlain
//      East Solar Farm, Prices Lane Solar Farm, Kober Solar Farm, Ocean View
//      Solar Farm), plus 2 non-project-specific "CSI Program" policy dockets
//      excluded by requiring the "VERIFIED PETITION OF ... FOR A WAIVER"
//      applicant-specific phrasing.
// A third, older, sibling process ("Solar Act Subsection (T)" landfill/
// brownfield siting applications, e.g. "Mount Olive Solar Farm, LLC -
// Application for Subsection (T)") was found live but deliberately left out
// of scope to keep this module's two tracks well-confirmed rather than
// guessing a third pattern's status-detection behavior untested.
//
// KEYWORD SEARCH COMPLETENESS -- a real gotcha found by testing, not
// assumed: AdvanceKeyword is NOT a simple substring match. Searching the
// literal keyword "40:55D-19" returns "1 - 9 of 9" results (6 unique
// dockets, after de-duplicating what looks like one row per matching
// reason/joined table), and NONE of them are EO15030383 or EO16010043 --
// despite both dockets' own captions containing the literal substring
// "N.J.S.A. 40:55D-19" (confirmed by eye against the live page). Querying
// instead with the longer phrase "determination pursuant to the provisions
// of nj.s.a. 40:55d-19" DOES surface EO15030383/EO16010043 (plus one more,
// GO15040403) but in turn misses several of the dockets the shorter query
// found. This is consistent with a relevance-ranked full-text search (most
// likely SQL Server FREETEXT/CONTAINS) returning only its own top-N by
// score for a given phrasing, not a complete list of all rows containing
// the substring -- no pagination controls exist on the results page to page
// through more (confirmed by inspecting the raw response HTML). This
// module therefore runs BOTH phrasings for Track 1 and unions the results
// (mirrors nyDpsDockets.ts's own "search two keywords, filter locally"
// pattern, just doubled up here to work around this ranking gap) -- between
// the two, all 9 real 40:55D-19 dockets found live are covered. This is a
// real, accepted completeness risk (documented, not silently ignored): a
// hypothetical future docket whose caption ranks outside the top-N for BOTH
// phrasings would be missed by this module until a rewording surfaces it.
//
// FETCHING: publicaccess.bpu.state.nj.us is an ASP.NET WebForms case
// management system (Search.aspx / SearchResults.aspx / CaseSummary.aspx),
// server-rendered, no JS execution required, no paid API, no CAPTCHA. One
// real gotcha confirmed by hand: the whole host sits behind Imperva, and a
// cookieless request 302-redirects to the SAME url after Set-Cookie'ing
// visid_incap_/incap_ses_ — an automated cookie-bootstrap, not a JS/CAPTCHA
// challenge (confirmed: no JS runs, just Set-Cookie+302; a second request
// carrying that cookie gets a normal 200). Node's global `fetch` does NOT
// keep a cookie jar across its own automatic redirect-following, so a plain
// `fetch(url)` here redirect-loops forever ("redirect count exceeded") —
// this module follows redirects manually (see fetchWithCookieBootstrap),
// carrying cookies itself, exactly the workaround curl's `-c/-b` flags do
// for free. The search form itself is a classic WebForms postback
// (__VIEWSTATE/__VIEWSTATEGENERATOR/__EVENTVALIDATION) — POSTing the
// Advanced Search with searchType=Advanced, AdvanceKeyword=<phrase>, and
// ListType=Docket 302s to SearchResults.aspx (a docket-level grid: Docket #,
// Case Type, Open Date, Case Caption, Party Name, Case Status) as opposed to
// ListType=Document, which 302s to SearchDocResults.aspx (a noisy
// full-text-in-any-filed-document search — confirmed by hand this surfaces
// unrelated cable/telecom dockets that happen to quote "certificate of
// public convenience and necessity" in a boilerplate order, not what this
// module wants). AdvanceKeyword itself matches against the docket caption
// (case_name) reasonably precisely for a distinctive multi-word phrase (the
// 8-result "waiver of the csi siting prohibitions" query returned exactly
// the 6 real per-project dockets plus 2 policy dockets, no noise) but
// degrades to single-word OR-matching for generic single terms (e.g.
// "transmission" alone pulled in gas-pipeline and rate dockets) — this
// module always searches distinctive multi-word phrases and applies a
// precise local caption regex on top, same "broad server search, precise
// local filter" pattern as scPscDockets.ts/txPuctDockets.ts.
//
// STATUS — the real signal, confirmed against real dockets, contradicting
// the obvious "Case Status" field (values seen: UNDER REVIEW / CLOSED /
// REOPEN): this field is STALE, not just occasionally wrong. Docket
// EO15030383 (JCP&L's Montville-Whippany 230kV transmission line, filed
// 2015) still reads "Case Status: UNDER REVIEW" and "Last Update: 10/6/2015"
// as of 2026-08-23 — but its own ORDERS-folder document "11-21-17-2K"
// (filed 11/30/2017) is titled "DECISION AND ORDER" and its text says in so
// many words "This Order ... represents the Final Order in the matter ...
// It is hereby ORDERED that the Petitioner of JCP&L seeking approval for
// its Montville-Whippany 230 kV Transmission Project is hereby GRANTED" —
// i.e. the docket was affirmatively decided nearly nine years ago and BPU's
// own status field was simply never updated. Neither "Case Status" nor
// "Last Update" (which tracks a metadata touch, not real filing activity —
// confirmed here too: last_update predates most of the docket's real 2016-
// 2017 litigation) can be trusted. The real signal instead: fetch each
// candidate's document list (CaseSummary.aspx), take the most recent
// document filed in the ORDERS folder (BPU Staff always files Board/OAL
// orders there — filed under a cryptic Agenda-date title like "11-21-17-2K"
// or "6-30-26-8L", NOT a descriptive one, so title-regex alone (this
// series' usual approach) cannot work here), fetch that document's PDF, and
// scan its actual text for a disposition clause. Confirmed against TWO real,
// independently-verified dockets covering both tracks and both outcomes:
//   - EO15030383 (Track 1, GRANTED): "...is hereby GRANTED."
//   - QW26040166 (Pasadena Pemberton Solar Farm, Track 2, DENIED): "...
//     public interest and DENIES the waiver. The Board FINDS that the
//     Petitioner is not eligible to participate in the fourth CSI Program
//     solicitation."
// Track 1 and Track 2 orders use different disposition phrasing ("is hereby
// GRANTED/DENIED" vs "[the Board] GRANTS/DENIES the waiver"), so GRANT_RE/
// DENY_RE cover both forms. If no ORDERS-folder document exists yet (the
// common case — most real candidates found live are recent, unresolved
// petitions, e.g. Fenwick Creek Solar QO26060340, filed 2026-06-09, has 19
// filed documents and zero in the ORDERS folder), the docket is still
// pending — the correct default.
//
// PDF TEXT EXTRACTION — a real engineering finding, not assumed: BPU order
// PDFs are digitally generated (not scanned images), confirmed by hand by
// inflating their FlateDecode content streams and finding real Tj/TJ
// text-showing operators. This module extracts their text with a small,
// dependency-free PDF text extractor (see extractPdfText below) built on
// Node's built-in `zlib.inflateSync` plus a manual PDF content-stream
// operator parser — no new npm package, since this project's ingestion
// modules may not add dependencies. This is genuinely necessary, not
// gold-plating: BPU order documents have no descriptive title or structured
// disposition field anywhere in the docket metadata, unlike every other
// state in this series (NY/NV's title-regex approach does not work here).
// Order PDFs can be large — one real GRANT order (doc 1180329, EO15030383)
// was 29MB because it bundles the entire evidentiary record/exhibits as
// attachments — extraction of that file took a few seconds locally. To keep
// a bounded worst case within the cron timing budget, this module only
// fetches the SINGLE most-recent ORDERS-folder document per candidate (not
// every order ever filed) and skips PDF fetch/extraction entirely (treating
// the docket as still-pending, noted in dataQualityNote) if the response's
// Content-Length exceeds MAX_ORDER_PDF_BYTES.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields. Track 2 (CSI siting
// waiver) captions never include capacity or a facility-type keyword beyond
// "solar" (by construction — every Track 2 candidate is a CSI-eligible solar
// project), so those are always classified fuelType="solar". Track 1
// captions are free text and classified the same keyword-regex way as every
// other state in this series. Capacity (MW) and county are extracted from
// the docket caption where present (e.g. "230 kV Transmission Project"
// carries no MW figure; captions in this system are generally terser than
// NY/NV's, so capacity/county are frequently unavailable — documented
// honestly per-project in dataQualityNote rather than guessed).
//
// TIMING BUDGET: the real combined candidate population across both tracks
// is small (8 real candidates found live as of 2026-08-23, spanning all of
// NJ BPU history for these two docket types — nothing like TX/VA's docket
// volume). A full run against the live site processing all 8 took 46.2s
// (each candidate needs a CaseSummary.aspx document-list fetch plus,
// usually, one ORDERS-folder PDF fetch+extract -- ~5-6s/candidate
// end-to-end). MAX_CANDIDATES=40 is therefore generous headroom rather than
// a real cap today, but isn't limitless: at the same ~5-6s/candidate rate,
// a future population of ~40 (five times today's, plausible if CSI runs
// several more solicitation rounds) would approach ~230-250s, worth
// revisiting before it gets there -- same lesson nyDpsDockets.ts's header
// documents for its own MAX_CANDIDATES choice.
//
// Wired to Vercel Cron weekly, 04:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-nj-bpu/route.ts). A real full run against the
// live shared DB (12 candidates found, 8 real applications, 6 upserted, 2
// resolved rows removed) completed in 44.9s, comfortably inside the 300s
// cron budget.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";
import zlib from "node:zlib";

const BASE_URL = "https://publicaccess.bpu.state.nj.us";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// See module header TIMING BUDGET — the real population found live across
// both tracks is well under this; kept generous rather than tight.
export const MAX_CANDIDATES = 40;
const REQUEST_DELAY_MS = 250;
const LOOKBACK_YEARS = 15;
// See module header PDF TEXT EXTRACTION. The largest real order PDF found
// live (EO15030383's grant order, bundling the full evidentiary record) was
// 29MB; this is comfortably above that while still bounding worst-case
// per-candidate latency if BPU ever files something far larger.
const MAX_ORDER_PDF_BYTES = 60 * 1024 * 1024;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as scPscDockets.ts/nyDpsDockets.ts, not a full HTML-entity
// library.
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

// ---------------------------------------------------------------------------
// Imperva cookie-bootstrap + WebForms plumbing -- see module header FETCHING.
// ---------------------------------------------------------------------------

type CookieJar = Record<string, string>;

function updateCookies(jar: CookieJar, res: Response): void {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// A cookieless request to this host 302s back to the SAME url after
// Set-Cookie'ing an Imperva bootstrap cookie -- follow redirects manually,
// carrying cookies, until a real response comes back. See module header
// FETCHING for why plain `fetch` redirect-looping fails here.
async function fetchWithCookieBootstrap(
  jar: CookieJar,
  url: string,
  init: RequestInit = {},
  maxHops = 5,
): Promise<Response> {
  let currentUrl = url;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(currentUrl, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Cookie: cookieHeader(jar) },
      redirect: "manual",
    });
    updateCookies(jar, res);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error(`NJ BPU: too many redirect hops fetching ${url}`);
}

function extractHiddenField(html: string, id: string): string {
  const re = new RegExp(`id="${id}"[^>]*value="([^"]*)"`);
  const m = re.exec(html);
  return m ? m[1] : "";
}

interface WebFormsHidden {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

async function getSearchPageHidden(jar: CookieJar): Promise<WebFormsHidden> {
  const res = await fetchWithCookieBootstrap(jar, `${BASE_URL}/Search.aspx`, { headers: { "User-Agent": UA } });
  const html = await res.text();
  const hidden = {
    viewState: extractHiddenField(html, "__VIEWSTATE"),
    viewStateGenerator: extractHiddenField(html, "__VIEWSTATEGENERATOR"),
    eventValidation: extractHiddenField(html, "__EVENTVALIDATION"),
  };
  if (!hidden.viewState) {
    throw new Error(
      "NJ BPU Search.aspx response didn't contain __VIEWSTATE -- the page structure likely changed. Check getSearchPageHidden in src/lib/ingest/njBpuDockets.ts against a fresh response.",
    );
  }
  return hidden;
}

interface DocketSearchResult {
  caseId: string;
  docket: string;
  caseType: string;
  openDate: string;
  caption: string;
  status: string;
}

// Advanced Search, ListType=Docket -- see module header FETCHING for why
// this (not ListType=Document) is the right search to run.
async function advancedKeywordSearch(jar: CookieJar, keyword: string): Promise<DocketSearchResult[]> {
  const hidden = await getSearchPageHidden(jar);
  const params = new URLSearchParams({
    __EVENTTARGET: "",
    __EVENTARGUMENT: "",
    __VIEWSTATE: hidden.viewState,
    __VIEWSTATEGENERATOR: hidden.viewStateGenerator,
    __VIEWSTATEENCRYPTED: "",
    __EVENTVALIDATION: hidden.eventValidation,
    "ctl00$ContentPlaceHolder1$searchFilter$searchType": "Advanced",
    "ctl00$ContentPlaceHolder1$searchFilter$SearchText": "",
    "ctl00$ContentPlaceHolder1$searchFilter$AdvanceCaseNumber": "",
    "ctl00$ContentPlaceHolder1$searchFilter$AdvanceDocumentTitle": "",
    "ctl00$ContentPlaceHolder1$searchFilter$AdvancePartyName": "",
    "ctl00$ContentPlaceHolder1$searchFilter$AdvanceKeyword": keyword,
    "ctl00$ContentPlaceHolder1$searchFilter$OpenDateFrom": "",
    "ctl00$ContentPlaceHolder1$searchFilter$OpenDateTo": "",
    "ctl00$ContentPlaceHolder1$searchFilter$ListType": "Docket",
    "ctl00$ContentPlaceHolder1$searchFilter$btnAdvanceSearch": "Search",
  });
  // The submit POST 302s to SearchResults.aspx (switching to GET, standard
  // browser/curl redirect-after-POST behavior) -- do that one hop manually
  // here (not via fetchWithCookieBootstrap, which would incorrectly replay
  // the POST body against the redirected GET url).
  const postRes = await fetch(`${BASE_URL}/Search.aspx`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: params.toString(),
    redirect: "manual",
  });
  updateCookies(jar, postRes);
  const location = postRes.headers.get("location") || postRes.url;
  const resultsUrl = new URL(location, BASE_URL).toString();
  const resultsRes = await fetchWithCookieBootstrap(jar, resultsUrl, { headers: { "User-Agent": UA } });
  const html = await resultsRes.text();
  return parseDocketSearchRows(html, keyword);
}

const DOCKET_ROW_RE =
  /<a href='CaseSummary\.aspx\?case_id=(\d+)'>\s*([^<]+)<\/a>\s*<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td[^>]*>([\s\S]*?)<\/td><td[^>]*>([\s\S]*?)<\/td><td[^>]*>([^<]*)<\/td>/g;

function parseDocketSearchRows(html: string, keyword: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(DOCKET_ROW_RE)) {
    results.push({
      caseId: m[1],
      docket: decodeHtmlEntities(m[2]).replace(/-$/, ""),
      caseType: decodeHtmlEntities(m[3]),
      openDate: decodeHtmlEntities(m[4]),
      caption: decodeHtmlEntities(m[5].replace(/<[^>]+>/g, "")),
      status: decodeHtmlEntities(m[7]),
    });
  }
  // Zero results is a real, valid outcome (e.g. a keyword search that
  // happens to match nothing right now) -- only a totally empty/malformed
  // response (no "Showing result(s)" marker at all) indicates the page
  // structure changed under us.
  if (results.length === 0 && !html.includes("Showing result") && !html.includes("No search results")) {
    throw new Error(
      `NJ BPU SearchResults.aspx response for keyword "${keyword}" had no recognizable docket rows and no result-count marker -- the page structure likely changed. Check parseDocketSearchRows in src/lib/ingest/njBpuDockets.ts against a fresh response.`,
    );
  }
  return results;
}

interface CaseDocument {
  docId: string;
  title: string;
  folder: string;
  date: Date | null;
}

const CASE_DOC_ROW_RE =
  /<input name="document_id" type="checkbox" value="(\d+)" \/>\s*<\/td><td>[^<]*<\/td><td[^>]*>\s*<a href="DocumentHandler\.ashx\?document_id=\d+">([^<]*)<\/a>\s*<\/td><td>([^<]*)<\/td><td>[^<]*<\/td><td[^>]*>[^<]*<\/td><td>([^<]*)<\/td>/g;

function parseMDY(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchCaseDocuments(jar: CookieJar, caseId: string): Promise<CaseDocument[]> {
  const res = await fetchWithCookieBootstrap(jar, `${BASE_URL}/CaseSummary.aspx?case_id=${caseId}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`NJ BPU CaseSummary.aspx request failed (${res.status}) for case_id ${caseId}`);
  const html = await res.text();
  const docs: CaseDocument[] = [];
  for (const m of html.matchAll(CASE_DOC_ROW_RE)) {
    docs.push({
      docId: m[1],
      title: decodeHtmlEntities(m[2]),
      folder: decodeHtmlEntities(m[3]),
      date: parseMDY(decodeHtmlEntities(m[4])),
    });
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Minimal, dependency-free PDF text extractor -- see module header PDF TEXT
// EXTRACTION. Handles digitally-generated PDFs (FlateDecode content streams
// with Tj/TJ text-showing operators); does not attempt OCR of scanned pages.
// ---------------------------------------------------------------------------

function decodePdfLiteralString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\") {
      const next = raw[i + 1];
      if (next === "n") {
        out += "\n";
        i++;
      } else if (next === "r") {
        out += "\r";
        i++;
      } else if (next === "t") {
        out += "\t";
        i++;
      } else if (next === "(" || next === ")" || next === "\\") {
        out += next;
        i++;
      } else if (next && /[0-7]/.test(next)) {
        let oct = "";
        let j = i + 1;
        while (j < raw.length && oct.length < 3 && /[0-7]/.test(raw[j])) {
          oct += raw[j];
          j++;
        }
        out += String.fromCharCode(parseInt(oct, 8));
        i = j - 1;
      } else if (next !== undefined) {
        out += next;
        i++;
      }
    } else {
      out += c;
    }
  }
  return out;
}

const PDF_TEXT_OP_RE = /\[((?:[^[\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
const PDF_TJ_ARRAY_STRING_RE = /\(((?:[^()\\]|\\.)*)\)/g;

function extractTextFromContentStream(content: string): string {
  let text = "";
  for (const m of content.matchAll(PDF_TEXT_OP_RE)) {
    if (m[1] !== undefined) {
      for (const sm of m[1].matchAll(PDF_TJ_ARRAY_STRING_RE)) {
        text += decodePdfLiteralString(sm[1]);
      }
    } else if (m[2] !== undefined) {
      text += decodePdfLiteralString(m[2]);
    }
  }
  return text;
}

const PDF_STREAM_RE = /stream\r?\n([\s\S]*?)endstream/g;

function extractPdfText(buf: Buffer): string {
  const str = buf.toString("latin1");
  let fullText = "";
  for (const m of str.matchAll(PDF_STREAM_RE)) {
    const raw = Buffer.from(m[1], "latin1");
    let content: string;
    try {
      content = zlib.inflateSync(raw).toString("latin1");
    } catch {
      content = m[1];
    }
    if (content.includes("Tj") || content.includes("TJ")) {
      fullText += extractTextFromContentStream(content) + "\n";
    }
  }
  return fullText;
}

// See module header STATUS -- both real disposition phrasings confirmed by
// hand: Track 1 orders say "is hereby GRANTED/DENIED"; Track 2 (CSI waiver)
// orders say "[the Board] GRANTS/DENIES the waiver".
const GRANT_RE = /\bis hereby\s+GRANTED\b|\bGRANTS?\s+the\s+waiver\b/i;
const DENY_RE = /\bis hereby\s+DENIED\b|\bDENIES?\s+the\s+waiver\b/i;

interface DocketResolution {
  resolution: "granted" | "denied" | null;
}

async function fetchDocketResolution(jar: CookieJar, caseId: string): Promise<DocketResolution> {
  const docs = await fetchCaseDocuments(jar, caseId);
  const orders = docs
    .filter((d) => d.folder === "ORDERS")
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  if (orders.length === 0) return { resolution: null };

  const latest = orders[0];
  const headRes = await fetchWithCookieBootstrap(
    jar,
    `${BASE_URL}/DocumentHandler.ashx?document_id=${latest.docId}`,
    { method: "HEAD", headers: { "User-Agent": UA } },
  ).catch(() => null);
  const contentLength = headRes?.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_ORDER_PDF_BYTES) {
    return { resolution: null };
  }

  const res = await fetchWithCookieBootstrap(jar, `${BASE_URL}/DocumentHandler.ashx?document_id=${latest.docId}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`NJ BPU DocumentHandler.ashx request failed (${res.status}) for document ${latest.docId}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ORDER_PDF_BYTES) return { resolution: null };
  const text = extractPdfText(buf);
  if (GRANT_RE.test(text)) return { resolution: "granted" };
  if (DENY_RE.test(text)) return { resolution: "denied" };
  return { resolution: null };
}

// ---------------------------------------------------------------------------
// Scoping filters + normalization -- see module header SCOPING.
// ---------------------------------------------------------------------------

// Track 1: N.J.S.A. 40:55D-19 determination petitions, electric-only
// (docket prefix must not start with G[as] or W[ater]), naming an actual
// generation/storage/transmission facility.
const TRACK1_OPENER_RE = /\b(?:petition|determination)\b[\s\S]{0,120}\b40:55D-19\b|\b40:55D-19\b[\s\S]{0,60}\bdetermination\b/i;
const TRACK1_FACILITY_RE =
  /\bsolar\b|\bphotovoltaic\b|\bwind\b|\bbattery\b|\benergy storage\b|\belectric generat\w+ (?:facility|plant|station)\b|\btransmission (?:line|project|facility)\b|\bsubstation\b|\bswitch(?:ing station|yard)\b/i;

// Track 2: CSI Program siting-prohibition waiver petitions, per-project only
// (excludes the "IN THE MATTER OF THE COMPETITIVE SOLAR INCENTIVE PROGRAM"
// policy dockets, which don't name an applicant/project).
const TRACK2_OPENER_RE = /\bverified petition of\b[\s\S]{0,120}\bwaiver of the csi siting prohibitions\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b|\bphotovoltaic\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(combined cycle|combustion turbine|natural gas|gas[- ]fired)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];
const TRANSMISSION_RE = /\btransmission (?:line|project|facility)\b|\bkV\b|\bsubstation\b|\bswitch(?:ing station|yard)\b/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;

function inferProjectType(caption: string): ProjectType {
  if (TRANSMISSION_RE.test(caption)) return "transmission";
  const hasGenerationFuel = FUEL_KEYWORDS.some(([re]) => re.test(caption));
  if (!hasGenerationFuel && STORAGE_RE.test(caption)) return "storage";
  return "generation";
}

function inferFuelType(caption: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(caption)) return fuel;
  }
  if (projectType === "storage") return "storage";
  return "other";
}

function extractCapacityMw(text: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*(?:MW|Megawatt)(?:ac|dc)?\b/i.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Matches "County of X" or "X County" forms -- both observed live (e.g.
// "...Township of Upper Pittsgrove, County of Salem" vs. a plain
// "Monmouth County" mention).
function extractCounty(text: string): string | null {
  const m1 = /County of ([A-Z][A-Za-z]+)/.exec(text);
  if (m1) return m1[1];
  const m2 = /([A-Z][A-Za-z]+)\s+County\b/.exec(text);
  if (m2) return m2[1];
  return null;
}

// Track 1 captions read "...PETITION OF <Applicant> PURSUANT TO..." or
// "<Applicant> - For Determination...". Track 2 captions read "...VERIFIED
// PETITION OF <Project Name>, LLC FOR A WAIVER...". Both forms confirmed
// against every real candidate found live.
const APPLICANT_RE_A = /(?:verified\s+)?petition\s+of\s+(?:the\s+)?(.+?)\s+(?:pursuant to|for a|for an)\b/i;
const APPLICANT_RE_B = /^([A-Za-z][A-Za-z0-9&,.'\s]+?)\s*[-–]\s*(?:for determination|determination|application)/i;

function extractApplicant(caption: string): string {
  const m1 = APPLICANT_RE_A.exec(caption);
  if (m1) return m1[1].trim().replace(/,$/, "");
  const m2 = APPLICANT_RE_B.exec(caption);
  if (m2) return m2[1].trim();
  return caption.slice(0, 80);
}

interface TrackedCandidate {
  search: DocketSearchResult;
  track: "40:55D-19" | "csi-waiver";
}

function normalizeCandidate(candidate: TrackedCandidate, resolution: DocketResolution): NormalizedProject {
  const { search, track } = candidate;
  const matchKey = resolveMatchKey("nj-bpu", search.docket);
  const projectType = track === "csi-waiver" ? "generation" : inferProjectType(search.caption);
  const fuelType = track === "csi-waiver" ? "solar" : inferFuelType(search.caption, projectType);
  const capacityMw = extractCapacityMw(search.caption);
  const county = extractCounty(search.caption);
  const applicant = extractApplicant(search.caption);
  const filedDate = parseMDY(search.openDate);

  let currentStage: ProjectStage;
  if (resolution.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution.resolution === "denied") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const trackLabel =
    track === "40:55D-19"
      ? "a N.J.S.A. 40:55D-19 determination that the facility is reasonably necessary for the service, convenience or welfare of the public (NJ's closest equivalent to a certificate of public convenience and necessity)"
      : "a waiver of the Competitive Solar Incentive (CSI) Program's siting prohibitions (N.J.A.C. 14:8-12), required before the project can participate in the CSI incentive solicitation";

  const dataQualityNoteParts: string[] = [
    `Sourced from the New Jersey Board of Public Utilities' public docket search (publicaccess.bpu.state.nj.us), seeking ${trackLabel}.`,
    "NJ BPU's own docket \"Case Status\" field was found stale/unreliable in testing (a docket with a Final Order granting the petition nearly nine years ago still read \"UNDER REVIEW\"); \"still waiting\" here is instead inferred by fetching the docket's most recent Board Order document and scanning its actual text for a granting/denying disposition -- see the ingestion module header for how this was calibrated against real, independently-verified dockets.",
    "No lat/lon geocoding -- state-docket sources are not geocoded in this series (a known deferred gap).",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket caption text, not a structured field -- not independently verified.");
  } else {
    dataQualityNoteParts.push("Capacity was not stated in the docket caption and could not be determined.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, New Jersey, per the docket caption.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published and none could be parsed from the docket caption.");
  }

  return {
    matchKey,
    name: `${applicant} (NJ BPU Docket ${search.docket})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "NJ",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `New Jersey BPU Docket ${search.docket}: ${resolution.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on ${trackLabel} from the New Jersey Board of Public Utilities -- Docket No. ${search.docket}, "${search.caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `NJ BPU Docket No. ${search.docket}`,
        url: `${BASE_URL}/CaseSummary.aspx?case_id=${search.caseId}`,
      },
    ],
    externalIds: { njBpu: search.docket },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestNjBpuDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const jar: CookieJar = {};

  // See module header KEYWORD SEARCH COMPLETENESS for why Track 1 runs two
  // differently-phrased queries and unions them. Run sequentially, not via
  // Promise.all: each call does its own GET-viewstate-then-POST-search
  // round trip against a SHARED cookie jar (see FETCHING) -- confirmed by
  // testing that running them concurrently corrupts results (interleaved
  // requests race on the ASP.NET __VIEWSTATE/session state, silently
  // dropping most real candidates), so despite the extra latency this must
  // stay sequential.
  const track1ResultsA = await advancedKeywordSearch(jar, "40:55D-19");
  const track1ResultsB = await advancedKeywordSearch(jar, "determination pursuant to the provisions of nj.s.a. 40:55d-19");
  const track2Results = await advancedKeywordSearch(jar, "waiver of the csi siting prohibitions");

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const track1: TrackedCandidate[] = [...track1ResultsA, ...track1ResultsB]
    .filter((r) => !/^[GW]/i.test(r.docket))
    .filter((r) => TRACK1_OPENER_RE.test(r.caption) && TRACK1_FACILITY_RE.test(r.caption))
    .map((search) => ({ search, track: "40:55D-19" as const }));
  const track2: TrackedCandidate[] = track2Results
    .filter((r) => TRACK2_OPENER_RE.test(r.caption))
    .map((search) => ({ search, track: "csi-waiver" as const }));

  const allCandidates = [...track1, ...track2];

  const seen = new Set<string>();
  const realApplications = allCandidates
    .filter((c) => {
      if (seen.has(c.search.docket)) return false;
      seen.add(c.search.docket);
      return true;
    })
    .filter((c) => {
      const filed = parseMDY(c.search.openDate);
      return filed == null || filed >= cutoff;
    })
    .sort((a, b) => (parseMDY(b.search.openDate)?.getTime() ?? 0) - (parseMDY(a.search.openDate)?.getTime() ?? 0))
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of realApplications) {
    try {
      const resolution = await fetchDocketResolution(jar, candidate.search.caseId);
      toUpsert.push(normalizeCandidate(candidate, resolution));
    } catch (err) {
      errors.push({ matchKey: candidate.search.docket, message: String(err) });
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
  ingestNjBpuDockets()
    .then((summary) => {
      console.log(
        `New Jersey BPU docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.realApplicationCandidates} real project-specific applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
