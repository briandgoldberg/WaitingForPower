// Public Utilities Commission of Nevada (PUCN) Utility Environmental
// Protection Act (UEPA) permit-application docket ingestion — one of
// several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23 via real requests against both PUCN systems
// described below — no assumption below was taken from documentation or
// training-data memory alone.
//
// SCOPING: Nevada has no "Certificate of Public Convenience and Necessity"
// siting process for generation/transmission facilities. Its equivalent is
// the Utility Environmental Protection Act (UEPA, NRS 704.860-704.900): a
// permit, issued by the PUCN, required before constructing generation
// facilities and associated transmission/switching facilities above certain
// size thresholds. Confirmed by hand against a real 148-docket "Active
// Electric Dockets" listing that UEPA applications are a clean, identifiable
// subset — every relevant docket's own description literally contains the
// phrase "under the provisions of the Utility Environmental Protection Act."
// That phrase also appears on a large, DIFFERENT population that must be
// excluded: "Notice by [company] ... of an application to a FEDERAL agency
// for approval" — UEPA also requires notifying PUCN when a utility applies
// to a federal agency (BLM, etc.) for land on which it holds no PUCN permit
// obligation of its own; PUCN isn't deciding anything in those dockets, so
// they're not "waiting" on this site's terms. Confirmed 2026-08-23 against a
// real batch of 71 UEPA-phrase dockets: 37 were federal notices (docket
// 18-10030 checked by hand — GridLiance West's "Notice by ... of an
// application to a federal agency," only 4 filed documents ever, no PUCN
// order, 8 years old and still sitting there — correctly excluded), 30 were
// real "Application of/by [company]" permit applications PUCN itself decides
// (plus a handful of "Amended Notice by" variants, also excluded). Only the
// real Application filings are in scope — see APPLICATION_RE/NOTICE
// exclusion below.
//
// FETCHING — two separate PUCN systems, neither offering a paid API, auth
// wall, or CAPTCHA, confirmed by hand:
//   1. pucweb1.state.nv.us/puc2/Dktinfo.aspx — a legacy ASP.NET WebForms
//      docket list/search covering ALL docket history (8,852 rows as of
//      2026-08-23), server-rendered, no JS execution required. A plain GET
//      returns the full "All Dockets" list (10MB decompressed, gzip'd over
//      the wire) along with the ASP.NET postback machinery
//      (__VIEWSTATE/__VIEWSTATEGENERATOR/__EVENTVALIDATION). Submitting
//      those hidden fields back as a POST with __EVENTTARGET=lnkbtnElectric
//      (mimicking the page's "Electric Dockets" sidebar link, itself a
//      javascript:__doPostBack(...) call, not a plain href) returns a MUCH
//      smaller "Active Electric Dockets" view (~148 rows) with Docket
//      Number/Date Filed/Description columns — this is searchCandidates()'s
//      only request pair. Confirmed gotcha #1: despite the "Active" label,
//      this list is NOT reliable evidence of pending status — docket
//      09-11005 (TransWest Express, filed 2009) is still sitting in "Active
//      Electric Dockets" 17 years later, long after being granted (see
//      STATUS). Confirmed gotcha #2: no session/cookie is required at all —
//      a fresh GET's viewstate posted back with zero Cookie header still
//      succeeds (verified by hand with and without cookies, identical
//      result), so this module does no cookie-jar bookkeeping, just POSTs
//      to the URL the GET actually resolved to (which may carry a
//      cookieless-session URL segment PUCN's IIS adds). Confirmed gotcha
//      #3: per-docket detail (DktDetail.aspx, reached the same way via
//      __EVENTTARGET=GridView1/__EVENTARGUMENT=Select$N) is USELESS for
//      anything filed after ~October 2023 — verified against docket
//      26-07016 (filed 7/31/2026): the detail postback returns 200 with
//      only the docket number label and no content, exactly matching this
//      legacy site's own on-page disclaimer ("this site only contains...
//      dockets filed before October of 2023 ... For [newer] documents,
//      please navigate to our new site"). So this module never touches
//      DktDetail.aspx — status comes entirely from source #2 below.
//   2. puc-onbase.nv.gov — PUCN's "new site," a Hyland OnBase Web/Angular
//      SPA, but its backend is a plain JSON REST API at /api/* that this
//      module calls directly (no browser/JS execution needed — confirmed by
//      reading the compiled Angular bundle to find the real endpoint
//      shapes, then verifying each with a real curl/fetch call, not
//      guessed): POST /api/CustomQuery/KeywordSearch with
//      `{QueryID:125, Keywords:[{ID:"369", Value: docketNumber}], FromDate:
//      null, ToDate:null, QueryLimit:500}` (QueryID 125 = "PUC - Public
//      Search - Dockets," keyword ID 369 = "Docket Number," both confirmed
//      against the API's own /api/CustomQuery and /api/Keywords lookup
//      lists) returns every filed document for that docket: type (from a
//      fixed dataset — "ORIGINAL FILING," "ORDER," "UEPA," "COMPLIANCE
//      FILING/RESPONSE," "SERVICE LIST," etc. — confirmed against
//      POST /api/Keywords {DocTypeID:242}), a filing date, and a free-text
//      note field (confirmed to be OnBase keyword ID 376, "Notes - PUC," a
//      100-char free-text field a PUCN clerk fills in per document — NOT
//      the "Docket Status" keyword also present on this doc type, ID 379,
//      dataset ["OPEN","CLOSED"], which this module never reads — see
//      STATUS for why the free-text note on ORDER documents turned out to
//      be the reliable signal instead of that obvious-looking OPEN/CLOSED
//      field, which was never directly tested against a real resolved
//      docket because the free-text signal was already conclusively
//      calibrated first).
//
// STATUS — the real signal, calibrated against all 30 real UEPA permit
// applications found live (not a hypothetical): fetch each candidate's
// OnBase document list, find "ORDER"-type documents whose note is EXACTLY
// "GRANTED", "DENIED", or "DISMISSED" (case-insensitive, trimmed) — as
// opposed to a note like "MOTION GRANTED," "SECOND MOTION GRANTED," or
// "PROCEDURAL ORDER NO. 1," which are real, frequently-seen notes for
// procedural rulings within a still-open case, not the permit decision
// itself. Confirmed by hand this distinction is real and consistent: docket
// 16-06017 (TransCanyon, filed 2016) has three ORDER documents —
// "PROCEDURAL ORDER NO. 1" (11/18/2024), "MOTION GRANTED" (12/5/2024), then
// finally bare "GRANTED" (1/22/2025) — only the last is the actual permit
// grant. Gotcha found by testing, not assumed: a bare "GRANTED" order is
// NOT always the end of the docket. Nevada's UEPA process for large
// transmission projects runs in sequential "phases" (Phase 1, Phase 2, ...),
// each separately reviewed; docket 20-07025 (NV Energy's Greenlink West)
// has an ORDER "GRANTED" on 12/30/2024, but a NEW "UEPA" phase filing
// (Phase 3) was submitted 4/20/2026 — 16 months after that "grant" — with
// no final order since. A naive "does any order say GRANTED" check would
// have wrongly marked this, and four other still-very-much-alive GridLiance
// West dockets with the identical pattern (22-01021, 22-06042, 22-07020,
// 22-10013, 23-09020 — an apparent PUCN practice of processing near-
// identical GridLiance filings across multiple docket numbers together;
// all five share the exact same "PROCEDURAL ORDER NO. 1" 6/2/2026 and
// "GRANTED" 7/13/2026 order dates, then a further UEPA filing 8/20/2026),
// as resolved and deleted them from the site while the underlying project
// was still working through additional required review. This module's
// actual rule: find the most recent ORDER with a bare GRANTED/DENIED/
// DISMISSED note; the docket only counts as resolved if NO OTHER document
// (excluding the purely administrative "SERVICE LIST," "MISC
// CORRESPONDENCE," and "AFFIDAVIT PUB/POST" types, which are routinely
// filed same-day-or-later as companions to the substantive document they
// accompany, not evidence of new proceeding activity — confirmed by hand
// this exclusion is needed: without it, essentially every granted docket's
// own companion Service List, dated the same day as its grant order or
// mailed slightly after, made every single resolved docket look "still
// active") has a later filing date. Across all 30 real applications tested,
// this yields 9 cleanly resolved-granted dockets (correctly deleted per
// RESOLVED_STAGES) and 21 still-active ones (12 with no order yet at all,
// 9 with an earlier phase already granted but later phase activity still
// pending). No real DENIED or DISMISSED example exists anywhere in the
// current docket population to calibrate against (same gap noted in
// azAccLineSiting.ts for AZ) — DENY_RE/DISMISS_RE below are a best-effort
// keyword match, not confirmed against a real instance.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields, extracted from the
// docket description text (identical in style/caveats to the other
// keyword-based sources in this series). One real gotcha found by testing:
// a naive "check fuel keywords first" approach misclassified docket
// 24-10007 ("Rough Hat Clark BESS Transmission Line Project ... a 230 kV
// transmission line ... to interconnect the proposed Rough Hat Clark Solar
// Battery Energy Storage System Project with the Trout Canyon Substation")
// as solar generation, because the word "Solar" appears in the NAME of a
// separate, already-existing project this transmission-only permit merely
// interconnects to — not in anything this docket itself proposes to build.
// Fixed by requiring an explicit generating-facility phrase ("electric
// generating facility/plant" or "combustion turbine(s)") to co-occur with a
// fuel keyword before classifying as generation; otherwise it falls through
// to a transmission-line/substation/switchyard check. Verified against all
// 30 real candidates by hand: 5 generation (2 gas, 1 solar — Peru Ridge,
// South Valley, Lux Solar Project — plus 2 more gas), 25 transmission, 0
// storage-only, 0 unclassifiable. No wind/geothermal/nuclear/hydro UEPA
// application was observed live — kept in FUEL_KEYWORDS as an easy add,
// not verified against a real example.
//
// Wired to Vercel Cron weekly, 23:30 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-nv-pucn/route.ts) — a real run's timing was
// measured (148 candidates scanned, 28 real UEPA applications, ~38s) before
// scheduling this. Also politeness-delayed between per-candidate OnBase
// requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const LEGACY_BASE_URL = "https://pucweb1.state.nv.us/puc2/Dktinfo.aspx";
const ONBASE_API_URL = "https://puc-onbase.nv.gov/api/CustomQuery/KeywordSearch";
// "PUC - Public Search - Dockets" custom query and its "Docket Number"
// keyword — both confirmed live against /api/CustomQuery and
// /api/Keywords {DocTypeID:242} on 2026-08-23. See module header.
const DOCKETS_QUERY_ID = 125;
const DOCKET_NUMBER_KEYWORD_ID = "369";

