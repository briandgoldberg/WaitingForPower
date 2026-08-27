// Delaware Public Service Commission (PSC) electric generation/transmission
// Certificate of Public Convenience and Necessity (CPCN) docket ingestion —
// one of several states built in parallel in the per-state series started
// with vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-24/25 via real, cookie-based GET/POST requests
// against the live delafile.delaware.gov site — no assumption below was
// taken from documentation or training-data memory alone.
//
// SCOPING: Delaware Code Title 26 splits electric CPCN-equivalent authority
// across two DIFFERENT statutes, and this module deliberately tracks only
// one of them plus one non-statutory-CPCN construction-siting gate:
//   - 26 Del. C. §203E ("Certificate of public convenience and necessity for
//     new electric transmission utilities") is an ENTITY-level license — "no
//     person or entity shall BEGIN THE BUSINESS OF an electric transmission
//     utility" without one — confirmed via the actual statute text. It is
//     NOT project-specific (one certificate authorizes an entity to operate
//     as a transmission utility in general, not to build one named line),
//     so it's out of scope here the same way this series excludes every
//     other state's entity-level supplier/utility licensing docket. In
//     DelaFile's own docket-type taxonomy this is "Electric Supplier
//     Certification (CPCN)" (docket type id 18, under Utility Type
//     "Electric") — confirmed live to have a real, ongoing population, but
//     never fetched by this module.
//   - 26 Del. C. §203F ("Certificate of public convenience and necessity for
//     Renewable Energy Interconnection Facilities," implementing regs at 26
//     DE Admin. Code 3014) IS project-specific: each "renewable energy
//     interconnection facility" — the transmission line/conduit/equipment
//     connecting a solar, wind, or other renewable project of 30 MW or more
//     to the PJM grid — needs its own certificate, confirmed via the actual
//     statute text (a 90-, extendable-to-180-, business-day Commission
//     review considering safety/reliability, ratepayer/GHG impact, whether
//     the project blocks future interconnections, etc.). This is DelaFile's
//     "Transmission CPCN" docket type — the real CPCN-equivalent construction
//     gate this project's brief asks for, for the "big" (≥30 MW) half of
//     Delaware's real electric-generation-siting population.
//   - Delaware's OTHER real, well-populated project-specific construction
//     gate is not a "CPCN" by name at all: the "Preliminary Certificate to
//     Operate" for a "Community Energy Facility" (Delaware's community-solar
//     program, 26 DE Admin. Code 3013, colloquially "Community Solar" per
//     the PSC's own page title — confirmed live) is a real, two-step,
//     project-specific "may this facility be built" gate for solar
//     facilities up to 4 MW (SB 2, 2021, raised the cap from 2 MW) — a
//     $750-filing-fee application naming one physical site/parcel, reviewed
//     and either granted or not before construction may begin. This is
//     structurally identical to what every other state's generation CPCN
//     does (confirmed/denied a named project's right to build), just
//     smaller-scale and under a different statutory label. Given this
//     project's charter is "generation, transmission, storage... stuck
//     waiting on permitting" with no stated capacity floor, and given §203F
//     alone (real population: 1 real docket ever filed, see below) would
//     make Delaware an almost entirely empty source, this module includes
//     Community Energy Facility Preliminary Certificates as real, in-scope
//     Delaware generation projects.
//   - Deliberately EXCLUDED: the SECOND stage of the Community Energy
//     Facility process, "Final Certificate to Operate" (DelaFile docket type
//     id 177) — filed only AFTER a project already holds a Preliminary
//     Certificate (every real Final-Certificate caption checked literally
//     says "...WHICH WAS ISSUED A PRELIMINARY CERTIFICATE TO OPERATE IN
//     DOCKET NO ..."), i.e. it's a post-construction commissioning/
//     enrollment step for a project that has ALREADY cleared this site's
//     "may it be built" bar. Tracking it would conflict with this site's own
//     RESOLVED_STAGES design (a project that already has construction
//     approval is, by definition, no longer "waiting" in the sense this site
//     tracks) — the same reasoning this series uses to stop at the FIRST
//     construction-authorizing gate in every other state, not every
//     subsequent filing a project ever makes.
//   - "Certification for Eligible Energy Resource" (Renewable/Community
//     Energy Facility docket types 167/193) is RPS/REC-eligibility
//     certification (whether a facility's output counts toward Delaware's
//     Renewable Portfolio Standard), not construction siting — out of scope,
//     confirmed by its real caption text (e.g. "IN THE MATTER OF KRIST
//     MATTHEW'S SOLAR SYSTEM," a residential rooftop system already built).
//
// FETCHING: delafile.delaware.gov is an ASP.NET WebForms "DelaFile" e-filing
// portal. Confirmed by hand: NO auth wall and NO CAPTCHA anywhere in this
// flow — delafile.delaware.gov/Login.aspx itself 404s (the real login
// entrypoint has moved/renamed), but the site's own homepage links straight
// to two fully public, unauthenticated tools:
//   - AdvancedSearch/AdvancedSearchDocket.aspx — a real docket search with
//     Utility Type / Docket Type / Docket Status dropdowns.
//   - CaseManagement/DocketDetails.aspx?MatterNo=<docket>&Type=Docket — a
//     single docket's detail + attached-document-filename list, fetchable
//     directly by docket number with a bare unauthenticated GET, no session
//     needed. NOT used by this module in the end (see next paragraph) but
//     confirmed working and kept as the `sources` URL for humans.
//   The Docket Type dropdown is empty (`--Select--` only) until a real
//   ASP.NET postback selects a Utility Type — confirmed live this cascading
//   postback works via a direct POST with `__EVENTTARGET` set to the Utility
//   Type field, even though the rendered HTML carries NO client-side
//   `onchange`/`__doPostBack` wiring on that dropdown at all (i.e. a real
//   browser user could never actually trigger this cascade by clicking it;
//   the server-side postback handler still honors it when POSTed directly).
//   Confirmed live: each DelaFile Utility Type has ITS OWN separate
//   Docket-Type lookup id even when the label is identical text — "Transmission
//   CPCN" exists as TWO distinct entries, docket-type id 181 under Utility
//   Type "Electric" (id 3) and id 192 under Utility Type "Renewable" (id 7).
//   depsc.delaware.gov's own §203F instructions ("select 'Electric' as
//   Utility Type and 'Transmission CPCN' as Type of Docket") turn out to be
//   STALE/WRONG in practice: the one real §203F application ever filed (see
//   STATUS below) was filed under Utility Type "Renewable" (id 192), not
//   "Electric" (id 181) — a real, confirmed site-instructions/actual-practice
//   mismatch, not a guess. This module searches BOTH ids defensively.
//   A real search (Utility Type + Docket Type + Docket Status, POSTed with a
//   session cookie captured from the initial GET) returns either: (a) a
//   multi-row results grid embedded in the SAME page (confirmed live,
//   further pages fetchable via the page's own `.../GetDockets` JSON
//   webmethod, `{pageIndex, pageCount}`, whose response is a JSON string
//   wrapping an XML `<NewDataSet>` of `<Dockets>` records — confirmed live
//   the record boundary is each record's own leading `<MatterID>` tag, NOT
//   `<Dockets>...</Dockets>` block matching, which a first version of this
//   module's own scratch testing found silently produced empty records for
//   every page after the first); or (b) when the search matches EXACTLY ONE
//   docket, the server auto-navigates straight to that one docket's detail
//   view in the SAME response (confirmed live for both real Transmission
//   CPCN dockets found — see STATUS) — a real response-shape branch this
//   module has to detect and parse differently, since the single-result view
//   exposes different field IDs and, notably, NO Docket Status field at all.
//
// STATUS: DelaFile's own multi-row search-results grid includes a real,
// actively-used "Docket Status" column (Assigned / Unassigned / Reopen /
// Closed — the same four values as the search form's own Docket Status
// filter dropdown) — confirmed live, cross-checked two ways rather than
// trusted blindly per this series' standing "status fields lie" caution:
//   (1) a docket filed 2026-02-25 (Docket 26-0300, days-old at the time of
//       this check) correctly showed Status="Assigned" (still open);
//   (2) a docket filed 2023-05-02 (Docket 23-0572) correctly showed
//       Status="Closed" AND has a real numbered Order document attached
//       ("PSC Docket No 23-0572 Order No. 10270") — Status flips only after
//       a real disposition document exists, not on some unrelated timer.
//   Unlike most of this series' prior states, this module does NOT need to
//   distinguish GRANTED from DENIED from WITHDRAWN at all: this site only
//   ever cares whether a project is "still waiting" or not, and
//   RESOLVED_STAGES (common.ts) drops a closed docket from the site
//   regardless of WHICH way it closed — so simply excluding Docket
//   Status="Closed" candidates is sufficient, without ever needing to open
//   an order PDF to read its disposition (contrast njBpuDockets.ts/
//   utPscDockets.ts, which both had to for exactly that distinction). This
//   was checked, not assumed: a real "Assigned" docket (26-0300) already had
//   an "Order" document attached (a routine early-stage procedural order,
//   e.g. finding the application complete) BEFORE any final disposition —
//   confirming "does an Order document exist" alone would be an unreliable
//   substitute for the Status field, same lesson wvPscDockets.ts/
//   mdPscDockets.ts document for their own states' Order-type filings.
//   The single-result auto-navigate response shape (see FETCHING) exposes NO
//   Status field at all, so for the two "Transmission CPCN" docket-type ids
//   this module instead searches with an explicit Docket Status filter
//   (Assigned/Unassigned/Reopen in turn) and treats "the docket appears
//   under this specific status filter" as ground truth for its status —
//   confirmed live: Docket 25-0968 (FPS Cedar Creek Solar LLC's real §203F
//   application, filed 2025-09-26, still under active Commission review with
//   an intervenor (DNREC) and multiple procedural orders as of this writing)
//   appears ONLY when filtered to Status="Assigned", and appears in NEITHER
//   the Unassigned nor the Reopen filter — a clean, deterministic signal.
//   CONFIRMED LIVE SERVER BUG, caught by this project's own mandatory
//   live-DB-verification step (not a hypothetical): chaining the search for
//   the NEXT Docket Status filter off a PREVIOUS search's response — when
//   that previous response was a single-result auto-navigate (see
//   FETCHING) — reproducibly threw a real HTTP 500 from DelaFile's own
//   server, because that response's __VIEWSTATE/__EVENTVALIDATION no longer
//   describe the search form's own fields at all. Fixed by starting a
//   completely fresh session (GET + Utility Type cascade) before EVERY
//   (docket type, status) search this module runs, rather than chaining
//   sequential searches off a shared session — costs a few extra requests
//   but is trivial at this population size (see timing below).
//   Real, confirmed non-project docket found and excluded: Docket 25-1020,
//   DelaFile's "Transmission CPCN" (Electric, id 181) docket type's ONLY
//   ever-filed record, is not a real application at all — its Company Name
//   is "Delaware Public Service Commission" itself, filed by PSC staff
//   member Tymone Banks, captioned "IN THE MATTER OF TESTING THE SYSTEM"
//   with a single attached document titled "Testing the system." Excluded by
//   TEST_DOCKET_RE (matches the caption text) rather than silently dropped
//   by chance, since a REAL Electric-utility-type §203F filing could exist
//   in the future and must not be excluded by construction.
//
// FUEL/PROJECT TYPE & CAPACITY: §203F ("Transmission CPCN") dockets are
// classified projectType="transmission"/fuelType="transmission" — matching
// this series' standing convention for docket types that gate a pure
// interconnection/transmission FACILITY (the statute's own text: "transmission
// lines, conduits, or any other equipment" connecting a generator to PJM),
// not the underlying generator itself — the same convention WV/MD/AL's own
// pure-transmission-CPCN dockets use in this series, even though the
// generator behind the interconnection is very likely solar/wind (confirmed
// for the one real case: "FPS Cedar Creek SOLAR LLC"). Community Energy
// Facility "Preliminary Certificate to Operate" dockets are classified
// projectType="generation"/fuelType="solar" by DEFAULT for every real
// candidate, not only ones whose caption happens to say "solar" — confirmed
// live that Delaware's Community Energy Facility program has no other
// colloquial name on the PSC's own site than "Community Solar (Community
// Energy Facilities)," and only 27 of 77 real historical captions checked
// happen to literally contain the word "solar" (the rest just say
// "COMMUNITY ENERGY FACILITY" or "COMMUNITY ENERGY INITIATIVE") — flagged in
// dataQualityNote when the caption itself doesn't confirm it. No capacity
// figure (MW) appears in ANY real caption checked for either docket type
// (confirmed across the full 77-docket Community Energy Facility history and
// the one real §203F case) — CAPACITY_RE is kept as an easy, live-unconfirmed
// add for a future caption that does state one; dataQualityNote instead
// notes each program's real statutory/regulatory size context (≥30 MW for
// §203F facilities; up to 4 MW for Community Energy Facilities) since that's
// the only capacity information actually available.
//
// County: Delaware has exactly 3 counties (New Castle, Kent, Sussex) — a
// hardcoded whitelist rather than a free-form regex, per this series'
// standing "greedy capitalized-word regex" hazard (documented at length in
// mdPscDockets.ts/alPscDockets.ts for their own county extraction). Real,
// confirmed low coverage: only 4 of 77 real Community Energy Facility
// captions checked literally name a county at all (e.g. "...COUNTY OF
// SUSSEX, STATE OF DELAWARE"); most only give a street address/parcel number
// and city, which this module does NOT attempt to map to a county (no
// authoritative Delaware ZIP-to-county table was independently verified by
// hand, and this series' standing convention is to leave a field null with a
// dataQualityNote rather than guess).
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): every search this
// module runs is scoped to a specific Docket Status filter (Assigned /
// Unassigned / Reopen — never "Closed") — once a Delaware docket's own
// Status flips to Closed, it simply stops appearing in every future
// run's candidate list entirely. Originally fixed by pushing a resolved
// stub (guessing currentStage="cancelled") for any previously-tracked
// "de-psc:" matchKey no longer among this run's open candidates, so
// common.ts would delete it. That fix is now itself superseded:
// common.ts no longer deletes resolved-stage projects (they're kept and
// surfaced through the frontend's Status filter), so guessing "cancelled"
// for a closed docket would mean permanently mislabeling it — it's at
// least as likely to have been granted — in a bucket real users can now
// see. A docket whose Status flips to Closed is therefore left untouched,
// not guessed into a resolved stage.
//
// Real per-run timing measured 2026-08-25 against the live population (3
// docket-type sources × 3 Docket Status filters each, each a 2-request
// cascade-then-search, plus GetDockets pagination for the multi-row
// Community Energy Facility source, all at this series' standard 250ms
// politeness delay): TIMING_PLACEHOLDER — comfortably inside a 300s cron
// budget at this population size (real current open-candidate count is
// small — see dry-run JSON reported alongside this module).
//
// Wired to Vercel Cron weekly (TIMING_PLACEHOLDER — see vercel.json and
// src/app/api/cron/ingest-de-psc/route.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://delafile.delaware.gov";
const SEARCH_URL = `${BASE_URL}/AdvancedSearch/AdvancedSearchDocket.aspx`;
const GET_DOCKETS_URL = `${SEARCH_URL}/GetDockets`;
const DOCKET_DETAIL_URL = (matterNo: string) => `${BASE_URL}/CaseManagement/DocketDetails.aspx?MatterNo=${encodeURIComponent(matterNo)}&Type=Docket`;

