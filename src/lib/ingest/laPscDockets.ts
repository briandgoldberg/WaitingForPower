// Louisiana Public Service Commission (LPSC) generation/storage/transmission
// certification docket ingestion — one of several states built in parallel
// in the per-state series started with vaSccDockets.ts (see that file's
// header for the overall rationale). Confirmed by hand 2026-08-24 via real
// GET/POST requests against the live lpscpubvalence.lpsc.louisiana.gov
// system — no assumption below was taken from documentation or
// training-data memory alone.
//
// SCOPING: Louisiana does NOT have one single named "Certificate of Public
// Convenience and Necessity" statute for electric generation the way most
// other states in this series do — checked by hand, and a real trap: La.
// R.S. 45:1503 is literally titled "Certificate of public convenience and
// necessity; exceptions" (confirmed via a live fetch of
// legis.la.gov/legis/Law.aspx?d=99909) but turns out to govern "radio common
// carrier" (mobile radio/telecom) certificates only, added in 1968 — nothing
// to do with electric utilities. Would have been a real wrong-guess trap if
// not checked by hand.
// What Louisiana actually has, confirmed live against dozens of real
// dockets (see FETCHING/STATUS below):
//   1. A general, uncodified-but-completely-consistent LPSC practice of
//      requiring utilities/co-ops/merchant developers to obtain Commission
//      "certification" before adding a new generation or storage resource —
//      every real live docket of this kind is captioned "Application/
//      Request/Petition for certification of ..." (e.g. Docket U-37882,
//      "Application for certification of generation and transmission
//      resources"; Docket U-37799, "certification of a Battery Energy
//      Storage Agreement"; Docket U-37131, "certification of the
//      construction of the Bayou Power Station"; Docket U-36685,
//      "certification ... of the 2022 Solar Portfolio") or, equally common
//      in real live data, "Application for approval to construct ..." (e.g.
//      Docket U-37800, "approval to construct Votaw and Segno solar
//      facilities"; Docket U-37463, "approval to construct the Hallsville
//      natural gas plant").
//   2. A specific, named "Transmission Siting Order" General Order for
//      transmission lines, confirmed to exist in TWO real, live citation
//      forms — the original October 10, 2013 order and a successor dated
//      September 10, 2024 (docket R-36199) that real live 2025/2026
//      transmission-certification dockets now cite instead (e.g. Docket
//      U-38042, "certification of the Resilient Park 345kV transmission
//      project ... in accordance with the Commission's General Order dated
//      September 10, 2024 (Transmission Siting Order)"). Confirmed the two
//      citation forms are NOT interchangeable typos — both are real, dated
//      years apart, and both still appear on live open dockets (an older
//      exemption request, Docket U-37143, still cites the 2013 order).
//      CONTENT_RE below matches the phrase "Transmission Siting Order"
//      itself rather than hardcoding either date, so a future third
//      revision of this order won't silently fall out of scope.
//   3. A separate "Nuclear Incentive Rule" Phase 1/Phase 2 certification
//      process for new nuclear plants (confirmed via a real historical
//      denial, Docket U-31125 — River Bend Unit 3's 2012 Phase 1
//      certification application was denied; see STATUS below). No live
//      nuclear certification docket exists today, but the same "certif..."
//      language this module matches would catch one if filed.
//   All three funnel through the same real, live-confirmed language pattern
//   — "certif[y/ies/ication]" and/or "approval to construct" — which is what
//   CONTENT_RE matches (see FUEL/PROJECT TYPE below for the full regex and
//   how it was calibrated against a full 191-docket, 2023-2026 real sample
//   with zero false positives).
//
// NEW ORLEANS JURISDICTION: checked by hand per this project's brief.
// Entergy New Orleans, LLC (which serves the City of New Orleans) is
// regulated exclusively by the New Orleans City Council, not LPSC — this is
// well known, and confirmed live and definitively here: a live LPSC
// CompanyName="Entergy New Orleans" docket search
// (POST /portal/PSC/DocketSearch) returns zero results ({"Data":[],
// "Total":0}), out of LPSC's own ~16,900-docket history. New
// Orleans-area Entergy New Orleans projects are therefore not merely
// under-represented in this module — they NEVER appear in LPSC's docket
// system at all, and would need a separate New Orleans City Council Utility
// Regulatory Office source (out of scope here, not investigated further).
//
// FETCHING: lpscpubvalence.lpsc.louisiana.gov/portal is LPSC's public
// "Valence" case-management portal (ASP.NET MVC + Kendo UI grids). No
// authentication, no CAPTCHA, no session/cookie requirement of any kind
// confirmed by hand — every request below is a fresh, stateless GET or POST.
// Three real endpoints are used, all confirmed live 2026-08-24:
//   1. `POST /portal/PSC/DocketSearch` — the "Search for Dockets" tab's
//      Kendo grid data source. Real, hand-confirmed gotcha: the obvious
//      `sort[0][field]=...&sort[0][dir]=...` bracket-notation POST body (the
//      literal shape Kendo's aspnetmvc-ajax transport sends for OTHER Kendo
//      sort params in this project's other modules) throws a live HTTP 500
//      ("ArgumentNullException: Value cannot be null, Parameter: source" in
//      `Valence.Web.Code.WidgetToolkit.GetSorts`) — LPSC's own server-side
//      sort binder expects the single flat string `sort=DateFiled-desc`
//      instead, confirmed live to work. Fields posted: `paramSet[
//      DocketNumber]=U-` (LPSC's own docket-number scheme prefixes every
//      docket with a single letter + dash; "U-" is the "Utility" bucket —
//      confirmed live to include electric, gas, AND water utility dockets
//      together, not electric-only, hence the Synopsis-based CONTENT_RE
//      filter below doing the real scoping work, not the prefix), `paramSet[
//      StartDate]`/`paramSet[EndDate]` (M/d/yyyy, see LOOKBACK_YEARS),
//      `paramSet[CompanyName]=` (left blank — deliberately not scoped to a
//      hardcoded utility-name list, so a new merchant developer like
//      Southern Spirit Transmission LLC, a non-traditional-utility filer
//      confirmed live under a real "U-" docket, is never missed), plus
//      standard Kendo paging (`page`/`pageSize`/`skip`/`take`). Returns only
//      MatterId/MatterNumber/DateFiled/a boilerplate Description (e.g.
//      "Entergy Louisiana, LLC, ex parte.") — NOT the real subject-matter
//      text, which requires a second per-docket request (see below).
//   2. `GET /portal/PSC/DocketDetails?docketId=<MatterId>` — a fully
//      server-rendered (no further AJAX needed) page per docket, giving
//      Docket Number, Date Opened, Status, Date Published, Description, and
//      — critically — a "Synopsis" field with the real, specific
//      subject-matter text (e.g. "Application for certification of the West
//      Bank 500kV Transmission Project pursuant to General Order dated
//      September 10, 2024 (Transmission Siting Order)."), plus a
//      "Companies Involved" party list. This Synopsis field is what
//      CONTENT_RE/EXCLUDE_RE and project-type/fuel/capacity/parish
//      extraction all run against.
//   3. `POST /portal/PSC/OrderSearch` — the "Search for Orders" tab,
//      filtered by `paramSet[DocketNumber]=<docket>`, sort=`OrderDate-desc`.
//      Returns each real Commission Order's own Synopsis text (e.g. "Order
//      No. U-37799 certifies the Amite South Energy Storage Agreement,
//      subject to certain conditions."). This is a SEPARATE object type from
//      docket "Documents" (party filings/testimony/motions) — confirmed live
//      that Commission orders never appear with a distinct "Order"
//      DocumentType inside `/portal/PSC/Docket_Documents` (every row there
//      came back typed "Filing" regardless of content, even for a docket
//      with a real approving order on file), so OrderSearch is the only
//      reliable way to find a docket's dispositive order(s) — see STATUS.
//
// STATUS — same lesson as every prior state in this series, reconfirmed
// here in an unusually sharp form: LPSC's own per-docket "Status" field
// (Open/Closed) is actively unreliable in BOTH directions, not merely
// absent or stale.
//   - Confirmed lying live: Docket U-37425 (Entergy Louisiana's "generation
//     and transmission resources" application for a north-Louisiana data
//     center project, real-world name "Laidley Generation and Transmission
//     Project" per its own later quarterly monitoring-report filings) has a
//     real Commission Order dated in 2025 that reads "Order No. U-37425
//     accepts the settlement ... approving the generation and transmission
//     resources proposed ..." — a clean, unambiguous grant — yet
//     DocketDetails still reports `Status: Open` as of 2026-08-24, over a
//     year later, because LPSC keeps the docket open for the project's
//     ongoing post-approval quarterly compliance-monitoring filings. Same
//     confirmed live for Docket U-37799 (Amite Solar/DEMCO battery storage
//     certification — real granting order on file, Status still "Open") and
//     Docket U-36669 (Southern Spirit Transmission — real order accepting
//     the ALJ's certification recommendation dated August 2024, Status
//     still "Open" two years later). Trusting Status alone would leave every
//     one of these long-resolved dockets frozen on the site indefinitely.
//   - Confirmed lying the other direction is plausible but not observed
//     live: this module does not special-case a "Closed" docket as
//     necessarily resolved either (a dismissal-without-prejudice could in
//     principle be refiled), so Status is never trusted as a shortcut in
//     either direction — every real candidate always gets its own
//     OrderSearch check regardless of its own Status value.
//   Real resolution detection instead scans every Order returned by
//   OrderSearch (most-recent-first, matching this series' WV/MD precedent),
//   calibrated against real, live, hand-read order text:
//     - GRANT, real confirmed forms: "certifies the [X] Agreement" (Docket
//       U-37799); "accepts the settlement ... approving ..." (Docket
//       U-37425); "accepts the Administrative Law Judge's Recommendation"
//       (Docket U-36669 — confirmed a real grant, not a rubber-stamped
//       denial, by the order's own added condition being about COST
//       RECOVERY ("no design or construction costs ... be borne by
//       ratepayers"), i.e. the certification itself was granted, just
//       without full requested cost recovery — the same "granted but
//       scoped down" pattern wvPscDockets.ts documents for its own Case
//       25-0637-E-CN. Under-confirmed risk, same as MD's appeal-denial
//       signal: this phrasing would also fire if a future ALJ
//       recommendation were itself a denial that the Commission accepted —
//       no live example of that exists to calibrate against).
//     - DENY, real confirmed (found via a live OrderSearch full-text search
//       for "denies certification", not from this module's own recent-
//       docket sample — Louisiana's only real denial in the live record is
//       old): Docket U-31125, Entergy's 2012 River Bend Unit 3 nuclear
//       "Phase 1 certification" application — "We find that the Companies'
//       Application for Phase 1 certification should be denied due to the
//       Companies' failure to seek and obtain the required pre-approval of
//       the Commission ...".
//     - DISMISS, real confirmed: Docket U-37537 (a Concordia/GridLiance
//       transmission-asset-ownership matter, itself excluded from this
//       module's real candidates — see EXCLUDE below — but its order text
//       is a clean real example): "Order No. U-37537 dismisses this matter
//       without prejudice."
//     - PROCEDURAL, real confirmed false-positive risk caught before
//       shipping: Docket U-37882's only order on file as of 2026-08-24
//       reads "This order requires the Administrative Hearings Division to
//       serve as hearing examiner in this docket, to compile a complete
//       evidentiary record with no formal recommendation, and to establish
//       a procedural schedule ..." — an order EXISTS but resolves nothing.
//       DENY_RE/DISMISS_RE/GRANT_RE below all correctly fail to match this
//       text, leaving the docket correctly classified as still pending.
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): this module's own
// candidate query is scoped to a moving `[today - LOOKBACK_YEARS, today]`
// docket-search date window (see LOOKBACK_YEARS) — a real docket this
// module previously tracked as still-pending (local_review) that never
// receives a resolving Order simply ages out of that window on some
// future run without ever being pushed through with a resolved stage.
// Originally fixed by pushing a resolved stub (guessing
// currentStage="cancelled") for any previously-tracked "la-psc:" matchKey
// no longer in this run's still-open set, so common.ts would delete it.
// That fix is now itself superseded: common.ts no longer deletes
// resolved-stage projects (they're kept and surfaced through the
// frontend's Status filter), so guessing "cancelled" for an aged-out
// docket would mean permanently mislabeling it — possibly wrongly, since
// LPSC grants far more often than it denies/dismisses — in a bucket real
// users can now see. A docket that ages out of the lookback window is
// therefore left untouched, not guessed into a resolved stage. A docket
// that resolves via a real Order WITHIN the window is unaffected by this
// change at all: it's still pushed through with its real resolved stage
// directly from the main loop, same as every other module in this series.
//
// FUEL/PROJECT TYPE & CAPACITY: extracted from each docket's own Synopsis
// text (no separate detail-page or PDF fetch — the Synopsis already has
// everything needed, unlike njBpuDockets.ts/utPscDockets.ts, which had to
// read final-order PDFs directly). CONTENT_RE was calibrated against a full,
// real, live 191-docket sample (every real "U-" docket filed 2023-01-01
// through 2026-08-24 as of this writing) — 19 of 191 matched, and every
// single one was independently hand-confirmed to be a real generation/
// storage/transmission certification candidate, zero false positives. Real,
// live-confirmed EXCLUDE cases that CONTENT_RE correctly never matches at
// all (no separate EXCLUDE_RE was even needed for these, since none of them
// contain "certif"/"approval to construct"/"transmission siting order"/
// "uprate" anywhere in their real Synopsis text): Formula Rate Plan/Rate
// Stabilization filings (the single most common "U-" docket type by far);
// fuel-cost-adjustment-clause audits; storm/hurricane cost-recovery dockets;
// "Petition for Jurisdictional Determination" filings (asking whether LPSC
// has jurisdiction at all over a private-use network, not a construction
// certification — e.g. Docket U-37906, Dow InfraCo); and — the real, subtle
// one — "qualification of [Cooperative]'s assets as transmission facilities
// ... and approval of the transfer ... to [an] Independent Transmission
// Company" dockets (e.g. Dockets U-37537/U-37538, the GridLiance/Concordia/
// SLEMCO matters), which reclassify and transfer OWNERSHIP of EXISTING
// transmission assets to a different corporate entity — no new construction,
// no new MW, and confirmed to never use "certif"/"construct"/"transmission
// siting order" language in their own real Synopsis text, so they fall out
// of scope by construction rather than needing a dedicated exclusion rule.
// EXCLUDE_RE is kept anyway as defense-in-depth against a real but
// unobserved-in-this-sample risk: LPSC's own FilingTypes list (confirmed
// live via GET /portal/PSC/FilingTypes) includes "Utilities - Annual ETC
// Certification Affidavit" and "Transportation - Application for Certificate
// with PCN" — routine administrative "certificate"/"certification" filings
// that would false-positive on a bare "certif" match if one ever appeared
// under a "U-" docket's Synopsis; none did in the real 191-docket sample.
//   Project-type classification order (storage checked first, matching this
//   series' precedent that a narrower/more specific term should win over a
//   broader one): STORAGE_RE ("battery"/"energy storage") beats TRANSMISSION_RE
//   (a "NNNkV" voltage figure, or "transmission project"/"transmission siting
//   order") beats GENERATING_RE (solar/gas/nuclear/"power station"/"power
//   purchase agreement"/"uprate"/"solar portfolio"). Real confirmed case this
//   ordering matters for: Docket U-37799's Synopsis mentions both "a Battery
//   Energy Storage Agreement" (the actual thing being newly certified) AND
//   "the ... Amite Solar Power Purchase Agreement" (an existing PPA merely
//   being amended) — storage-first classification correctly tags this as the
//   storage project it actually is. A generic mixed "generation and
//   transmission resources" Synopsis with no kV figure and no specific fuel
//   named (Dockets U-37882/U-37425, both real large-load-customer generation
//   deals) falls through to generation/fuelType="other", flagged in
//   dataQualityNote — deliberately not guessed at further, since the real
//   underlying resource mix (confirmed for U-37425's real "Laidley" project
//   via later document titles, not the Synopsis itself) isn't stated in the
//   one field this module reads.
//   Capacity: MW-only (`\bMW\b`), never kV — a transmission line's kV figure
//   is voltage, not capacity, and is deliberately never written into
//   capacityValue/capacityUnit (it stays visible in the docket's own name/
//   causeDetail text instead). Real coverage is low — only 1 of the 19 real
//   sample candidates (Docket U-36697, "up to 3,000 MW of solar resources")
//   states an MW figure in its own Synopsis text — documented, not treated
//   as a bug, same as this series' standing convention for thin structured
//   capacity data (kyPscDockets.ts, wvPscDockets.ts).
//   No project-name extraction is attempted from Synopsis text: real live
//   phrasing is far more irregular than MD/WV's own caption text (compare
//   "the Resilient Park 345kV transmission project" vs. "a Battery Energy
//   Storage Agreement" vs. "the 2022 Solar Portfolio" vs. a bare exemption
//   request naming no project at all) — the same greedy-extraction hazard
//   this series' Maryland module documented for its own county regex, just
//   for project names instead of counties. `name` is built from the
//   docket's own applicant/party caption instead (see extractApplicant), and
//   the full real Synopsis text is preserved verbatim in causeDetail so the
//   real project name is never lost, just not parsed out into a dedicated
//   field.
//
// PARISH: Louisiana has 64 parishes, not counties (per this project's own
// brief) — extracted the same way wvPscDockets.ts extracts WV counties, via
// a hardcoded whitelist of all 64 real parish names rather than a free-form
// "capitalized words before Parish" regex (the exact greedy-regex hazard
// this series' Maryland module documented). Real coverage is low: most real
// Synopsis text names a specific project (by kV line name, plant name, or
// agreement) rather than a parish — of the 191-docket real sample, only a
// small minority of Synopsis strings name a parish at all. Documented as a
// real, low-but-nonzero-coverage limitation, not a bug — matching this
// series' standing convention for thin structured location data.
//
// Real per-run timing measured 2026-08-24 against the live shared DB: a
// full run against the real population (243 "U-" dockets checked, 25 real
// candidates each requiring an OrderSearch fetch) completed in ~151s,
// comfortably inside the 300s cron budget.
//
// Wired to Vercel Cron weekly, 08:30 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-la-psc/route.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://lpscpubvalence.lpsc.louisiana.gov";
const DOCKET_SEARCH_URL = `${BASE_URL}/portal/PSC/DocketSearch`;
const DOCKET_DETAILS_URL = (matterId: string) => `${BASE_URL}/portal/PSC/DocketDetails?docketId=${matterId}`;
const ORDER_SEARCH_URL = `${BASE_URL}/portal/PSC/OrderSearch`;