export const MAX_CANDIDATES = 60;
const REQUEST_DELAY_MS = 250;
// Confirmed gotcha found only by testing (not documented anywhere): the
// legacy pucweb1.state.nv.us site performs classic ASP.NET browser-
// capability sniffing on the User-Agent header and renders a completely
// different, older "downlevel" markup (each cell's text wrapped in
// <font face="Arial" ...> tags, no id/class attributes on the GridView
// rows) to any request whose User-Agent it doesn't recognize as a modern
// browser — which includes Node's default fetch User-Agent. DOCKET_ROW_RE
// below is written against the modern/"uplevel" markup and silently
// matches zero rows against the downlevel version, so every request to
// this host must send a real browser User-Agent string.
const LEGACY_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
// Bounds how many old, near-certainly-resolved-or-abandoned "Active
// Electric Dockets" rows get an OnBase detail fetch. The oldest real UEPA
// permit *application* found live was filed in 2009 (already long granted);
// 10 years comfortably covers the entire live "still active" population
// observed (see module header — nothing currently unresolved is older than
// 2020).
const LOOKBACK_YEARS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as txPuctDockets.ts/scPscDockets.ts, not a full HTML-entity
// library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&nbsp;/g, " ")
    .trim();
}

interface HiddenFields {
  actionUrl: string;
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

function extractHiddenFields(html: string, actionUrl: string): HiddenFields {
  function extract(id: string): string {
    const re = new RegExp(`name="${id}"[^>]*value="([^"]*)"`);
    const m = re.exec(html);
    return m ? m[1] : "";
  }
  const viewState = extract("__VIEWSTATE");
  if (!viewState) {
    throw new Error(
      "NV PUCN Dktinfo.aspx response didn't contain __VIEWSTATE — the page structure likely changed. Check extractHiddenFields in src/lib/ingest/nvPucnDockets.ts against a fresh response.",
    );
  }
  return {
    actionUrl,
    viewState,
    viewStateGenerator: extract("__VIEWSTATEGENERATOR"),
    eventValidation: extract("__EVENTVALIDATION"),
  };
}

async function fetchLegacyBootstrap(): Promise<HiddenFields> {
  const res = await fetch(`${LEGACY_BASE_URL}?Util=All`, {
    headers: { "User-Agent": LEGACY_USER_AGENT },
  });
  if (!res.ok) throw new Error(`NV PUCN Dktinfo.aspx bootstrap request failed (${res.status})`);
  const html = await res.text();
  return extractHiddenFields(html, res.url);
}

async function postback(hidden: HiddenFields, eventTarget: string, eventArgument = ""): Promise<string> {
  const params = new URLSearchParams();
  params.set("__EVENTTARGET", eventTarget);
  params.set("__EVENTARGUMENT", eventArgument);
  params.set("__VIEWSTATE", hidden.viewState);
  params.set("__VIEWSTATEGENERATOR", hidden.viewStateGenerator);
  params.set("__VIEWSTATEENCRYPTED", "");
  params.set("__EVENTVALIDATION", hidden.eventValidation);
  const res = await fetch(hidden.actionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": LEGACY_USER_AGENT },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`NV PUCN Dktinfo.aspx postback (${eventTarget}) failed (${res.status})`);
  }
  return res.text();
}

interface DocketSearchResult {
  docket: string;
  filedDate: string;
  description: string;
}

// Matches each GridView row: a Select$N postback "View" link, then Docket
// No./Date Filed/Description cells. Confirmed live 2026-08-23 against the
// "Active Electric Dockets" postback response. The {0,120} bound skips past
// the "View</a>" link text between the postback call and the first real
// data cell.
const DOCKET_ROW_RE =
  /__doPostBack\(&#39;GridView1&#39;,&#39;Select\$\d+&#39;\)[\s\S]{0,120}?<\/a><\/td><td[^>]*>([^<]+)<\/td><td[^>]*>([^<]+)<\/td><td[^>]*>([\s\S]*?)<\/td>/g;

function parseDocketRows(html: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(DOCKET_ROW_RE)) {
    results.push({
      docket: decodeHtmlEntities(m[1]),
      filedDate: decodeHtmlEntities(m[2]),
      description: decodeHtmlEntities(m[3]),
    });
  }
  if (results.length === 0) {
    throw new Error(
      "NV PUCN Active Electric Dockets postback returned zero parsed rows — the GridView row structure likely changed. Check DOCKET_ROW_RE in src/lib/ingest/nvPucnDockets.ts against a fresh response.",
    );
  }
  return results;
}

function parseMDY(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function searchCandidates(): Promise<DocketSearchResult[]> {
  const bootstrap = await fetchLegacyBootstrap();
  // Mimics the page's "Electric Dockets" sidebar link
  // (javascript:__doPostBack('lnkbtnElectric','')) — narrows PUCN's full
  // ~8,850-docket history down to the much smaller "Active Electric
  // Dockets" view (~150 rows) this module actually parses. See module
  // header FETCHING #1.
  const html = await postback(bootstrap, "lnkbtnElectric");
  return parseDocketRows(html);
}

// Real UEPA applications open "Application of ..." or "Application by ..."
// (optionally "Amended"/"Joint"); "Notice by [company] ... of an
// application to a federal agency" is a different, much larger population
// this module must exclude — see module header SCOPING.
const APPLICATION_RE = /^(?:Amended\s+)?(?:Joint\s+)?Application\s+(?:of|by)\b/i;
const UEPA_RE = /utility environmental protection act/i;

interface OnBaseDoc {
  type: string;
  date: Date;
  dateStr: string;
  note: string;
}

interface DocketResolution {
  resolution: "granted" | "denied" | "dismissed" | null;
}

// See module header STATUS: an ORDER document's note is the real signal, a
// bare "GRANTED"/"DENIED"/"DISMISSED" (not "MOTION GRANTED" or a
// "PROCEDURAL ORDER" note, which are real, frequently-seen procedural
// rulings within a still-open case).
const DISPOSITION_RE = /^(GRANTED|DENIED|DISMISSED)$/i;
// Purely administrative document types routinely filed same-day-or-later as
// companions to the substantive document they accompany — not evidence of
// new proceeding activity. See module header STATUS for why excluding
// these was necessary (without it, a docket's own grant-order Service List
// made every resolved docket look "still active").
const ADMINISTRATIVE_DOC_TYPES = new Set(["SERVICE LIST", "MISC CORRESPONDENCE", "AFFIDAVIT PUB/POST"]);

async function fetchDocketResolution(docketNumber: string): Promise<DocketResolution> {
  const res = await fetch(ONBASE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      QueryID: DOCKETS_QUERY_ID,
      Keywords: [{ ID: DOCKET_NUMBER_KEYWORD_ID, Value: docketNumber }],
      FromDate: null,
      ToDate: null,
      QueryLimit: 500,
    }),
  });
  if (!res.ok) {
    throw new Error(`NV PUCN OnBase KeywordSearch failed (${res.status}) for docket ${docketNumber}`);
  }
  const payload = (await res.json()) as { Data?: { DisplayColumnValues?: { Value: string }[] }[] };
  if (!Array.isArray(payload.Data)) {
    throw new Error(
      "NV PUCN OnBase KeywordSearch response didn't contain a Data array — the API shape likely changed. Check fetchDocketResolution in src/lib/ingest/nvPucnDockets.ts against a fresh response.",
    );
  }

  const docs: OnBaseDoc[] = [];
  for (const d of payload.Data) {
    const cols = d.DisplayColumnValues ?? [];
    const type = cols[1]?.Value ?? "";
    const dateStr = cols[2]?.Value ?? "";
    const note = cols[3]?.Value ?? "";
    const date = parseMDY(dateStr) ?? (dateStr ? new Date(dateStr) : null);
    if (!date || Number.isNaN(date.getTime())) continue;
    docs.push({ type, date, dateStr, note });
  }

  const orders = docs.filter((d) => d.type === "ORDER" && DISPOSITION_RE.test(d.note.trim()));
  if (orders.length === 0) return { resolution: null };

  orders.sort((a, b) => b.date.getTime() - a.date.getTime());
  const latestDisposition = orders[0];

  const laterSubstantiveDoc = docs.some(
    (d) => !ADMINISTRATIVE_DOC_TYPES.has(d.type) && d.date.getTime() > latestDisposition.date.getTime(),
  );
  if (laterSubstantiveDoc) return { resolution: null };

  const note = latestDisposition.note.trim().toUpperCase();
  if (note === "GRANTED") return { resolution: "granted" };
  if (note === "DENIED") return { resolution: "denied" };
  return { resolution: "dismissed" };
}