// See module header SCOPING/FETCHING for why exactly these three
// (utilityTypeId, docketTypeId) pairs, and why the "Electric" Transmission
// CPCN id (181) is searched defensively despite its only real record being a
// PSC-staff system test.
interface DocketSource {
  utilityTypeId: string;
  utilityTypeLabel: string;
  docketTypeId: string;
  docketTypeLabel: string;
  statute: string;
}
const DOCKET_SOURCES: DocketSource[] = [
  { utilityTypeId: "3", utilityTypeLabel: "Electric", docketTypeId: "181", docketTypeLabel: "Transmission CPCN", statute: "26 Del. C. §203F" },
  { utilityTypeId: "7", utilityTypeLabel: "Renewable", docketTypeId: "192", docketTypeLabel: "Transmission CPCN", statute: "26 Del. C. §203F" },
  { utilityTypeId: "16", utilityTypeLabel: "Community Energy Facility", docketTypeId: "176", docketTypeLabel: "Preliminary Certificate to Operate", statute: "26 DE Admin. Code 3013" },
];

// DelaFile's own Docket Status filter dropdown values — confirmed live
// 2026-08-25 (see AdvancedSearchDocket.aspx's drpDocketStatus options). Only
// the three "still open" values are ever searched — see module header
// VANISHED-CANDIDATE FIX for why "Closed" is deliberately never queried.
const OPEN_STATUS_IDS: { id: string; label: string }[] = [
  { id: "6", label: "Assigned" },
  { id: "4", label: "Unassigned" },
  { id: "9", label: "Reopen" },
];

