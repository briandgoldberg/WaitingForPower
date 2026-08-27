// Rhode Island Energy Facility Siting Board (EFSB) docket ingestion — one of
// several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-24 via real GET requests (curl and Node's own
// `fetch`) against the live ripuc.ri.gov site and real downloaded order
// PDFs — no assumption below was taken from documentation or training-data
// memory alone.
//
// WHY EFSB, NOT PUC: the task brief started from the hint that Rhode
// Island's Public Utilities Commission (PUC) runs the public docket search —
// the same hint that turned out wrong for Washington (WUTC vs EFSEC), Oregon
// (PUC vs EFSC), Massachusetts (DPU vs EFSB), Connecticut (PURA vs CSC), and
// New Hampshire (PUC vs SEC). Checked here too, per this project's "confirm
// before guessing" rule, rather than assumed either way. Rhode Island is a
// sixth confirmed instance of the same pattern: R.I. Gen. Laws § 42-98-4
// ("License required") reads "No person shall site, construct, or alter a
// major energy facility within the state without first obtaining a license
// from the siting board pursuant to this chapter" — the "siting board" being
// the Energy Facility Siting Board (EFSB), a separate three-member body
// (PUC's own Chairperson, the DEM Director, and the Associate Director of
// Administration for Planning — confirmed live via § 42-98-5) that is only
// administratively housed at PUC's own office (89 Jefferson Boulevard,
// Warwick). Confirmed live via § 42-98-3: "major energy facility" means
// generation ≥40 MW, transmission lines ≥69 kV, LNG/LPG conversion-storage
// facilities, nuclear-fuel facilities, oil/gas refining, ≥10 MW hydro, and
// oil/gas/coal pipeline-transfer facilities. PUC's OWN docket-type menu
// (confirmed live at ripuc.ri.gov/events-and-actions/commission-dockets) is
// EL/NG/GE/WW/EE/DG/FR/REG/RES/TL/DJ/RM/GEN — electric and gas rate cases,
// tariffs, renewable-energy-program compliance, telecom, rulemaking, etc. —
// none of it siting/CPCN authority. This module therefore ingests EFSB's own
// docket list, not a PUC docket search.
//
// FETCHING: ripuc.ri.gov is a plain Drupal/Acquia CMS site — server-rendered
// HTML, no auth, no JS execution required, confirmed by hand with a bare
// `curl` GET (unlike nhSecDockets.ts's *.nh.gov, no TLS-fingerprint bot
// block was encountered here). Two page types:
//   - List: GET /general-information/efsb — a single hand-maintained page
//     with one HTML `<table>` of every EFSB docket ever opened (54 rows,
//     Docket No. SB-2003-01 through SB-2026-03, confirmed live 2026-08-24 —
//     no pagination, no date-range filtering, this is genuinely EFSB's
//     entire history since R.I. Gen. Laws § 42-98's own MW/kV thresholds
//     keep the caseload inherently small). Each row is a plain 3-column
//     `<tr><td><a href="...">DOCKET NO</a></td><td>DESCRIPTION</td>
//     <td>STATUS</td></tr>` — no separate detail-page request is needed to
//     discover candidates, docket number, description, or (nominal) status.
//   - Detail: the docket's own linked page, one per docket — confirmed live
//     that this is NOT a predictable URL pattern derivable from the docket
//     number (same real gotcha utPscDockets.ts documents for its own
//     listing): 2022+ dockets use `/Docket-SB-YYYY-NN`, most 2012–2021
//     dockets use a legacy static-style path `/efsb/YYYY_SB_NN.html` (which,
//     confirmed live, actually still resolves to the SAME modern Drupal
//     template/node — not a truly separate archive), a few carry one-off
//     aliases (`/general-information/energy-facility-siting-board/docket-no-
//     sb-2022-01`, `/sb-2022-04`), and — a real, confirmed access blocker —
//     ONE historical docket (SB-2022-05) links to `ripuc.ecms.ri.gov`, a
//     subdomain whose TLS certificate is issued for
//     `*.enterprise-g1.acquia-sites.com`, not `ripuc.ecms.ri.gov` itself
//     (confirmed live: Node's own `fetch()` throws
//     `ERR_TLS_CERT_ALTNAME_INVALID` against it). This module always uses
//     the href scraped from the master list row, never a constructed URL,
//     and lets the per-candidate try/catch (see ingestRiEfsbDockets) turn a
//     TLS failure on that one subdomain into a logged error rather than an
//     aborted run — not currently exercised by any live "Open" candidate
//     (SB-2022-05 is long since Closed) but documented in case a future
//     docket is migrated there. Each detail page's real content lives
//     between its own `<h1>` tag and the site's own footer address block
//     (`<p><strong>Public Utilities Commission &amp; Division of Public
//     Utilities and Carriers</strong></p>`, confirmed identical across every
//     era of page checked) — scraping is scoped to that slice so the site's
//     own nav/footer links are never mistaken for docket documents.
//
// SCOPING to real construction/siting candidates: EFSB's docket list mixes
// three real docket types under the shared "SB-" prefix, confirmed live by
// reading all 54 rows' own descriptions:
//   - "License Application" (the full R.I. Gen. Laws § 42-98-8/9 review —
//     e.g. SB-2026-02, Quonset/GDQ ESS's 208 MW battery storage facility;
//     SB-2022-02, SouthCoast Wind's transmission-cable interconnection).
//   - "Notice of Intent Application" (an abbreviated review under EFSB Rule
//     1.6(F), 445-RICR-00-00-1.6(F) — confirmed by reading a real granted
//     order, SB-2022-03's Order No. 157, in full: this track lets EFSB
//     determine whether a power-line rebuild/relocation/reconductoring
//     project is a "significant impact" alteration needing full review, or
//     may "proceed without further review." Both outcomes are a real,
//     final disposition of the Notice-of-Intent docket itself — this is a
//     genuine siting-review gate, not a rubber-stamp, so these are kept in
//     scope alongside full License Applications, matching the "any real
//     regulatory gate counts, however abbreviated" convention every other
//     module in this series has applied to its own state's lighter-review
//     tracks (WV's "-PW" petitions-for-waiver, CT's Petitions track, etc.).
//   - "Petition for Declaratory Order" / "Petition ... for a Jurisdiction[al]
//     Determination" — jurisdictional threshold petitions asking whether a
//     project needs an EFSB license AT ALL, not itself a construction
//     application. Confirmed live and directly load-bearing: SB-2024-01
//     (Quonset Development Corp.'s Petition for Declaratory Order about its
//     battery-storage/ductbank/switchyard plan) was DENIED 2024-10-03 — and
//     the SAME underlying project then filed the real License Application
//     this module does track, SB-2026-02, over a year later. Also excluded:
//     "Rulemaking" dockets (SB-2018-04/05, amendments to EFSB's own
//     procedural rules — not a project at all) and the "Access to Public
//     Records Regulation" docket (SB-2010-01). EXCLUDE_RE below drops all of
//     these by matching their own description text, the same two-population
//     shape maEfsbDockets.ts/nhSecDockets.ts both use for their own
//     jurisdictional-petition and rulemaking exclusions.
//
// STATUS — same lesson as every prior state in this series, reconfirmed
// here with TWO independently-caught real false positives: EFSB's own
// master-list "Status" column (a plain "Open"/"Closed" value, hand-typed the
// same way CT CSC's Pending Matters page is) is NOT reliably kept current.
// Confirmed live, both caught by actually reading the flagged docket's own
// detail page rather than trusting the column:
//   - SB-2022-02 (SouthCoast Wind) still shows "Open" on the master list,
//     but its own detail page's most recent document is "EFSB Decision and
//     Order No. 173" (1/22/2026) — its PDF text (extracted below) reads
//     "...is hereby granted, subject to the conditions set forth below" — a
//     real grant, over a month stale on the master list as of this writing.
//   - SB-2021-04 (National Grid/TNEC's LNG vaporization facility) also still
//     shows "Open", but its own detail page's most recent document is
//     labeled "Final Decision and Order" (5/12/2025) — over a year stale.
// So this module never trusts the master list's Status column as proof a
// docket is still pending; every "Open"-labeled non-excluded candidate still
// gets its own detail page fetched and its document list scanned for a real
// disposition (see detectResolution). (SB-2024-01's stale "Open" — the
// Quonset Petition for Declaratory Order denied 2024-10-03 — is a THIRD real
// example of the same staleness, but is moot for this purpose since Petition
// for Declaratory Order dockets are excluded before any status check runs.)
//
// STATUS DETECTION MECHANICS — a real, confirmed-live complication:
// disposition language lives almost entirely inside the order's own PDF
// (extracted via the same dependency-free zlib-based extractPdfText()
// technique utPscDockets.ts documents and uses — no external PDF-parsing
// package; package.json is out of scope for this module), but a REAL,
// CONFIRMED-LIVE fraction of EFSB's own order PDFs are scanned images with
// NO extractable text layer at all: Order No. 155 (SB-2022-01, 1.4 MB,
// extracts to 6 bytes) and SB-2021-04's own "Final Decision and Order"
// (13.2 MB, extracts to nothing but form-feed page breaks across 52 pages)
// both confirmed empty by hand, next to two OTHER real orders from the same
// system that extract perfectly (Order No. 157 / SB-2022-03, Order No. 173 /
// SB-2022-02). A design that only trusted PDF-body keyword matches would
// silently leave every scanned-PDF docket "still waiting" forever. Fixed:
// detectResolution() first narrows a docket's own document list to
// order/decision-labeled, non-procedural documents (excluding, by label,
// Preliminary Orders, Show Cause Orders, scheduling/protective/discovery
// orders, deadline-extension orders, and intervention/rehearing/
// reconsideration orders — a real, confirmed-live noisy population: SB-2022-
// 02 alone has a "Show Cause Order No. 160," an "RI EFSB Preliminary Order
// No. 156"-equivalent, and an intervention-related order, none of them the
// real disposition), then scans that narrowed list newest-first: an explicit
// "Notice of Withdrawal" (not "of counsel"/"of appearance," matching the
// real attorney-withdrawal false-positive maEfsbDockets.ts's own header
// documents) resolves without any PDF fetch at all; otherwise each
// candidate's PDF is fetched and tested against GRANT_RE/DENY_RE/
// NOT_ALTERATION_RE (the Notice-of-Intent-specific "proceed without further
// review" language, confirmed live via SB-2022-03's Order No. 157 above,
// treated as grant-equivalent — the project IS cleared to build); and if the
// extracted PDF text is empty (or too short to be a real order body), the
// candidate is treated as resolved-but-disposition-unclear (RI's own
// generic "cancelled" bucket, same convention wvPscDockets.ts's
// "closed-unclear" and ctCscDockets.ts's presence-only decisions-list check
// both use) rather than left "still waiting" — since it already survived
// the order/decision + non-procedural label filter, a document that reaches
// this point is very likely a genuine disposition EFSB simply scanned as an
// image rather than a real signal of no disposition existing. Known,
// accepted imprecision: this cannot distinguish "scanned-and-genuinely-
// final" from "scanned-and-actually-still-procedural" for any procedural
// order type not already in the exclusion list — flagged honestly here
// rather than guessed at further.
//
// GRANT_RE/DENY_RE calibration: GRANT_RE is hand-confirmed against a real
// live grant (SB-2022-02 Order No. 173's own decretal text: "the updated
// application of SouthCoast Wind for a license to construct transmission
// lines ... is hereby granted, subject to the conditions set forth below").
// No real EFSB license DENIAL was found in this research (the confirmed
// denial, SB-2024-01, was of a Petition for Declaratory Order, a docket type
// excluded before this check ever runs) — DENY_RE is written defensively,
// mirroring GRANT_RE's own shape, but is genuinely UNTESTED against a live
// example, flagged honestly the same way ctCscDockets.ts/nhSecDockets.ts
// both admit for their own least-common real outcome.
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): this module only
// fetches a detail page for rows the master list's OWN Status column
// marks "Open" (to keep the run's request count bounded — fetching all
// 54 dockets' detail pages plus order PDFs every run would be wasteful
// given the STATUS section above already shows that column can't be
// trusted as a positive signal, only used as a prefilter). If a future
// master-list edit ever flips a still-genuinely-open docket's own Status
// to "Closed" prematurely, or EFSB's page structure changes in a way that
// drops a previously-tracked row, that docket would silently vanish from
// every future candidate list. Originally fixed by pushing a resolved
// stub (guessing currentStage="cancelled") for any previously-tracked
// "ri-efsb:" matchKey no longer in this run's still-open set, so
// common.ts would delete it. That fix is now itself superseded: common.ts
// no longer deletes resolved-stage projects (they're kept and surfaced
// through the frontend's Status filter), so guessing "cancelled" for a
// vanished docket would mean permanently mislabeling it — it's at least
// as likely to have been granted — in a bucket real users can now see. A
// docket that vanishes is therefore left untouched, not guessed into a
// resolved stage.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields — parsed from the
// docket's own free-text Description on the master list (the only
// project-detail text available without an extra request; confirmed
// sufficient for every real candidate's project type). Real, confirmed live:
// EFSB's own jurisdiction over the SouthCoast Wind (SB-2022-02) and
// Revolution Wind (SB-2021-01) offshore-wind projects is specifically over
// their onshore/submarine TRANSMISSION interconnection cables, not the
// turbines themselves (which sit in federal waters, outside R.I. Gen. Laws
// § 42-98's reach) — confirmed by reading Order No. 173 in full ("two 20-
// mile submarine export cables ... and two new underground ... transmission
// lines"). Classified projectType="transmission" for these, matching this
// series' standing convention (maEfsbDockets.ts, ctCscDockets.ts, etc.) of
// tagging fuelType="transmission" whenever projectType is "transmission",
// regardless of what generation source the line ultimately interconnects —
// not a claim about the offshore wind farm's own fuel type. Capacity is
// almost never stated in the master-list description itself (the one real
// exception found live, SB-2026-02's "208 MW BATTERY ENERGY STORAGE
// FACILITY," is extracted by CAPACITY_RE); the 1,200 MW SouthCoast Wind
// figure, by contrast, only appears inside Order No. 173's own PDF body, not
// in any structured field, and is not extracted here (same "capacity rarely
// stated in the caption" limitation kyPscDockets.ts/wvPscDockets.ts both
// document for their own thin populations).
//
// LOCATION: no structured field; extracted from the master-list description
// against a hardcoded whitelist of Rhode Island's 39 cities/towns (per this
// project brief's own note: Rhode Island's 5 counties have no functioning
// county government at all, so town/city — not county — is the real local
// unit EFSB's own filings use, confirmed live: every real candidate
// description names one or more towns directly, e.g. "North Smithfield,
// Smithfield, Johnston, Cranston, West Warwick and Warwick, Rhode Island").
// A free-form capitalized-word regex was deliberately avoided (the exact
// greedy-regex hazard mdPscDockets.ts's own header documents); RI_TOWNS is
// matched longest-name-first so a multi-word town ("West Warwick," "North
// Smithfield") is never mis-split into a shorter town's name that happens to
// be its own substring (plain "Warwick" is ALSO a real, separate town from
// "West Warwick" — both appear correctly and independently in real
// descriptions). Recorded in the `county` field despite being a town/city
// name, not a county, the same field-reuse WA's/MA's/CT's/NH's modules all
// document; flagged in dataQualityNote.
//
// Wired to Vercel Cron [FREQUENCY TBD] (see vercel.json and
// src/app/api/cron/ingest-ri-efsb/route.ts — not yet created; left for
// manual wiring after this module is reviewed). Real full-population timing
// measured 2026-08-24 against the live site and the live shared DB: see the
// dry-run summary reported alongside this module.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";
import zlib from "node:zlib";