// Requires an explicit generating-facility phrase to co-occur with a fuel
// keyword before classifying as generation — see module header FUEL/
// PROJECT TYPE for the real false-positive this guards against (a
// transmission-only permit that merely interconnects to an separately-named
// "...Solar..." project).
const GENERATING_FACILITY_RE = /electric generat\w+ (?:facility|plant)|combustion turbines?/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/photovoltaic|\bsolar\b/i, "solar"],
  [/\bgeothermal\b/i, "geothermal"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/natural gas|gas-fueled|gas-fired/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
];

const TRANSMISSION_RE =
  /\btransmission (?:line|system)s?\b|\bkV\b[^.]*\b(?:lines?|switchyards?|switching stations?)\b|\bswitchyards?\b|\bswitching stations?\b|\bsubstations?\b/i;
const STORAGE_RE = /battery energy storage system/i;

function inferProjectTypeAndFuel(description: string): { projectType: ProjectType; fuelType: FuelType } {
  if (GENERATING_FACILITY_RE.test(description)) {
    for (const [re, fuel] of FUEL_KEYWORDS) {
      if (re.test(description)) return { projectType: "generation", fuelType: fuel };
    }
  }
  if (TRANSMISSION_RE.test(description)) return { projectType: "transmission", fuelType: "transmission" };
  if (STORAGE_RE.test(description)) return { projectType: "storage", fuelType: "storage" };
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(description)) return { projectType: "generation", fuelType: fuel };
  }
  return { projectType: "generation", fuelType: "other" };
}