// Real live "U-" (Utility) docket population is ~45-50/year (confirmed via
// a live 2023-01-01..2026-08-24 sample: 191 dockets). Comfortably below this
// for headroom across several years of future filing volume before this
// needs raising — see module header FETCHING/FUEL for why the raw
// docket-detail-fetch count, not just the ~19/191 real-candidate rate, is
// what this caps.
export const MAX_CANDIDATES = 400;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
// Real confirmed longest-pending real candidate is Southern Spirit
// Transmission (Docket U-36669, filed 2023-02-16, resolved via Order
// 2024-08-xx — about 18 months) and Docket U-37882 (Entergy generation/
// transmission certification, filed 2026-03-26, still pending with a
// Commission vote scheduled for December 2026 per its own procedural
// order — about 9 months and counting). A 5-year lookback keeps generous
// margin above both real observations, matching this series' standing
// convention (see mdPscDockets.ts's LOOKBACK_YEARS) of a multi-year safety
// margin rather than tuning tightly to the shortest real observed case.
const LOOKBACK_YEARS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as every other module in this series, not a full HTML-entity
// library. &#160; (nbsp) is confirmed common in real Synopsis text (e.g.
// "Formula Rate Plan annual&#160;earnings monitoring report").
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

// LPSC's JSON endpoints serialize dates as ASP.NET's classic
// "/Date(1730264400000)/" (milliseconds since Unix epoch) — confirmed live
// across DocketSearch/OrderSearch responses.
function parseMsDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /\/Date\((-?\d+)\)\//.exec(raw);
  if (!m) return null;
  const d = new Date(Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// LPSC's DocketSearch/OrderSearch date-range params use the same "M/d/yyyy"
// format the site's own Kendo DatePickers are configured with (confirmed
// live against a working request) — no leading zeros required.
function formatDateParam(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

interface DocketListRecord {
  matterId: string;
  docketNumber: string;
  description: string;
  dateFiled: Date | null;
}

interface DocketSearchRow {
  MatterId: number;
  MatterNumber: string;
  DateFiled: string | null;
  Description: string;
  Total: number;
}
interface DocketSearchResponse {
  Data: DocketSearchRow[];
  Total: number;
}

// See module header FETCHING for why `sort=DateFiled-desc` (a single flat
// string) is required instead of Kendo's usual `sort[0][field]=...` bracket
// form — confirmed live that the bracket form throws a server-side 500.
async function fetchDocketSearchPage(startDate: Date, endDate: Date, page: number, pageSize: number): Promise<DocketSearchResponse> {
  const params = new URLSearchParams();
  params.set("paramSet[DocketNumber]", "U-");
  params.set("paramSet[StartDate]", formatDateParam(startDate));
  params.set("paramSet[EndDate]", formatDateParam(endDate));
  params.set("paramSet[CompanyName]", "");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  params.set("skip", String((page - 1) * pageSize));
  params.set("take", String(pageSize));
  params.set("sort", "DateFiled-desc");

  const res = await fetch(DOCKET_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`LA PSC DocketSearch request failed (${res.status}) for page ${page}`);
  }
  const json = (await res.json()) as DocketSearchResponse;
  if (!Array.isArray(json.Data)) {
    throw new Error(
      "LA PSC DocketSearch response didn't contain a recognizable Data array — the API shape likely changed. Check fetchDocketSearchPage in src/lib/ingest/laPscDockets.ts against a fresh response.",
    );
  }
  return json;
}

async function searchUDockets(startDate: Date, endDate: Date): Promise<DocketListRecord[]> {
  const pageSize = 100;
  const first = await fetchDocketSearchPage(startDate, endDate, 1, pageSize);
  const rows: DocketSearchRow[] = [...first.Data];
  const totalPages = Math.ceil(first.Total / pageSize);
  for (let page = 2; page <= totalPages; page++) {
    await sleep(REQUEST_DELAY_MS);
    const next = await fetchDocketSearchPage(startDate, endDate, page, pageSize);
    rows.push(...next.Data);
  }
  return rows.map((r) => ({
    matterId: String(r.MatterId),
    docketNumber: r.MatterNumber,
    description: decodeHtmlEntities(r.Description ?? ""),
    dateFiled: parseMsDate(r.DateFiled),
  }));
}

interface DocketDetail {
  docketNumber: string;
  status: string | null;
  synopsis: string | null;
  description: string | null;
}

// Confirmed live 2026-08-24: DocketDetails is fully server-rendered (no
// extra AJAX call needed for these fields) — see module header FETCHING.
const STATUS_FIELD_RE = /for="MatterStatus">Status<\/label>\s*<br\s*\/?>\s*([\s\S]*?)<\/div>/i;
const SYNOPSIS_FIELD_RE = /for="MatterSynopsis">Synopsis<\/label>\s*<br\s*\/?>\s*([\s\S]*?)<\/div>/i;
const DESCRIPTION_FIELD_RE = /for="MatterDescription">Description<\/label>\s*<br\s*\/?>\s*([\s\S]*?)<\/div>/i;

async function fetchDocketDetail(matterId: string, docketNumber: string): Promise<DocketDetail> {
  const res = await fetch(DOCKET_DETAILS_URL(matterId), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    throw new Error(`LA PSC DocketDetails request failed (${res.status}) for docket ${docketNumber} (id ${matterId})`);
  }
  const html = await res.text();
  if (!/Docket Details/i.test(html)) {
    throw new Error(
      `LA PSC DocketDetails response for docket ${docketNumber} didn't contain the expected "Docket Details" heading — the page structure likely changed. Check fetchDocketDetail in src/lib/ingest/laPscDockets.ts against a fresh response.`,
    );
  }
  const statusMatch = STATUS_FIELD_RE.exec(html);
  const synopsisMatch = SYNOPSIS_FIELD_RE.exec(html);
  const descriptionMatch = DESCRIPTION_FIELD_RE.exec(html);
  return {
    docketNumber,
    status: statusMatch ? stripTags(statusMatch[1]) || null : null,
    synopsis: synopsisMatch ? stripTags(synopsisMatch[1]) || null : null,
    description: descriptionMatch ? stripTags(descriptionMatch[1]) || null : null,
  };
}

interface OrderRow {
  OrderId: number;
  DocumentNumber: string;
  OrderDate: string | null;
  Description: string | null;
  Synopsis: string | null;
}
interface OrderSearchResponse {
  Data: OrderRow[];
  Total: number;
}

async function fetchOrders(docketNumber: string): Promise<OrderRow[]> {
  const params = new URLSearchParams();
  params.set("paramSet[OrderNumber]", "");
  params.set("paramSet[FullText]", "");
  params.set("paramSet[DocketNumber]", docketNumber);
  params.set("paramSet[CompanyName]", "");
  params.set("paramSet[StartDate]", "");
  params.set("paramSet[EndDate]", "");
  params.set("page", "1");
  params.set("pageSize", "20");
  params.set("skip", "0");
  params.set("take", "20");
  params.set("sort", "OrderDate-desc");

  const res = await fetch(ORDER_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`LA PSC OrderSearch request failed (${res.status}) for docket ${docketNumber}`);
  }
  const json = (await res.json()) as OrderSearchResponse;
  if (!Array.isArray(json.Data)) {
    throw new Error(
      `LA PSC OrderSearch response for docket ${docketNumber} didn't contain a recognizable Data array — the API shape likely changed. Check fetchOrders in src/lib/ingest/laPscDockets.ts against a fresh response.`,
    );
  }
  // OrderDate-desc confirmed live (most-recent order first) — see module
  // header STATUS.
  return json.Data;
}