const BASE_URL = "https://ripuc.ri.gov";
const LIST_URL = `${BASE_URL}/general-information/efsb`;

// Comfortably above the current real population (54 total EFSB dockets
// ever, ~13 marked "Open" on the master list as of 2026-08-24, several of
// which this module's own STATUS check independently reclassifies as
// resolved — see module header STATUS). R.I. Gen. Laws § 42-98's own MW/kV
// jurisdiction thresholds make this an inherently low-volume docket type in
// a small state, so there's no realistic scenario of this cap silently
// dropping a genuinely-still-open one.
export const MAX_CANDIDATES = 50;
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`RI EFSB request failed (${res.status}): ${url}`);
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
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

interface DocketListRow {
  docketNumber: string;
  href: string;
  description: string;
  statusRaw: string;
}

// See module header FETCHING for the confirmed-live row shape: a plain
// 3-column `<tr>` with the docket-number link, a description `<td>`
// (sometimes wrapped in a bare `<span>`, sometimes not — both handled), and
// a status `<td>`. The header row itself ("Docket Number"/"Description"/
// "Status") has no `<a>` in its first cell and so never matches.
const ROW_RE =
  /<tr>\s*<td><a href="([^"]+)">([^<]+)<\/a><\/td>\s*<td>(?:<span>)?([\s\S]*?)(?:<\/span>)?<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/g;