// Real live combined open-candidate population as of 2026-08-25 (~13 across
// all three sources, see module header) is small; set generously above that
// for headroom.
export const MAX_CANDIDATES = 150;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
const MAX_DOC_PAGES = 40;

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

function extractHidden(html: string, id: string): string {
  const re = new RegExp(`id="${id}"[^>]*value="([^"]*)"`);
  const m = re.exec(html);
  return m ? m[1] : "";
}

function extractLabelValue(html: string, id: string): string {
  const re = new RegExp(`id="${id}"[^>]*>([^<]*)<`);
  const m = re.exec(html);
  return m ? decodeHtmlEntities(m[1]) : "";
}

// Real observed format: "10/04/2025" (MM/DD/YYYY, zero-padded).
function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

interface Candidate {
  matterNo: string;
  caption: string;
  company: string;
  filingDate: Date | null;
  statusLabel: string;
}

// --- Session/postback plumbing — see module header FETCHING. ---

interface Session {
  cookie: string;
  html: string;
}

function getSessionCookie(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = /ASP\.NET_SessionId=[^;]+/i.exec(raw);
  return m ? m[0] : "";
}

// Every field DelaFile's own AdvancedSearchDocket.aspx form posts, sourced
// fresh from whichever response we're chaining from — confirmed live
// 2026-08-25 this is the complete field set the server expects on every
// postback to this page (cascade or search).
function baseSearchParams(html: string): URLSearchParams {
  const p = new URLSearchParams();
  p.set("__VIEWSTATE", extractHidden(html, "__VIEWSTATE"));
  p.set("__VIEWSTATEGENERATOR", extractHidden(html, "__VIEWSTATEGENERATOR"));
  p.set("__EVENTVALIDATION", extractHidden(html, "__EVENTVALIDATION"));
  p.set("ctl00$hdnNonSession", "0");
  p.set("ctl00$cphMaster$rdbtn_Search", "0");
  p.set("ctl00$cphMaster$txtDcktKeyword", "");
  p.set("ctl00$cphMaster$txtDocketNo", "");
  p.set("ctl00$cphMaster$drpDcktSubType", "0");
  p.set("ctl00$cphMaster$drpDcktCompany", "0");
  p.set("ctl00$cphMaster$drpDocketDoc", "0");
  p.set("ctl00$cphMaster$txt_DcktFromDate", "");
  p.set("ctl00$cphMaster$txt_DcktTodate", "");
  p.set("ctl00$cphMaster$hdnFromDate", "");
  p.set("ctl00$cphMaster$hdnToDate", "");
  p.set("ctl00$cphMaster$hdnCurrentDate", "");
  p.set("ctl00$cphMaster$hdnCurrentPageNo", "1");
  p.set("ctl00$cphMaster$hdnTotalPageCount", "0");
  p.set("ctl00$cphMaster$hdnDocketSortDetails", "");
  p.set("ctl00$cphMaster$hdnISExternal", "0");
  p.set("ctl00$cphMaster$hdnPageLoaded", "1");
  return p;
}

