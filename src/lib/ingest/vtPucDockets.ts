// Vermont Public Utility Commission (PUC) Certificate of Public Good (CPG,
// 30 V.S.A. §248) docket ingestion — one of several states built in
// parallel in the per-state series started with vaSccDockets.ts (see that
// file's header for the overall rationale). Confirmed by hand 2026-08-24 via
// real GET/POST requests (Node's own `fetch`, the same runtime this module
// uses in production) against the live epuc.vermont.gov site — no
// assumption below was taken from documentation or training-data memory
// alone.
//
// SCOPING / WHO IS THE REAL SITING AUTHORITY: unlike several sibling states
// in this series (WA/OR/MA/CT/NH all turned out to have their real siting
// authority sitting somewhere OTHER than the obvious utility commission),
// Vermont's PUC really is the direct decision-maker here — confirmed live by
// reading 30 V.S.A. §248 itself at legislature.vermont.gov: "no company ...
// may[,] [except for on-site/replacement/licensed-hydro facilities,] ...
// construct [an electric generation, transmission, or energy storage
// facility] ... unless the Public Utility Commission first finds that the
// same will promote the general good of the State and issues a certificate
// of public good to that effect." No separate siting board exists in
// Vermont the way EFSB/EFSEC/EFSC/CSC/SEC exist elsewhere — the PUC (created
// in 2017 from the former Public Service Board) IS the certificate-issuing
// body, full stop. A second candidate statute, 30 V.S.A. §248a, was checked
// and confirmed live to be a DIFFERENT thing entirely — a CPG process for
// TELECOMMUNICATIONS facilities (cell towers etc.), not energy — and
// 30 V.S.A. §246 was also checked and confirmed to cover only TEMPORARY
// siting of meteorological (wind-monitoring) towers, not real generation
// projects. Both are excluded from this module's scope; see PETITION FILING
// TYPE below for how VT's own docket system already tags these as distinct,
// separately-coded petition types, making the exclusion a structured-field
// decision rather than a text-regex guess.
//
// FETCHING: epuc.vermont.gov runs "ecp_core" ("Electronic Case Portal"), a
// custom Drupal 7 module built on what appears to be a Journal
// Technologies-style eCourt Public Portal engine (jtux theme, ecourt-lib.js)
// — plain server-rendered HTML forms, NO CAPTCHA, NO login required for
// public search. Two real requests, no third-party JS execution needed:
//   1. GET /?q=node/88 ("Pending Cases", a pre-built canned search) —
//      returns the search FORM itself, not results. Confirmed live this
//      response carries (a) a Drupal session cookie via Set-Cookie
//      (SSESS...) and (b) a `form_build_id` hidden field. BOTH must be
//      reused together on the follow-up POST — Drupal's Form API caches the
//      submitted form server-side keyed by session+form_build_id; a POST
//      without the matching cookie silently re-renders the same empty form
//      (confirmed live: tried first without cookie forwarding, got back a
//      byte-identical 425033-length page to the GET, no results — only
//      after carrying the Set-Cookie value forward did the POST's response
//      length change and real result rows appear).
//   2. POST /?q=node/88 with the form's full hidden-field set (every
//      `data(<fieldId>_op)`/`data(<fieldId>_incnull)` pair the real form
//      emits, even for fields left blank — omitting them was not tested and
//      is not assumed safe) plus `data(238943)[]=248` and
//      `data(238943)[]=248J` (see PETITION FILING TYPE below), the same
//      `form_build_id` from step 1, and the session cookie from step 1.
//      Confirmed live: returns one self-contained HTML table with
//      Case Number, Subcase Type, Petitioner/Applicant Name, Case Name (the
//      full petition caption — includes the §248 citation, capacity, fuel
//      type, and location in free text), Town(s), Date Filed, and Case
//      Status, ALL inline — no second per-candidate detail-page fetch is
//      needed at all (an even bigger win than nhSecDockets.ts's single-page
//      DocketBook, which still needed a second per-candidate filing-history
//      fetch for STATUS; here the canned search endpoint itself already
//      enforces "pending only" server-side — see STATUS below).
//   Field IDs (238924/238925/238927/238928/238929/238930/238943/etc.) are
//   internal to this specific canned-search form definition (ecpFormId=62,
//   eCourtFormCode="S-Case-PendingCasesPublic-Portal") and were read off the
//   live form's own hidden inputs on 2026-08-24, same convention as every
//   other module in this series hardcoding a live-confirmed column/field
//   layout rather than re-discovering it on every run.
//
// PETITION FILING TYPE — the real, structured scoping mechanism: VT's own
// case-search form exposes a "Petition Filing Type" select-multiple field
// (internal id 238943) whose own live-confirmed option list is: 248=Section
// 248 Application, 248J=Section 248(j) Application, 248DM=Section 248a De
// Minimis Application, 248REG=Section 248a Application (Regular or Limited
// Size...), 246=Section 246 Application, FIN=Financing Request,
// 9302/9303=Rule 9.302/9.303 Application, APPEAL=Appeal of ANR Permit,
// 219A=Section 8010 (Net-metering), CATV=Cable TV Company CPG Renewal,
// DECOM=5.904(B)(8) Decommissioning, ESA=Energy Savings Account,
// CCP=Customer Credit Program, OTHER=Other, WLAND/WOLAND=Transfer with/
// without Land. This module searches ONLY "248" and "248J" — confirmed via
// the statutory text (see WHO IS THE REAL SITING AUTHORITY above) that
// these two are the real new-generation/transmission/storage-facility CPG
// codes; "248DM"/"248REG" are VT's *telecommunications* CPG codes (§248a,
// not §248) despite the superficially similar "248" prefix — a real,
// confirmed-live naming trap in VT's own field taxonomy that a naive
// "starts with 248" substring filter would have fallen into. "246" (met
// towers) and "219A" (net-metering, a materially different — and
// materially smaller-scale — CPG track this project's convention is to
// exclude, matching how other modules in this series don't track
// residential/behind-the-meter net-metering CPGs) are excluded the same
// way. "248J" (the expedited/limited-notice track WITHIN §248 itself, per
// §248(j), for "facilities [that] will be of limited size and scope" not
// raising a significant §248 issue — confirmed live via the statute text)
// is included alongside plain "248" since it's still a genuine new-facility
// CPG, just an abbreviated review track — matching this series' standing
// practice (see wvPscDockets.ts's E-CS) of including a confirmed-relevant
// docket code even at zero current live population (248J's real live
// population as of 2026-08-24 is 0 of 14 candidates — see below).
//
// REAL LIVE CANDIDATE POPULATION (2026-08-24, 14 total, Petition Filing
// Type IN [248, 248J]): 13 genuine new-facility petitions — solar (the
// large majority: Novus Buck Solar 4.999 MW, Airport RD1 VT Solar 4.975 MW,
// Savage Solar Energy 2.75 MW, Novus 242 Solar 3.75 MW, Williston H Solar
// 2.75 MW, GRH Growth 3.5 MW, Williston G Katie Lane Solar 2.9 MW, Northland
// Solar 4.999 MW, Essex A North Lot Solar 3.5 MW, Chelsea Solar 2 MW — all
// clustered just under or around the 5 MW net-metering-eligibility-adjacent
// range, consistent with this being VT's real utility-scale-but-modest
// solar pipeline), one wind turbine (Dairy Air Wind, 2.2 MW, Holland VT),
// and two Green Mountain Power substation rebuilds (Taftsville, Georgia —
// classified `transmission` here, matching this series' standing practice
// of treating substation work as part of the transmission/grid-
// infrastructure category). PLUS one real, confirmed-live EXCLUDE case (see
// EXCLUDE_RE below): Vermont Gas Systems' 25-0055-PET, "Petition ... to
// amend certificate of public good #7970" — a request to modify an
// ALREADY-ISSUED certificate, not a new facility awaiting its first
// decision (spans 10 towns along VGS's existing pipeline corridor,
// confirmed live from its own Town column — a real, live illustration of
// why amendment petitions are excluded, not a hypothetical).
//
// REAL REGEX GOTCHA, caught before shipping (this project's standard
// verification step): a first version of this module scoped CONTENT_RE to
// require the literal phrase "certificate of public good" appear in the
// case caption, on the assumption every §248 petition states it. Live
// counter-example found in the real candidate set: 25-2412-PET's actual
// caption reads "Petition of GRH Growth, LLC, pursuant to 30 V.S.A § 248,
// authorizing the construction and operation of a 3.5 MW solar array in
// Vernon, Vermont" — never once says "certificate of public good," and
// (separately) drops the period after "V.S.A" that every other real
// candidate's caption includes ("30 V.S.A §" vs "30 V.S.A. §" — a genuine
// live formatting inconsistency in VT's own caption text, not a typo this
// module corrects). Since Petition Filing Type is itself a STRUCTURED field
// already confirmed to reliably scope to real §248/§248(j) petitions (see
// above), CONTENT_RE here is kept only as a lightweight defensive sanity
// check (requires "248" or "certificate of public good" appear somewhere in
// the caption) rather than the primary scoping mechanism — the real
// scoping work is done server-side by the Petition Filing Type filter, not
// by this module's own text matching, avoiding the trap a stricter
// phrase-based CONTENT_RE fell into live.
//
// EXCLUDE_RE: requires "amend" or "transfer" appear in the caption — see
// the real, live-confirmed Vermont Gas amendment case above. "Transfer"
// is untested against a real live candidate (none currently pending) but
// included defensively, matching wvPscDockets.ts's own transfer-of-
// ownership exclusion and wvPscDockets.ts's stated rationale for keeping a
// confirmed-relevant filter even at zero current population.
//
// STATUS — genuinely simpler here than most of this series' siblings
// (NH/WV/CT/MD all had to scan free-text order/filing language for
// resolving verdicts because no reliable structured status signal existed).
// VT's "Pending Cases" canned search (eCourtFormCode
// S-Case-PendingCasesPublic-Portal) is server-side hard-scoped to exclude
// resolved cases — confirmed live by deliberately submitting explicit
// Case Status filters of CLOS ("Closed"), WD ("Withdrawn"), NFA ("No
// Further Action"), and LEGACY ("Legacy Case") against this same endpoint
// (with Petition Filing Type still =248/248J): every one of those returned
// ZERO rows, even though the search form's own Case Status field accepts
// them as valid filter values — proving the "pending" scoping is enforced
// server-side by the canned search itself, not something this module's own
// filter parameters control. Every candidate this module ever sees is
// therefore, by construction, still genuinely pending — no free-text
// grant/deny scanning is needed, and every real candidate's `currentStage`
// is simply "local_review". The candidates' own Case Status codes (OPEN,
// REV="Under Review", and — per the search form's own option list, not yet
// observed live — NF/PC/PCOA/EFILED/R/DPSIP/OA/PEND/STAY/OR — see
// CASE_STATUS_LABELS) are surfaced in `currentStatus` purely for
// transparency, not used to compute currentStage.
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): this module's own
// candidate query is scoped to "Pending Cases" only (see STATUS above:
// confirmed live that closed/withdrawn cases cannot be returned by this
// endpoint at all, by any filter combination), so once VT PUC issues a
// final order or the petitioner withdraws, that case will simply vanish
// from every future run's candidate list. Originally fixed by pushing a
// resolved stub (guessing currentStage="cancelled", used purely as a
// generic RESOLVED_STAGES trigger — this module cannot tell from the
// vanished-stub path alone whether a case resolved via grant, denial, or
// withdrawal) for any previously-tracked "vt-puc:" matchKey no longer in
// this run's pending set, so common.ts would delete it. That fix is now
// itself superseded: common.ts no longer deletes resolved-stage projects
// (they're kept and surfaced through the frontend's Status filter), so
// guessing "cancelled" for a case that dropped off Pending Cases would
// mean permanently mislabeling it — it's at least as likely to have been
// granted — in a bucket real users can now see. A case that drops off
// Pending Cases is therefore left untouched, not guessed into a resolved
// stage.
//
// FUEL/PROJECT TYPE & CAPACITY: parsed from each candidate's own Case Name
// (the full petition caption, already fetched inline — see FETCHING). Real,
// confirmed-live population is overwhelmingly solar (10 of 13), one wind
// turbine, and two substation rebuilds (classified `transmission`, matching
// this series' standing convention). No live gas/hydro/nuclear/geothermal/
// storage §248 candidate exists as of this writing, but VT's own case
// search form's "Generation Type" field (id 238946) confirms Battery
// Storage, Natural Gas, Hydroelectric, Biomass, Fuel Cell, Landfill Gas,
// Geothermal, and Marine Thermal/Hydrokinetic are all real, valid VT
// generation-type codes — STORAGE_RE/GAS_RE/HYDRO_RE/etc. below are kept
// for the next real candidate of that type, same "kept but unconfirmed"
// caveat wvPscDockets.ts documents for its own thin fuel population.
// CAPACITY_RE matches real live "N.NNN MW" captions (e.g. "4.999 MW" — VT's
// solar petitions cluster suspiciously precisely just under round numbers,
// most plausibly to stay under a specific regulatory size threshold, not
// investigated further here since it doesn't change how this module reads
// the figure).
//
// LOCATION: VT's own case data publishes TOWN (a municipality), not COUNTY
// — a real structural difference from every county-based sibling module in
// this series (mdPscDockets.ts, wvPscDockets.ts, nhSecDockets.ts, etc., all
// of which extract county names directly from free text against a
// hardcoded county whitelist). Vermont's ~255 towns/cities/gores do not map
// 1:1 onto its 14 counties in any way this module can derive from the case
// text itself (town names alone, e.g. "Georgia" or "Chester", don't imply a
// county), and this project's "confirm before guessing" rule means a
// town→county lookup table is NOT hand-built here from training-data
// memory — that's exactly the kind of unverified claim the brief warns
// against, just applied to geography instead of a docket fact. `county` is
// therefore left null; the real town name(s) (multi-town captions are real
// and confirmed live — e.g. 26-1696-PET spans Woodstock/Hartford/Hartland)
// are instead surfaced in `dataQualityNote` and `causeDetail` as plain text,
// same honest-gap treatment this series gives other genuinely-missing
// structured fields.
//
// Real per-run timing measured 2026-08-24 against the live population (1
// GET for the session cookie + form_build_id, 1 POST for the actual search
// — NO per-candidate detail fetches needed at all, a first for this
// series): under 2 seconds end-to-end, negligible against the 300s cron
// budget.
//
// Wired to Vercel Cron weekly (see vercel.json and
// src/app/api/cron/ingest-vt-puc/route.ts — left for the maintainer to
// finalize the schedule and route).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://epuc.vermont.gov";
const SEARCH_PAGE_URL = `${BASE_URL}/?q=node/88`;
const CASE_DETAIL_URL = (caseId: string) => `${BASE_URL}/?q=node/64/${caseId}`;