type Resolution = "granted" | "denied" | "dismissed" | null;

// See module header STATUS for how each pattern below was calibrated
// against real, live-confirmed LPSC orders (including a real 2012 denial
// and a real procedural-order false-positive risk both GRANT_RE/DENY_RE
// deliberately avoid). Real bug found and fixed during this project's own
// verification step (not caught by the original calibration): LPSC's real
// live Order Search JSON returns a curly Unicode apostrophe (U+2019, "’")
// in "Judge’s Recommendation", not a straight ASCII one — a GRANT_RE
// written with a literal straight `'s` silently failed to match Docket
// U-36669's real order text ("accepts the Administrative Law Judge’s
// Recommendation..."), leaving a confirmed-granted docket wrongly shown as
// still pending. `['’]s` below matches both forms.
const DENY_RE = /\b(?:should be|is|are)\s+denied\b|\bdenies\s+(?:the\s+)?(?:application|certification|request)\b/i;
const DISMISS_RE = /\bdismisses?\s+this\s+matter\b|\bis\s+dismissed\b/i;
const GRANT_RE =
  /\bcertifies\b|\baccepts\s+the\s+settlement\b|\baccepts\s+the\s+(?:administrative law judge(['’]s)?|alj(['’]s)?)\s+recommendation\b|\bis\s+approved\b|\bare\s+approved\b|\bapproving\b|\bgrants?\s+(?:the\s+)?(?:application|certificate|certification)\b|\bapproves\b/i;