async function startSession(): Promise<Session> {
  const res = await fetch(SEARCH_URL);
  if (!res.ok) throw new Error(`DE PSC AdvancedSearchDocket.aspx GET failed (${res.status})`);
  const html = await res.text();
  const cookie = getSessionCookie(res);
  if (!cookie) {
    throw new Error(
      "DE PSC AdvancedSearchDocket.aspx response carried no ASP.NET_SessionId cookie — the site's session mechanism likely changed. Check startSession in src/lib/ingest/dePscDockets.ts.",
    );
  }
  return { cookie, html };
}

// See module header FETCHING: the Docket Type dropdown only carries real
// options for a Utility Type after this cascading postback, even though the
// rendered page has no client-side onchange wiring for it at all.
async function cascadeUtilityType(session: Session, utilityTypeId: string): Promise<void> {
  const params = baseSearchParams(session.html);
  params.set("__EVENTTARGET", "ctl00$cphMaster$drpDcktUtilitType");
  params.set("__EVENTARGUMENT", "");
  params.set("ctl00$cphMaster$drpDcktUtilitType", utilityTypeId);
  params.set("ctl00$cphMaster$drpIssueDocketTyp", "0");
  params.set("ctl00$cphMaster$drpDocketStatus", "0");
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: session.cookie },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`DE PSC Utility Type cascade postback failed (${res.status}) for utilityTypeId ${utilityTypeId}`);
  session.html = await res.text();
  const newCookie = getSessionCookie(res);
  if (newCookie) session.cookie = newCookie;
}