// Real live population as of 2026-08-24 is 14 (13 real construction
// candidates + 1 excluded amendment) — see module header REAL LIVE
// CANDIDATE POPULATION. Set generously above that for headroom; real timing
// (see module header) leaves enormous margin under the 300s cron budget at
// this population size.
export const MAX_CANDIDATES = 150;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;

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
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&#8220;/g, "“")
    .replace(/&rdquo;|&#8221;/g, "”")
    .replace(/&sect;/g, "§")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// See module header FETCHING. Every hidden field the real form emits is
// reproduced here exactly as observed live, including operator/incnull
// fields for blank criteria — omitting any of them was not tested and is
// not assumed safe.
function buildSearchParams(formBuildId: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("formId", "41630");
  params.set("data(238931_op)", "EQUALS");
  params.set("data(238931_incnull)", "");
  params.set("data(238931)", "");
  params.set("data(238931_right)", "");
  params.set("data(238934_op)", "CONTAINS");
  params.set("data(238934_incnull)", "false");
  params.set("data(238934)", "");
  params.set("data(238940_op)", "IN");
  params.set("data(238940_incnull)", "false");
  params.set("data(238942_op)", "IN");
  params.set("data(238942_incnull)", "false");
  params.set("data(238944_op)", "IN");
  params.set("data(238944_incnull)", "false");
  params.set("data(238945_op)", "IN");
  params.set("data(238945_incnull)", "false");
  params.set("data(238946_op)", "IN");
  params.set("data(238946_incnull)", "false");
  params.set("data(238933_op)", "CONTAINS");
  params.set("data(238933_incnull)", "false");
  params.set("data(238933)", "");
  params.set("data(238939_op)", "IN");
  params.set("data(238939_incnull)", "false");
  params.set("data(238941_op)", "IN");
  params.set("data(238941_incnull)", "false");
  params.set("data(238943_op)", "IN");
  params.set("data(238943_incnull)", "false");
  // See module header PETITION FILING TYPE.
  params.append("data(238943)[]", "248");
  params.append("data(238943)[]", "248J");
  params.set("eCourtFormCode", "S-Case-PendingCasesPublic-Portal");
  params.set("ecpFormId", "62");
  params.set("form_build_id", formBuildId);
  params.set("form_id", "ecp_searchform_form");
  params.set("op", "Search");
  return params;
}

async function fetchPendingSection248Html(): Promise<string> {
  const getRes = await fetch(SEARCH_PAGE_URL, { headers: { Accept: "text/html" } });
  if (!getRes.ok) {
    throw new Error(`VT PUC ePUC pending-cases page request failed (${getRes.status})`);
  }
  const cookie = getRes.headers.get("set-cookie")?.split(";")[0];
  const getHtml = await getRes.text();
  const buildIdMatch = /form_build_id"\s+value="([^"]+)"/.exec(getHtml);
  if (!cookie || !buildIdMatch) {
    throw new Error(
      "VT PUC ePUC pending-cases page didn't return the expected session cookie and/or form_build_id — the page structure likely changed. Check fetchPendingSection248Html in src/lib/ingest/vtPucDockets.ts against a fresh response.",
    );
  }

  await sleep(REQUEST_DELAY_MS);

  const postRes = await fetch(SEARCH_PAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
      Cookie: cookie,
    },
    body: buildSearchParams(buildIdMatch[1]).toString(),
  });
  if (!postRes.ok) {
    throw new Error(`VT PUC ePUC pending-cases search POST failed (${postRes.status})`);
  }
  return postRes.text();
}

interface CaseRecord {
  caseId: string;
  caseNumber: string;
  subcaseType: string;
  petitioner: string;
  description: string;
  towns: string[];
  filedDate: Date | null;
  statusCode: string;
}

function extractHiddenValue(row: string, fieldId: string): string | null {
  const re = new RegExp(`data\\(${fieldId}\\)"\\s+onchange=""\\s+value="([^"]*)"`);
  const m = re.exec(row);
  return m ? decodeHtmlEntities(m[1]) : null;
}

// Confirmed live 2026-08-24 against the real "Pending Cases" search
// response — see module header FETCHING. Each result row is a plain <tr>
// whose cells duplicate their own value into a same-named hidden <input>
// (convenient — avoids re-parsing HTML-formatted cell text for the fields
// that have one) except for Town, which has no hidden-input duplicate and
// must be read from its own <td> (case number and case-detail link are
// likewise only available from their own <td>, not a hidden input).
const ROW_RE = /<tr style="height:17px" id="form_search_row[^"]*">([\s\S]*?)<\/tr>/g;
const CASE_LINK_RE = /<a href="\?q=node\/64\/(\d+)">([^<]+)<\/a>/;