export function parseDocketList(html: string): DocketListRow[] {
  const rows: DocketListRow[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    rows.push({
      href: m[1],
      docketNumber: decodeHtmlEntities(m[2]),
      description: stripHtml(m[3]),
      statusRaw: decodeHtmlEntities(m[4]),
    });
  }
  if (rows.length === 0) {
    throw new Error(
      "RI EFSB docket list (/general-information/efsb) matched zero rows — the page structure likely changed. Check parseDocketList in src/lib/ingest/riEfsbDockets.ts against a fresh response.",
    );
  }
  return rows;
}

function resolveHref(href: string): string {
  return href.startsWith("http") ? href : `${BASE_URL}${href}`;
}

// See module header SCOPING — real non-construction docket types confirmed
// sharing the "SB-" prefix with real License/Notice-of-Intent Applications.
const EXCLUDE_RE =
  /\bpetition for declaratory order\b|\bjurisdiction(?:al)? determination\b|\brulemaking\b|\baccess to public records regulation\b/i;

interface DetailDocument {
  label: string;
  href: string;
}

// Scopes extraction to the docket's own real content — between its `<h1>`
// and the site's own footer address block — so nav/footer links are never
// mistaken for docket documents. See module header FETCHING.
const FOOTER_MARKER = "Public Utilities Commission &amp; Division of Public Utilities and Carriers";
const DOC_ANCHOR_RE = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