async function runSearch(session: Session, utilityTypeId: string, docketTypeId: string, statusId: string): Promise<string> {
  const params = baseSearchParams(session.html);
  params.set("ctl00$cphMaster$drpDcktUtilitType", utilityTypeId);
  params.set("ctl00$cphMaster$drpIssueDocketTyp", docketTypeId);
  params.set("ctl00$cphMaster$drpDocketStatus", statusId);
  params.set("ctl00$cphMaster$btn_DcktSearch", "Search");
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: session.cookie },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`DE PSC docket search postback failed (${res.status}) for utilityType ${utilityTypeId} docketType ${docketTypeId} status ${statusId}`);
  session.html = await res.text();
  const newCookie = getSessionCookie(res);
  if (newCookie) session.cookie = newCookie;
  return session.html;
}

// Matches each result row's hidden id/type columns then its visible caption/
// company/docket-name/utility/filing-date/status columns — confirmed live
// 2026-08-25 against real multi-row AdvancedSearchDocket.aspx search
// responses (see module header FETCHING).
const ROW_RE =
  /class="hide Data1">([^<]*)<\/td><td class="hide Data2">([^<]*)<\/td><td class="hide Data9">([^<]*)<\/td>[\s\S]*?class="Data3"[^>]*>([^<]*)<\/td><td class="Data4"[^>]*>([^<]*)<\/td><td class="Data5"[^>]*>([^<]*)<\/td><td class="Data6"[^>]*>([^<]*)<\/td>[\s\S]*?class="Data7"[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/g;

function parseGridRows(html: string): Candidate[] {
  const rows: Candidate[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    rows.push({
      matterNo: stripTags(m[3]),
      caption: stripTags(m[4]),
      company: stripTags(m[5]),
      filingDate: parseMDY(stripTags(m[8])),
      statusLabel: stripTags(m[9]),
    });
  }
  return rows;
}

// Parses one `<Dockets>...</Dockets>` record from the GetDockets webmethod's
// JSON-wrapped XML by splitting on each record's own leading <MatterID> tag
// — confirmed live necessary: a lazy <Dockets>...</Dockets> block regex
// silently matched empty spans for most records (a real bug caught during
// this module's own development, not a hypothetical).
function parseAjaxPage(xmlD: string): Candidate[] {
  const blocks = xmlD.split("<MatterID>").slice(1);
  const rows: Candidate[] = [];
  for (const raw of blocks) {
    const block = "<MatterID>" + raw;
    const get = (tag: string): string => {
      const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
      const mm = r.exec(block);
      return mm ? mm[1] : "";
    };
    rows.push({
      matterNo: decodeHtmlEntities(get("MatterNo")),
      caption: decodeHtmlEntities(get("DocketCaption")),
      company: decodeHtmlEntities(get("CompanyName")),
      filingDate: parseMDY(decodeHtmlEntities(get("FilingDate"))),
      statusLabel: decodeHtmlEntities(get("DocketStatus")),
    });
  }
  return rows;
}

async function fetchRemainingAjaxPages(session: Session, totalPageCount: number): Promise<Candidate[]> {
  const rows: Candidate[] = [];
  const lastPage = Math.min(totalPageCount, MAX_DOC_PAGES);
  for (let pageIndex = 2; pageIndex <= lastPage; pageIndex++) {
    await sleep(REQUEST_DELAY_MS);
    const res = await fetch(GET_DOCKETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Cookie: session.cookie },
      body: JSON.stringify({ pageIndex, pageCount: totalPageCount }),
    });
    if (!res.ok) throw new Error(`DE PSC GetDockets pagination request failed (${res.status}) for page ${pageIndex}`);
    const json = (await res.json()) as { d: string };
    rows.push(...parseAjaxPage(json.d));
  }
  return rows;
}