function extractCapacityMw(description: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW(?:ac)?\b/i.exec(description);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Matches a run of capitalized county names immediately preceding
// "County"/"Counties, Nevada" — deliberately does NOT anchor on a preceding
// "in"/"within", because a real description ("...located on private land
// within the Tahoe Reno Industrial Center complex in Storey County,
// Nevada.") put unrelated capitalized words between "within" and the real
// county name; anchoring on the closest capitalized run before "County"
// instead avoids capturing "the Tahoe Reno Industrial Center complex in
// Storey" as one string. Confirmed against all 30 real UEPA applications by
// hand, including multi-county lists ("Clark, Nye, Esmeralda, Mineral, and
// Lyon counties, Nevada").
const COUNTY_RE = /([A-Z][A-Za-z']+(?:,?\s+(?:and\s+)?[A-Z][A-Za-z']+)*)\s+[Cc]ount(?:y|ies),?\s+Nevada/;

function extractCounty(description: string): string | null {
  const m = COUNTY_RE.exec(description);
  return m ? m[1].trim() : null;
}

// Confirmed against all 30 real UEPA applications by hand — handles
// "Application of X", "Application by X", "Amended Application of X",
// "Joint Application of X and Y", and the one irregular real phrasing
// ("Amended Application of TransWest Express LLC for authority under the
// provisions...") via the optional "for authority" clause.
const APPLICANT_RE =
  /^(?:Amended\s+)?(?:Joint\s+)?Application\s+(?:of|by)\s+(?:the\s+)?(.+?)(?:,?\s+for\s+authority)?,?\s+under\s+the\s+provisions\s+of\s+the\s+Utility\s+Environmental\s+Protection\s+Act/i;