function extractDetailDocuments(html: string): DetailDocument[] {
  const h1Idx = html.indexOf("<h1>");
  const footerIdx = html.indexOf(FOOTER_MARKER);
  const slice = h1Idx === -1 ? html : html.slice(h1Idx, footerIdx === -1 ? undefined : footerIdx);
  const docs: DetailDocument[] = [];
  for (const m of slice.matchAll(DOC_ANCHOR_RE)) {
    const label = stripHtml(m[2]);
    if (!label) continue;
    docs.push({ href: resolveHref(m[1]), label });
  }
  return docs;
}

// See module header STATUS DETECTION MECHANICS — a broad net (matches
// "Order No. 157", "EFSB Decision and Order No. 173", "Final Decision and
// Order") deliberately narrowed by PROCEDURAL_ORDER_RE below.
const ORDER_LIKE_RE = /\border\b|\bdecision\b/i;
// Real, confirmed-live non-final order labels sharing the same docket
// history as this module's real candidates (SB-2022-02 alone has a Show
// Cause Order, a Preliminary-track order, and a deadline-extension order —
// see module header STATUS DETECTION MECHANICS).
const PROCEDURAL_ORDER_RE =
  /\bpreliminary\b|\bshow cause\b|\bscheduling\b|\bprotective\b|\bdiscovery\b|\bintervention\b|\bextend\w*\b|\bcontinuance\b|\brehearing\b|\breconsideration\b|\bdeadline\b/i;