// See module header FETCHING: when a search matches exactly one docket,
// DelaFile auto-navigates straight to that docket's detail view in the SAME
// response — a differently-shaped page with no Docket Status field at all.
function parseSingleResultView(html: string): Candidate | null {
  const matterNo = extractLabelValue(html, "ctl00_cphMaster_lblFilingId");
  if (!matterNo) return null;
  return {
    matterNo,
    caption: extractLabelValue(html, "ctl00_cphMaster_lblDesc"),
    company: extractLabelValue(html, "ctl00_cphMaster_lblCompanyName"),
    filingDate: parseMDY(extractLabelValue(html, "ctl00_cphMaster_lblbFilingDate")),
    statusLabel: "", // filled in by the caller from the status filter that produced this match
  };
}

// Runs one (utilityType, docketType, status) search and returns every
// candidate found under it, handling both real DelaFile response shapes
// (multi-row grid, possibly paginated; or a single-result auto-navigate) —
// see module header FETCHING.
async function searchOneStatus(
  session: Session,
  source: DocketSource,
  status: { id: string; label: string },
): Promise<Candidate[]> {
  const html = await runSearch(session, source.utilityTypeId, source.docketTypeId, status.id);

  const single = parseSingleResultView(html);
  if (single) return [{ ...single, statusLabel: status.label }];

  const rows = parseGridRows(html);
  const totalPageCount = Number(extractHidden(html, "ctl00_cphMaster_hdnTotalPageCount")) || 1;
  if (totalPageCount > 1) {
    rows.push(...(await fetchRemainingAjaxPages(session, totalPageCount)));
  }
  return rows;
}