function extractApplicant(description: string): string {
  const m = APPLICANT_RE.exec(description);
  return m ? m[1].trim() : description.slice(0, 80);
}

function normalizeDocket(candidate: DocketSearchResult, resolution: DocketResolution): NormalizedProject {
  const matchKey = resolveMatchKey("nv-pucn", candidate.docket);
  const { projectType, fuelType } = inferProjectTypeAndFuel(candidate.description);
  const capacityMw = extractCapacityMw(candidate.description);
  const county = extractCounty(candidate.description);
  const applicant = extractApplicant(candidate.description);
  const filedDate = parseMDY(candidate.filedDate);

  let currentStage: ProjectStage;
  if (resolution.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution.resolution === "denied" || resolution.resolution === "dismissed") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Public Utilities Commission of Nevada's Utility Environmental Protection Act (UEPA) docket records (legacy docket list plus the PUCN Document Search system).",
    "PUCN has no single reliable \"is this decided\" field; \"still waiting\" here is inferred from scanning each docket's filed Orders for a final granting/denying/dismissing disposition (as opposed to a procedural motion order) with no further substantive filing since — see the ingestion module header for how this was calibrated against real dockets, including several still-active multi-phase UEPA reviews that had already received an earlier phase's grant.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket description text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket description text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Nevada, per the docket description — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (NV PUCN Docket ${candidate.docket})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "NV",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `Nevada PUCN docket ${candidate.docket}: ${resolution.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Utility Environmental Protection Act permit from the Public Utilities Commission of Nevada — Docket No. ${candidate.docket}, "${candidate.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      // No per-docket deep link was found on either PUCN system — the
      // legacy site's own detail view is useless for anything filed after
      // ~October 2023 (see module header FETCHING #1), and the new OnBase
      // site's public search is a session-driven Angular SPA with no
      // shareable per-result URL confirmed. Links to the search homepage
      // instead of guessing a URL that might not resolve.
      {
        label: `NV PUCN Docket No. ${candidate.docket}`,
        url: "https://puc-onbase.nv.gov/",
      },
    ],
    externalIds: { nvPucn: candidate.docket },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  uepaApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestNvPucnDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allCandidates = await searchCandidates();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const candidates = allCandidates
    .filter((c) => UEPA_RE.test(c.description) && APPLICATION_RE.test(c.description))
    .filter((c) => {
      const filed = parseMDY(c.filedDate);
      return filed != null && filed >= cutoff;
    })
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const resolution = await fetchDocketResolution(candidate.docket);
      toUpsert.push(normalizeDocket(candidate, resolution));
    } catch (err) {
      errors.push({ matchKey: candidate.docket, message: String(err) });
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
    uepaApplicationCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestNvPucnDockets()
    .then((summary) => {
      console.log(
        `Nevada PUCN UEPA docket ingestion complete: ${summary.candidatesFound} active electric dockets scanned, ` +
          `${summary.uepaApplicationCandidates} real UEPA permit applications within the ${LOOKBACK_YEARS}-year lookback, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