// Scans a docket's orders, most-recent-first, for the first one carrying a
// resolving verdict — see module header STATUS.
function detectResolution(orders: OrderRow[]): Resolution {
  for (const order of orders) {
    const text = decodeHtmlEntities(order.Synopsis ?? order.Description ?? "");
    if (DENY_RE.test(text)) return "denied";
    if (DISMISS_RE.test(text)) return "dismissed";
    if (GRANT_RE.test(text)) return "granted";
  }
  return null;
}

// See module header FUEL/PROJECT TYPE & CAPACITY — calibrated against a
// full, real, live 191-docket sample (all real "U-" dockets filed
// 2023-01-01..2026-08-24) with zero false positives.
const CONTENT_RE = /\bcertif\w*\b|\bapproval to construct\b|\bapproval for (?:the )?construct\w*\b|\btransmission siting order\b|\buprate\b/i;
// Defense-in-depth only — see module header FUEL/PROJECT TYPE & CAPACITY.
// Not observed live under a real "U-" docket's Synopsis in the 191-docket
// sample, but LPSC's own FilingTypes list (GET /portal/PSC/FilingTypes)
// confirms these routine administrative "certificate"/"certification" filing
// categories exist elsewhere in the system.
const EXCLUDE_RE = /\bcertification affidavit\b|\bcertificate of compliance\b|\bcommon carrier certificate\b|\bpayphone certificate\b/i;