function parsePendingCasesHtml(html: string): CaseRecord[] {
  const records: CaseRecord[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    const row = m[1];
    const linkMatch = CASE_LINK_RE.exec(row);
    if (!linkMatch) continue; // the "drilldown" placeholder row that follows each real row has no case link
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) => t[1]);
    const townsRaw = tds[4] ?? "";
    const towns = townsRaw
      .split(/<br\s*\/?>/i)
      .map((t) => decodeHtmlEntities(t))
      .filter((t) => t.length > 0);
    const filedRaw = extractHiddenValue(row, "238929");
    const filedDate = filedRaw ? new Date(filedRaw) : null;

    records.push({
      caseId: linkMatch[1],
      caseNumber: decodeHtmlEntities(linkMatch[2]),
      subcaseType: extractHiddenValue(row, "238925") ?? "",
      petitioner: decodeHtmlEntities(tds[2] ?? ""),
      description: extractHiddenValue(row, "238927") ?? "",
      towns,
      filedDate: filedDate && !Number.isNaN(filedDate.getTime()) ? filedDate : null,
      statusCode: extractHiddenValue(row, "238930") ?? "",
    });
  }
  return records;
}

// See module header FETCHING — the search form's own live-confirmed option
// list for this field (id 238940).
const CASE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  CLOS: "Closed",
  NF: "New Paper Filing",
  PC: "Pending Required Compliance Filings",
  PCOA: "Pending Required Compliance Filings and On Appeal",
  EFILED: "eFiled",
  R: "Rejected",
  DPSIP: "DPS Investigation Pending",
  OA: "On Appeal",
  REV: "Under Review",
  PEND: "Pending Completion",
  NFA: "No Further Action",
  STAY: "Stayed",
  OR: "On Remand",
  LEGACY: "Legacy Case",
  WD: "Withdrawn",
};