// "Notice of Withdrawal" (a real, confirmed-live case: SB-2025-05's TNEC
// withdrawal) resolves without a PDF fetch — excluding "of counsel"/"of
// appearance" per the real attorney-withdrawal false positive
// maEfsbDockets.ts's own header documents (not confirmed live in RI's own
// data, but guarded against defensively for the same reason).
const WITHDRAWAL_RE = /\bnotice of withdrawal\b(?!\s+of\s+(?:counsel|appearance))/i;

function isOrderCandidate(label: string): boolean {
  return ORDER_LIKE_RE.test(label) && !PROCEDURAL_ORDER_RE.test(label);
}

// Decompresses every FlateDecode content stream in a PDF with Node's
// built-in zlib (no external PDF-parsing dependency; package.json is out of
// scope for this module) and pulls literal text out of Tj/TJ operators —
// identical technique to utPscDockets.ts's own extractPdfText, confirmed by
// hand against 3 real RI EFSB order PDFs (Order No. 157, Order No. 173, and
// a real scanned-image order that correctly extracts to nothing — see
// module header STATUS DETECTION MECHANICS).
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

type Resolution = "granted" | "denied" | "withdrawn" | "resolved-unclear" | null;

// See module header GRANT_RE/DENY_RE calibration — GRANT_RE confirmed
// against a real live grant (SB-2022-02 Order No. 173); DENY_RE is
// defensive/untested (no real EFSB license denial found in this research).
const GRANT_RE =
  /\b(?:application|license)\b[\s\S]{0,200}?\bis\s+hereby\s+granted\b|\bis\s+hereby\s+granted\b[\s\S]{0,100}?\b(?:license|application)\b/i;
const DENY_RE = /\b(?:application|license)\b[\s\S]{0,200}?\bis\s+(?:hereby\s+)?denied\b/i;
// Rule 1.6(F) Notice-of-Intent-specific "cleared to build" language,
// confirmed live via SB-2022-03's Order No. 157 (see module header
// STATUS DETECTION MECHANICS) — treated as grant-equivalent.
const NOT_ALTERATION_RE = /does not constitute an alteration of a major energy facility|may proceed without further review/i;

// A real order PDF's extracted text runs into the thousands of characters
// (Order No. 157: ~16KB text; Order No. 173: ~83KB). A handful of bytes
// (confirmed live: Order No. 155 extracts to 6 bytes, SB-2021-04's Final
// Decision and Order to nothing but page-break characters) means the PDF is
// a scanned image with no text layer, not that the extraction merely found
// a short real order — see module header STATUS DETECTION MECHANICS.
const MIN_REAL_PDF_TEXT_LENGTH = 100;