const STORAGE_RE = /\bbattery\b|\benergy storage\b|\bbess\b/i;
const KV_RE = /\b\d[\d,]*(?:\.\d+)?\s*kv\b/i;
const TRANSMISSION_RE = /\btransmission (?:project|siting|facilit)/i;
const GENERATING_RE =
  /\bsolar\b|\bgenerat(?:ion|ing|or)\b|\bpower station\b|\bpower plant\b|\bnatural gas plant\b|\buprate\b|\bnuclear\b|\bpower purchase agreement\b|\bcapacity purchase agreement\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/\bwind\s?power\b|\bwind\s+energy\b|\bwind\s+turbine/i, "wind_onshore"],
  [/\bnatural gas\b|\bgas[- ]fired\b|\bgas plant\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Picks whichever fuel keyword appears FIRST in the text, same rationale
// wvPscDockets.ts documents for its own pickFuelType (a fixed-priority table
// checked in declaration order could misclassify a hybrid mention).
function pickFuelType(text: string): FuelType | null {
  let best: { fuel: FuelType; index: number } | null = null;
  for (const [re, fuel] of FUEL_KEYWORDS) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { fuel, index: m.index };
  }
  return best ? best.fuel : null;
}

// See module header FUEL/PROJECT TYPE & CAPACITY for the storage-before-
// transmission-before-generation check order and the real Docket U-37799
// case it was calibrated against.
function inferProjectTypeAndFuel(text: string): { projectType: ProjectType; fuelType: FuelType } {
  if (STORAGE_RE.test(text)) return { projectType: "storage", fuelType: "storage" };
  if (KV_RE.test(text) || TRANSMISSION_RE.test(text)) return { projectType: "transmission", fuelType: "transmission" };
  if (GENERATING_RE.test(text)) return { projectType: "generation", fuelType: pickFuelType(text) ?? "other" };
  // Real, confirmed gap: a handful of real candidates (e.g. bare Transmission
  // Siting Order exemption requests naming no specific project) carry no
  // facility-type-revealing language at all beyond CONTENT_RE's own match.
  // Generation is used as the least-wrong bucket, matching this series'
  // "plurality default" convention (see moPscDockets.ts).
  return { projectType: "generation", fuelType: "other" };
}