// See module header REAL REGEX GOTCHA — lightweight defensive sanity check
// only; the real scoping is done server-side by the Petition Filing Type
// field (see buildSearchParams).
const CONTENT_RE = /\b248\b|certificate of public good/i;

// See module header EXCLUDE_RE — confirmed live against a real amendment
// petition (Vermont Gas Systems, 25-0055-PET); "transfer" is a defensive,
// currently-unconfirmed addition matching wvPscDockets.ts's own convention.
const EXCLUDE_RE = /\bamend(?:s|ing|ment)?\b|\btransfer\b/i;

const TRANSMISSION_RE = /\bsubstation\b|\btransmission\b/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;
const WIND_RE = /\bwind[- ]?(?:powered|turbine)\b|\bwind\b/i;
const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const GAS_RE = /\bnatural gas\b|\bgas[- ]fired\b|\bcombined[- ]cycle\b/i;
const HYDRO_RE = /\bhydro/i;
const NUCLEAR_RE = /\bnuclear\b/i;
const GEOTHERMAL_RE = /\bgeothermal\b/i;
const BIOMASS_RE = /\bbiomass\b|\bwood[- ]?chip\b|\bmethane\b/i;

function inferProjectType(text: string): ProjectType {
  if (TRANSMISSION_RE.test(text)) return "transmission";
  if (STORAGE_RE.test(text)) return "storage";
  return "generation";
}