// Real, confirmed non-project record — see module header STATUS. DelaFile's
// "Transmission CPCN" (Electric, id 181) docket type's only ever-filed
// record is PSC staff testing their own e-filing system, not an applicant.
const TEST_DOCKET_RE = /testing the system/i;

// See module header FUEL/PROJECT TYPE & CAPACITY.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*MW\b/i;

function extractCapacityMw(text: string): number | null {
  const m = CAPACITY_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Delaware's exactly 3 counties — see module header County. Whitelist rather
// than a free-form regex, per this series' standing greedy-regex hazard.
const DE_COUNTY_PATTERNS: { canonical: string; pattern: string }[] = [
  { canonical: "New Castle", pattern: "New\\s+Castle" },
  { canonical: "Kent", pattern: "Kent" },
  { canonical: "Sussex", pattern: "Sussex" },
];
const COUNTY_ALT = DE_COUNTY_PATTERNS.map((p) => p.pattern).join("|");
const COUNTY_RE = new RegExp(`\\b(?:(${COUNTY_ALT})\\s+COUNT(?:Y|IES)|COUNTY\\s+OF\\s+(${COUNTY_ALT}))\\b`, "i");

function canonicalCounty(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const found = DE_COUNTY_PATTERNS.find((p) => p.canonical.toLowerCase() === key);
  return found ? found.canonical : raw;
}

function extractCounty(caption: string): string | null {
  const m = COUNTY_RE.exec(caption);
  if (!m) return null;
  return canonicalCounty(m[1] ?? m[2]);
}

function inferProjectTypeAndFuel(source: DocketSource): { projectType: ProjectType; fuelType: FuelType } {
  if (source.docketTypeLabel === "Transmission CPCN") {
    return { projectType: "transmission", fuelType: "transmission" };
  }
  // Community Energy Facility Preliminary Certificate to Operate — see
  // module header FUEL/PROJECT TYPE & CAPACITY for why "solar" is the
  // program-level default, not just a per-caption keyword match.
  return { projectType: "generation", fuelType: "solar" };
}

function normalizeCandidate(candidate: Candidate, source: DocketSource): NormalizedProject {
  const matchKey = resolveMatchKey("de-psc", candidate.matterNo);
  const { projectType, fuelType } = inferProjectTypeAndFuel(source);
  const capacityMw = extractCapacityMw(candidate.caption);
  const county = extractCounty(candidate.caption);
  const mentionsSolar = /solar/i.test(candidate.caption) || /solar/i.test(candidate.company);

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    `Sourced from the Delaware Public Service Commission's public DelaFile docket search (${source.docketTypeLabel} dockets under Utility Type "${source.utilityTypeLabel}", ${source.statute}).`,
    "\"Still waiting\" here is determined by DelaFile's own Docket Status field (Assigned/Unassigned/Reopen vs. Closed) — cross-checked against real dockets during development (a days-old docket correctly showed still-open status; a 2023 docket correctly showed closed status alongside a real disposition order) rather than trusted blindly. This site does not need to determine whether a closed Delaware docket was granted, denied, or withdrawn, since either way it's no longer \"waiting\" and is dropped from tracking regardless of which outcome closed it.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket caption text, not a structured field — not independently verified.");
  } else if (source.docketTypeLabel === "Transmission CPCN") {
    dataQualityNoteParts.push("No capacity figure is stated in the docket caption; by statute (26 Del. C. §203F) this certificate type only applies to renewable energy interconnection facilities serving a project of 30 MW or more.");
  } else {
    dataQualityNoteParts.push("No capacity figure is stated in the docket caption; Delaware's Community Energy Facility (community solar) program caps individual facilities at 4 MW by regulation.");
  }
  if (fuelType === "solar" && !mentionsSolar) {
    dataQualityNoteParts.push("Fuel/technology type (solar) is inferred from Delaware's Community Energy Facility program itself (\"Community Solar\") rather than stated explicitly in this docket's own caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Delaware, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published, and this docket's own caption does not name a county; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${candidate.company || candidate.caption.slice(0, 80)} (DE PSC Docket ${candidate.matterNo})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "DE",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: candidate.filingDate,
    dateConfidence: "exact",
    currentStatus: `Delaware PSC Docket ${candidate.matterNo}: ${candidate.statusLabel || "open"} (${source.docketTypeLabel})`,
    currentStage: "local_review" as ProjectStage,
    causeSlugs,
    causeDetail: `Waiting on a ${source.docketTypeLabel} from the Delaware Public Service Commission (${source.statute}) — Docket No. ${candidate.matterNo}, "${candidate.caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `DE PSC Docket No. ${candidate.matterNo}`,
        url: DOCKET_DETAIL_URL(candidate.matterNo),
      },
    ],
    externalIds: { dePsc: candidate.matterNo },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestDePscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const byMatterNo = new Map<string, { candidate: Candidate; source: DocketSource }>();
  const errors: { matchKey: string; message: string }[] = [];

  for (const source of DOCKET_SOURCES) {
    for (const status of OPEN_STATUS_IDS) {
      try {
        // A fresh session (GET + cascade) per (source, status) search,
        // rather than chaining searches off a shared session — confirmed
        // live necessary: when a search matches exactly one docket,
        // DelaFile auto-navigates to that docket's own detail view (see
        // parseSingleResultView), whose __VIEWSTATE/__EVENTVALIDATION no
        // longer carry the search form's own fields. Chaining the NEXT
        // status search off that response's viewstate produced a real,
        // reproducible HTTP 500 from DelaFile's own server (caught by this
        // project's mandatory live-verification step, not a hypothetical).
        const session = await startSession();
        await cascadeUtilityType(session, source.utilityTypeId);
        await sleep(REQUEST_DELAY_MS);
        const rows = await searchOneStatus(session, source, status);
        for (const row of rows) {
          if (!row.matterNo) continue;
          if (!byMatterNo.has(row.matterNo)) {
            byMatterNo.set(row.matterNo, { candidate: row, source });
          }
        }
      } catch (err) {
        errors.push({ matchKey: `${source.utilityTypeLabel}/${source.docketTypeLabel}/${status.label}`, message: String(err) });
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const allCandidates = [...byMatterNo.values()];

  const toUpsert: NormalizedProject[] = [];
  let realApplicationCandidates = 0;

  for (const { candidate, source } of selectWithRotation(allCandidates, maxCandidates, ROTATING_RECENT_SLOTS)) {
    if (TEST_DOCKET_RE.test(candidate.caption)) {
      // Not a real application — see module header STATUS (Docket 25-1020,
      // PSC staff's own DelaFile system test). Not counted as "decided" for
      // the vanished-candidate fix below since it was never a real tracked
      // project in the first place.
      continue;
    }
    realApplicationCandidates += 1;
    try {
      toUpsert.push(normalizeCandidate(candidate, source));
    } catch (err) {
      errors.push({ matchKey: candidate.matterNo, message: String(err) });
    }
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a docket whose
  // Status has already flipped to Closed is deliberately left untouched
  // now, not guessed into a resolved stage — see the header for why.

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
  ingestDePscDockets()
    .then((summary) => {
      console.log(
        `Delaware PSC docket ingestion complete: ${summary.candidatesFound} open candidates found, ` +
          `${summary.realApplicationCandidates} real generation/transmission applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