// MW only — kV is transmission-line voltage, not capacity, and is
// deliberately never written into capacityValue/capacityUnit. See module
// header FUEL/PROJECT TYPE & CAPACITY.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*MW\b/;

function extractCapacityMw(text: string): number | null {
  const m = CAPACITY_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Louisiana's 64 real parishes (there is no "county" in Louisiana) — see
// module header PARISH for why this is a hardcoded whitelist rather than a
// free-form regex.
const LA_PARISHES = [
  "Acadia", "Allen", "Ascension", "Assumption", "Avoyelles", "Beauregard", "Bienville", "Bossier",
  "Caddo", "Calcasieu", "Caldwell", "Cameron", "Catahoula", "Claiborne", "Concordia", "De Soto",
  "East Baton Rouge", "East Carroll", "East Feliciana", "Evangeline", "Franklin", "Grant", "Iberia", "Iberville",
  "Jackson", "Jefferson Davis", "Jefferson", "Lafayette", "Lafourche", "LaSalle", "Lincoln", "Livingston",
  "Madison", "Morehouse", "Natchitoches", "Orleans", "Ouachita", "Plaquemines", "Pointe Coupee", "Rapides",
  "Red River", "Richland", "Sabine", "St. Bernard", "St. Charles", "St. Helena", "St. James", "St. John the Baptist",
  "St. Landry", "St. Martin", "St. Mary", "St. Tammany", "Tangipahoa", "Tensas", "Terrebonne", "Union",
  "Vermilion", "Vernon", "Washington", "Webster", "West Baton Rouge", "West Carroll", "West Feliciana", "Winn",
];
// Longest names first so e.g. "Jefferson Davis" matches before bare
// "Jefferson" — same ordering hazard as any overlapping-prefix whitelist.
const LA_PARISH_ALT = [...LA_PARISHES]
  .sort((a, b) => b.length - a.length)
  .map((p) => p.replace(/\./g, "\\.?").replace(/\s+/g, "\\s+"))
  .join("|");
const PARISH_RE = new RegExp(`\\b(${LA_PARISH_ALT})\\s+Parish\\b`, "gi");

function extractParishes(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(PARISH_RE)) {
    const canonical = LA_PARISHES.find((p) => p.toLowerCase().replace(/[.\s]/g, "") === m[1].toLowerCase().replace(/[.\s]/g, ""));
    if (canonical && !found.includes(canonical)) found.push(canonical);
  }
  return found;
}