function inferFuelType(text: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  if (WIND_RE.test(text)) return "wind_onshore";
  if (SOLAR_RE.test(text)) return "solar";
  if (GAS_RE.test(text)) return "gas";
  if (HYDRO_RE.test(text)) return "hydro";
  if (NUCLEAR_RE.test(text)) return "nuclear";
  if (GEOTHERMAL_RE.test(text)) return "geothermal";
  if (BIOMASS_RE.test(text)) return "other";
  return "other";
}

// See module header FUEL/PROJECT TYPE & CAPACITY. Matches real live
// "N.NNN MW" captions (e.g. "4.999 MW").
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*(?:MW|megawatts?)\b/i;

function extractCapacityMw(text: string): number | null {
  const m = CAPACITY_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function normalizeCandidate(record: CaseRecord): NormalizedProject {
  const matchKey = resolveMatchKey("vt-puc", record.caseNumber);

  const projectType = inferProjectType(record.description);
  const fuelType = inferFuelType(record.description, projectType);
  const capacityMw = extractCapacityMw(record.description);
  const townList = record.towns.length > 0 ? record.towns.join(", ") : null;

  const statusLabel = CASE_STATUS_LABELS[record.statusCode] ?? record.statusCode;
  const currentStage: ProjectStage = "local_review";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Vermont Public Utility Commission's public ePUC case search, scoped to pending Certificate of Public Good (CPG, 30 V.S.A. §248 / §248(j)) petitions — the PUC is Vermont's own, direct siting authority for generation, transmission, and storage facilities under §248; see the ingestion module header for the statutory confirmation.",
    "\"Still waiting\" here is determined by VT PUC's own \"Pending Cases\" search, which is confirmed (by hand, live) to exclude closed/withdrawn/no-further-action cases server-side regardless of what status filter is requested — not by this module scanning filing text for grant/deny language. See the ingestion module header for how this was verified.",
    "Fuel/technology and capacity are parsed from the petition's own free-text caption (the only project-detail text this source publishes in structured form), not a structured field — not independently verified against the underlying application documents.",
  ];
  if (fuelType === "other" && projectType === "generation") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from this petition's caption text.");
  }
  if (townList) {
    const word = record.towns.length > 1 ? "Towns" : "Town";
    dataQualityNoteParts.push(
      `Located in the ${word} of ${townList}, Vermont, per the case's own Town field — Vermont's case records publish town/municipality, not county, and this module deliberately does not guess a town-to-county mapping (see the ingestion module header), so this project will not appear on the map until geocoded another way.`,
    );
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${record.petitioner} (VT ${record.caseNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "VT",
    county: null,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: record.filedDate,
    dateConfidence: "exact",
    currentStatus: `VT PUC Case ${record.caseNumber}: ${statusLabel}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Good from the Vermont Public Utility Commission, pursuant to 30 V.S.A. §248 — Case No. ${record.caseNumber}, "${record.description.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `VT PUC Case No. ${record.caseNumber}`,
        url: CASE_DETAIL_URL(record.caseId),
      },
    ],
    externalIds: { vtPuc: record.caseNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestVtPucDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const html = await fetchPendingSection248Html();
  const allRecords = parsePendingCasesHtml(html);
  if (allRecords.length === 0) {
    throw new Error(
      "VT PUC ePUC pending-cases search matched zero rows at all — the page structure likely changed (real live population as of 2026-08-24 was 14). Check parsePendingCasesHtml in src/lib/ingest/vtPucDockets.ts against a fresh response.",
    );
  }

  const errors: { matchKey: string; message: string }[] = [];
  const toUpsert: NormalizedProject[] = [];
  let realApplicationCandidates = 0;

  const rotatedRecords = selectWithRotation(allRecords, maxCandidates, ROTATING_RECENT_SLOTS);
  const rotatingTier = new Set(rotatedRecords.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  for (const record of rotatedRecords) {
    try {
      if (!CONTENT_RE.test(record.description) || EXCLUDE_RE.test(record.description)) {
        // Not a real new-facility CPG petition — see module header
        // EXCLUDE_RE (e.g. a petition to amend an already-issued CPG).
        continue;
      }
      realApplicationCandidates += 1;
      const normalized = normalizeCandidate(record);
      toUpsert.push(normalized);
      if (rotatingTier.has(record)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: record.caseNumber, message: String(err) });
    }
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a case whose
  // status has already resolved and dropped off VT PUC's own "Pending
  // Cases" search is deliberately left untouched now, not guessed into a
  // resolved stage — see the header for why.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = allRecords.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allRecords.length,
    realApplicationCandidates,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  const started = Date.now();
  ingestVtPucDockets()
    .then((summary) => {
      const elapsedMs = Date.now() - started;
      console.log(
        `Vermont PUC docket ingestion complete: ${summary.candidatesFound} pending §248/§248(j) candidates found, ` +
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