async function fetchOrderPdfText(href: string): Promise<string> {
  const res = await fetch(href, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`RI EFSB order PDF request failed (${res.status}): ${href}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return extractPdfText(buf);
}

// Scans a docket's own order/decision documents, newest-first, for a real
// disposition — see module header STATUS DETECTION MECHANICS for the full
// rationale, including the scanned-PDF fallback.
async function detectResolution(docs: DetailDocument[]): Promise<Resolution> {
  const candidates = docs.filter((d) => isOrderCandidate(d.label)).reverse();
  for (const candidate of candidates) {
    if (WITHDRAWAL_RE.test(candidate.label)) return "withdrawn";
    let text: string;
    try {
      text = await fetchOrderPdfText(candidate.href);
    } catch {
      // Unreachable/non-PDF href (e.g. a broken link) — try the next older
      // order candidate rather than aborting the whole docket.
      continue;
    }
    if (GRANT_RE.test(text)) return "granted";
    if (DENY_RE.test(text)) return "denied";
    if (NOT_ALTERATION_RE.test(text)) return "granted";
    if (text.trim().length < MIN_REAL_PDF_TEXT_LENGTH) return "resolved-unclear";
    await sleep(REQUEST_DELAY_MS);
  }
  return null;
}

// Also checked directly against every document's label (not just
// order-candidates) since a withdrawal notice may not itself contain
// "order"/"decision" in its own label.
function hasWithdrawalNotice(docs: DetailDocument[]): boolean {
  return docs.some((d) => WITHDRAWAL_RE.test(d.label));
}

const TRANSMISSION_RE = /\btransmission\b|\btap line\b|\bloop line\b|\bsubstation\b|(?:^|[^0-9])\d[\d,]*\s*kv\b/i;
const LNG_RE = /liquefied natural gas|liquified natural gas|\bLNG\b/i;
const STORAGE_RE = /battery energy storage|\bbess\b|energy storage facility/i;
const WIND_OFFSHORE_RE = /offshore wind/i;
const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const GAS_RE = /combined[- ]cycle|simple[- ]cycle|natural gas[- ]fired|gas-fired/i;
// A real, confirmed-live fallback necessity, not just belt-and-suspenders:
// EFSB Rule 1.6(F) — the sole basis for every real "Notice of Intent
// Application" docket in this source (see module header SCOPING) — governs
// exclusively "the construction of power lines" (confirmed by hand reading
// SB-2022-03's own granted Order No. 157 in full), yet a real live docket's
// own caption doesn't always say "kV," "transmission," "substation," or
// "tap/loop line" at all: SB-2025-02's own description reads only
// "...Notice of Intent Application for Q143S/R144 Lines Rebuild Project -
// Providence, North Providence, Lincoln and North Smithfield" (a bare
// circuit-code "Lines Rebuild," no voltage stated) — a real false negative
// caught before shipping (this project's standard verification step: the
// dry-run's own DB rows were spot-checked by hand, which is what surfaced
// this). Checked only AFTER LNG_RE/STORAGE_RE below (not folded into
// TRANSMISSION_RE itself) so a hypothetical Notice-of-Intent caption that
// also names an LNG or storage facility would still classify by that
// stronger, more specific signal first.
const NOTICE_OF_INTENT_RE = /\bnotice of intent\b/i;

// See module header FUEL/PROJECT TYPE & CAPACITY for why RI's own offshore
// wind interconnection dockets (SouthCoast Wind, Revolution Wind) are
// classified "transmission" — EFSB's jurisdiction there is over the export
// cable, not the turbines.
function inferProjectType(desc: string): ProjectType {
  if (LNG_RE.test(desc)) return "lng";
  if (STORAGE_RE.test(desc)) return "storage";
  if (TRANSMISSION_RE.test(desc)) return "transmission";
  if (NOTICE_OF_INTENT_RE.test(desc)) return "transmission";
  return "generation";
}

function inferFuelType(desc: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "lng") return "lng";
  if (projectType === "storage") return "storage";
  if (WIND_OFFSHORE_RE.test(desc)) return "wind_offshore";
  if (SOLAR_RE.test(desc)) return "solar";
  if (GAS_RE.test(desc)) return "gas";
  return "other";
}

const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*MW\b/i;

function extractCapacityMw(desc: string): number | null {
  const m = CAPACITY_RE.exec(desc);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Rhode Island's 39 cities/towns (confirmed live 2026-08-24 against
// R.I. Gen. Laws' own municipal roster and cross-checked against every real
// candidate description's own town names) — see module header LOCATION for
// why a hardcoded whitelist is used rather than a free-form regex. Sorted
// longest-name-first so a multi-word town is matched whole rather than
// mis-split into a shorter town name that is its own real, separate
// municipality (e.g. "West Warwick" vs. plain "Warwick" — both real,
// distinct RI towns, both appear independently in real descriptions).
const RI_TOWNS = [
  "Barrington", "Bristol", "Burrillville", "Central Falls", "Charlestown",
  "Coventry", "Cranston", "Cumberland", "East Greenwich", "East Providence",
  "Exeter", "Foster", "Glocester", "Hopkinton", "Jamestown", "Johnston",
  "Lincoln", "Little Compton", "Middletown", "Narragansett", "Newport",
  "New Shoreham", "North Kingstown", "North Providence", "North Smithfield",
  "Pawtucket", "Portsmouth", "Providence", "Richmond", "Scituate",
  "Smithfield", "South Kingstown", "Tiverton", "Warren", "Warwick",
  "West Greenwich", "West Warwick", "Westerly", "Woonsocket",
];
const RI_TOWNS_BY_LENGTH_DESC = [...RI_TOWNS].sort((a, b) => b.length - a.length);
// RI town names contain only letters and spaces, so no regex-special-char
// escaping is actually needed here — kept anyway for defensiveness.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const TOWN_RE = new RegExp(`\\b(?:${RI_TOWNS_BY_LENGTH_DESC.map(escapeRegExp).join("|")})\\b`, "g");

// Real, confirmed-live false positive caught before shipping (same
// verification step that surfaced the NOTICE_OF_INTENT_RE gap above): "The
// Narragansett Electric Company" is the applicant on nearly every real
// candidate, and "Narragansett" is ALSO one of RI's 39 real towns — a plain
// whitelist match against every candidate's description wrongly tagged
// every single one of them as located in the Town of Narragansett, which
// none of them are. Filtered out here rather than dropped from RI_TOWNS
// entirely (Narragansett is a real town that could legitimately appear as
// an actual project location in a future docket) — "Narragansett Bay" is
// excluded the same defensive way, though not confirmed live in any real
// candidate description.
function extractTowns(desc: string): string | null {
  const found: string[] = [];
  for (const m of desc.matchAll(TOWN_RE)) {
    const name = m[0];
    if (name === "Narragansett") {
      const after = desc.slice((m.index ?? 0) + name.length, (m.index ?? 0) + name.length + 10);
      if (/^\s+(?:Electric|Bay)\b/.test(after)) continue;
    }
    found.push(name);
  }
  if (found.length === 0) return null;
  return [...new Set(found)].join("; ");
}

// Trailing "(M/D/YY)" or "(M/D/YYYY)" text immediately after a document's
// own anchor — confirmed live across real detail pages (e.g. "Final
// Decision and Order</a> (5/12/25)"). Best-effort only; not every document
// carries one (e.g. Order No. 157's own anchor has no trailing date).
const TRAILING_DATE_RE = /^\s*\(\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*\)/;

function parseTrailingDate(afterAnchor: string): Date | null {
  const m = TRAILING_DATE_RE.exec(afterAnchor);
  if (!m) return null;
  const [, mm, dd, yyRaw] = m;
  const yy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
  const d = new Date(yy, Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Best-effort applicationFiledDate: the earliest dated document found on the
// docket's own detail page (no structured "filed date" field exists on
// either the master list or the detail page — see module header FETCHING).
// dateConfidence is "approximate" for this source accordingly.
function extractEarliestDate(html: string): Date | null {
  const h1Idx = html.indexOf("<h1>");
  const footerIdx = html.indexOf(FOOTER_MARKER);
  const slice = h1Idx === -1 ? html : html.slice(h1Idx, footerIdx === -1 ? undefined : footerIdx);
  const dates: Date[] = [];
  for (const m of slice.matchAll(/<\/a>([^<]{0,20})/g)) {
    const d = parseTrailingDate(m[1]);
    if (d) dates.push(d);
  }
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

function normalizeDocket(row: DocketListRow, resolution: Resolution, filedDate: Date | null): NormalizedProject {
  const matchKey = resolveMatchKey("ri-efsb", row.docketNumber);

  const projectType = inferProjectType(row.description);
  const fuelType = inferFuelType(row.description, projectType);
  const capacityMw = extractCapacityMw(row.description);
  const county = extractTowns(row.description);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "withdrawn" || resolution === "resolved-unclear") {
    currentStage = "cancelled";
  } else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Rhode Island Energy Facility Siting Board (EFSB)'s public docket list and each docket's own filed-document list, not the Public Utilities Commission (PUC) — EFSB, a separate three-member board only administratively housed at PUC's office, is the body that actually issues Rhode Island's license for a \"major energy facility\" (generation ≥40 MW, transmission ≥69 kV, LNG/LPG storage-conversion, and related facility types) under R.I. Gen. Laws § 42-98; PUC's own docket types (rate cases, tariffs, renewable-program compliance, etc.) carry no siting authority. See the ingestion module header for the full statutory citation.",
    "EFSB's own docket-list \"Status\" column is not reliably kept current — confirmed live against two real dockets whose most recent filed order is a genuine final grant, yet the column still read \"Open\" (one over a month stale, one over a year stale as of this writing). \"Still waiting\" here is instead determined by scanning each docket's own order/decision documents (excluding known-procedural order types) for real grant/deny/withdrawal language, including inside the order's own PDF text where necessary. See the ingestion module header for the two real stale-status examples and how this was calibrated.",
  ];
  if (resolution === "resolved-unclear") {
    dataQualityNoteParts.push(
      "This docket's own most recent order-type document could not be read for its specific disposition — its PDF is a scanned image with no extractable text layer (a real, confirmed-live characteristic of a fraction of this source's own older order archive). It is treated as resolved/no-longer-pending based on the document's own label and position in the docket's filing history, but whether the underlying application was granted or denied could not be confirmed from this source alone.",
    );
  }
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket's own caption text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket's own caption text.");
  }
  if (projectType === "transmission" && WIND_OFFSHORE_RE.test(row.description) === false && /wind/i.test(row.description)) {
    dataQualityNoteParts.push("Classified as a transmission project because EFSB's own jurisdiction here is over the transmission/interconnection facility, not the generating facility itself (e.g. an offshore wind farm's submarine export cable) — see the ingestion module header.");
  }
  if (county) {
    const word = county.includes(";") ? "Towns/Cities" : "Town/City";
    dataQualityNoteParts.push(`Located in the ${word} of ${county}, Rhode Island, per the docket's own caption text — Rhode Island's counties have no functioning county government, so town/city (not county) is the real local unit here, stored in this site's \`county\` field for consistency with other sources; no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }
  if (filedDate == null) {
    dataQualityNoteParts.push("No structured \"filed date\" field is published by this source at all; applicationFiledDate could not be determined.");
  } else {
    dataQualityNoteParts.push("applicationFiledDate is approximated as the earliest dated document found in this docket's own filing history, not a dedicated \"application filed\" field.");
  }

  return {
    matchKey,
    name: `${row.description.slice(0, 80)} (RI EFSB ${row.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "RI",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "approximate",
    currentStatus: `RI EFSB Docket ${row.docketNumber}: ${resolution ?? "pending before the Energy Facility Siting Board"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a license (or Notice-of-Intent determination) from the Rhode Island Energy Facility Siting Board — Docket ${row.docketNumber}, "${row.description.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `RI EFSB Docket ${row.docketNumber}`,
        url: resolveHref(row.href),
      },
    ],
    externalIds: { riEfsb: row.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestRiEfsbDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const html = await fetchText(LIST_URL);
  const allRows = parseDocketList(html);

  const openRows = allRows.filter((r) => /^open/i.test(r.statusRaw.trim()));
  const realCandidates = openRows.filter((r) => !EXCLUDE_RE.test(r.description)).slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const row of realCandidates) {
    try {
      const detailHtml = await fetchText(resolveHref(row.href));
      const docs = extractDetailDocuments(detailHtml);
      const filedDate = extractEarliestDate(detailHtml);
      const resolution: Resolution = hasWithdrawalNotice(docs) ? "withdrawn" : await detectResolution(docs);
      toUpsert.push(normalizeDocket(row, resolution, filedDate));
    } catch (err) {
      errors.push({ matchKey: row.docketNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a docket that
  // no longer appears among EFSB's own "Open" dockets is deliberately
  // left untouched now, not guessed into a resolved stage — see the
  // header for why.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = realCandidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allRows.length,
    realApplicationCandidates: realCandidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  const started = Date.now();
  ingestRiEfsbDockets()
    .then((summary) => {
      const elapsedMs = Date.now() - started;
      console.log(
        `Rhode Island EFSB docket ingestion complete: ${summary.candidatesFound} total dockets found, ` +
          `${summary.realApplicationCandidates} real "Open" siting candidates, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors. (${elapsedMs}ms)`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