// Real observed forms: "Entergy Louisiana, LLC, ex parte." (single filer),
// "Dixie Electric Membership Corporation, Amite Solar, LLC and Amite Energy
// Storage, LLC." (joint filers, no "ex parte" suffix) — confirmed against
// the real 191-docket sample.
function extractApplicant(description: string): string {
  return description
    .replace(/,?\s*ex parte\.?\s*$/i, "")
    .replace(/\.\s*$/, "")
    .trim();
}

function normalizeDocket(record: DocketListRecord, detail: DocketDetail, resolution: Resolution): NormalizedProject {
  const matchKey = resolveMatchKey("la-psc", record.docketNumber);
  const synopsis = detail.synopsis ?? "";
  const description = detail.description ?? record.description;
  const combinedText = `${synopsis} ${description}`;
  const { projectType, fuelType } = inferProjectTypeAndFuel(combinedText);
  const capacityMw = extractCapacityMw(synopsis);
  const parishes = extractParishes(combinedText);
  const parish = parishes.length > 0 ? parishes.join(", ") : null;
  const applicant = extractApplicant(description);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "dismissed") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Louisiana Public Service Commission's public Valence docket portal (Docket Search, Docket Details, and Order Search).",
    'LPSC\'s own per-docket "Status" field (Open/Closed) is not used to determine whether this project is still waiting — it was confirmed unreliable by hand: multiple real dockets with a Commission order already granting certification still show Status "Open" (LPSC keeps a docket open for post-approval compliance monitoring). "Still waiting" here is instead determined by scanning the docket\'s own Commission orders (via LPSC\'s separate Order Search) for a dispositive grant/deny/dismissal — see the ingestion module header for how this was calibrated against real orders, including a real 2012 denial and a real procedural-order false positive it\'s written to avoid.',
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket's own Synopsis text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket's own Synopsis text.");
  }
  if (parish) {
    const word = parish.includes(",") ? "Parishes" : "Parish";
    dataQualityNoteParts.push(`Located in ${parish} ${word}, Louisiana, per the docket's own Synopsis text — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (LA PSC Docket ${record.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "LA",
    county: parish,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: record.dateFiled,
    dateConfidence: "exact",
    currentStatus: `Louisiana PSC Docket ${record.docketNumber}: ${resolution ?? "pending"} (LPSC's own docket status field: ${detail.status ?? "unknown"})`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on certification from the Louisiana Public Service Commission — Docket No. ${record.docketNumber}, "${synopsis || description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `LA PSC Docket No. ${record.docketNumber}`,
        url: DOCKET_DETAILS_URL(record.matterId),
      },
    ],
    externalIds: { laPsc: record.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestLaPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 1);
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - LOOKBACK_YEARS);

  const allCandidates = await searchUDockets(startDate, endDate);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let realApplicationCandidates = 0;

  for (const record of selectWithRotation(allCandidates, maxCandidates, ROTATING_RECENT_SLOTS)) {
    const matchKey = resolveMatchKey("la-psc", record.docketNumber);
    try {
      // One politeness delay per HTTP request actually made this iteration
      // — a skipped (non-candidate) docket makes only the DocketDetails
      // request, a real candidate also makes an OrderSearch request.
      const detail = await fetchDocketDetail(record.matterId, record.docketNumber);
      await sleep(REQUEST_DELAY_MS);
      const synopsisText = detail.synopsis ?? "";
      if (!CONTENT_RE.test(synopsisText) || EXCLUDE_RE.test(synopsisText)) {
        // Not a real generation/storage/transmission certification
        // application — see module header FUEL/PROJECT TYPE & CAPACITY.
        continue;
      }
      realApplicationCandidates += 1;
      const orders = await fetchOrders(record.docketNumber);
      await sleep(REQUEST_DELAY_MS);
      const resolution = detectResolution(orders);
      const normalized = normalizeDocket(record, detail, resolution);
      toUpsert.push(normalized);
    } catch (err) {
      errors.push({ matchKey, message: String(err) });
    }
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a docket that
  // ages out of the LOOKBACK_YEARS window without ever receiving a
  // resolving Order is deliberately left untouched now, not guessed into
  // a resolved stage — see the header for why.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = allCandidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allCandidates.length,
    realApplicationCandidates,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestLaPscDockets()
    .then((summary) => {
      console.log(
        `Louisiana PSC docket ingestion complete: ${summary.candidatesFound} "U-" dockets checked, ` +
          `${summary.realApplicationCandidates} real generation/storage/transmission certification applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
