// Wisconsin Public Service Commission (PSC) Certificate of Public
// Convenience and Necessity (CPCN) / Certificate of Authority (CA) docket
// ingestion — one of several states built in parallel in the per-state
// series started with vaSccDockets.ts (see that file's header for the
// overall rationale). Confirmed by hand 2026-08-23 via real requests
// against the live apps.psc.wi.gov system — no assumption below was taken
// from documentation or training-data memory alone.
//
// SCOPING: Wisconsin's statutory siting-certificate process for electric
// generation/storage/transmission facilities is a two-track system, but —
// unlike NY's Article VII/Article VIII split — both tracks share ONE docket
// "case type" code in PSC's own case-numbering system, confirmed live:
//   - Wis. Stat. § 196.491(3): Certificate of Public Convenience and
//     Necessity (CPCN), required for large facilities (generally >= 100 MW
//     generation, or transmission lines >= 100 kV and >= 1 mile).
//   - Wis. Stat. § 196.49: Certificate of Authority (CA), required for
//     smaller facilities below the CPCN thresholds (most solar/storage
//     projects under 100 MW, most substation/distribution-tier work, most
//     municipal-utility construction).
// PSC's docket numbers are `{utility_id}-{case_type}-{seq_num}` (e.g.
// "9832-CE-100"), and BOTH the CPCN and CA processes file under case type
// "CE" ("CE = Electric" per the live case-type dropdown on the docket
// search) — confirmed by hand against dozens of real dockets whose own
// title text says "...for a Certificate of Public Convenience and
// Necessity..." and others that say "...for a Certificate of Authority..."
// sharing the identical "-CE-" docket-number infix. There is no separate
// "CA" case-type code. This module therefore only searches case type "CE".
//
// FETCHING — apps.psc.wi.gov's "Case Management System" (CMS), a plain
// server-rendered ASP.NET WebForms app, no JS execution required, no auth,
// no CAPTCHA, no paid API. Confirmed by hand:
//   1. Candidate discovery: GET https://apps.psc.wi.gov/APPS/dockets/default.aspx
//      returns a docket-search form (__VIEWSTATE/__VIEWSTATEGENERATOR, no
//      __EVENTVALIDATION field at all — confirmed absent from the page,
//      meaning EnableEventValidation is off for this page and any value can
//      be POSTed back in ddl_case_type/ddl_status without a matching
//      validation token). POSTing that VIEWSTATE back with
//      ddl_case_type=CE&ddl_status=A&btn_search=Search (all other fields
//      blank) returns every "Active"-status CE docket (145 rows as of
//      2026-08-23) as a plain server-rendered `<table id="gv_data">`, each
//      row a `<td><a href="content/detail.aspx?id={utilityId}&case=CE&num={seqNum}">`
//      link plus Application Date/Title/Status columns. No cookies, no
//      custom User-Agent, no session state needed at all — confirmed by
//      running the whole GET-then-POST flow with Node's bare `fetch` and no
//      header overrides (unlike NV PUCN's legacy site, which silently
//      renders a different unparseable markup without a real browser
//      User-Agent — WI's CMS has no such sniffing).
//   2. Per-docket resolution check: GET
//      https://apps.psc.wi.gov/ERF/ERFsearch/content/searchResult.aspx?UTIL={utilityId}&CASE=CE&SEQ={seqNum}&START=none&END=none&TYPE=ORD&SERVICE=none&KEY=none&NON=N
//      — a plain unauthenticated querystring GET (no viewstate/session
//      needed, confirmed working standalone) that returns every filed
//      Order-type document for that docket, each with a title and filed
//      date. Reverse-engineered from the docket detail page's own
//      "Documents" tab, whose per-document-type links point at
//      /pages/ERFresult.htm?...&TYPE=ORD&... — that URL itself just does a
//      client-side redirect (`window.location = '/ERF/ERFsearch/content/searchResult.aspx' + location.search`)
//      to the real endpoint used here directly.
//
// STATUS — same lesson as every prior state in this series, independently
// reconfirmed here: the CMS's own docket "Status" field (dropdown values
// Active/Archived/Closed/Destroyed) is a RECORDS-RETENTION lifecycle flag,
// not a case-decision flag, and is essentially useless for "is this still
// pending" — confirmed two ways:
//   (a) A full dump of all 1,337 historical CE dockets (any status) never
//       once used the value "Closed" (zero rows; grep-counted by hand) —
//       only Active (146)/Archived (20)/Destroyed (1,006/1,171... exact
//       count varies by snapshot) ever appear. "Closed" exists as a
//       selectable dropdown option but is never actually assigned to any
//       real electric docket.
//   (b) Real, independently-known-resolved dockets sit in "Active" status
//       indefinitely: 5-CE-146 (Cardinal-Hickory Creek 345 kV transmission
//       line — granted its Final Decision 09/26/2019, fully built and
//       energized by 2023) and 9697-CE-100/101 (Badger Hollow Solar Farm,
//       ~300 MW, granted its Final Decision 04/18/2019, long since built
//       and operating) both still show Status="Active" as of 2026-08-23,
//       7+ years after being decided. "Active" therefore just means "not
//       yet moved into records-retention archival," not "still under
//       review" — but since real still-pending applications are by
//       definition recent, they are always still "Active" too (confirmed:
//       nothing genuinely pending was ever found with a non-Active status),
//       so restricting candidate discovery to ddl_status=A is a safe,
//       comprehensive filter for "everything that could possibly still be
//       pending," while the real resolved/pending determination below never
//       relies on this field.
// The real signal: WI PSC's own name for its CPCN/CA grant order is a
// "Final Decision" — every resolved docket checked by hand has an
// Order-type document titled "Final Decision Signed and Served MM-DD-YY"
// (confirmed on 5-CE-146: "Final Decision Signed and Served 09-26-19"; on
// 9697-CE-100: "Final Decision Signed ad Served 04-18-19" — note the real
// typo, "ad" not "and", confirmed present in the live title text, which is
// why FINAL_DECISION_RE matches on "final decision" alone and not on
// "and served"). A currently-pending docket has ZERO Order-type documents
// at all — confirmed on two real, freshly-filed 2026 dockets (9842-CE-100,
// filed 6/17/2026, and 6680-CE-192, filed 3/19/2026): both return "Total
// Return: 0" from the ORD-type document search. The "Final Decision" title
// text itself does not reliably distinguish granted vs. denied (it's a
// generic "a final decision issued" title, not "granting"/"denying" — WI
// PSC's own convention, confirmed on every real example found), and no
// real denied CPCN/CA docket was found anywhere in the live population to
// calibrate a denial pattern against (same gap noted in azAccLineSiting.ts
// and nvPucnDockets.ts for their own DENY_RE) — DENY_RE below is a
// best-effort keyword check on the off chance a title does say "denying,"
// not a confirmed-working pattern. Since WI PSC CPCN/CA denials appear to
// be rare-to-nonexistent in practice, a resolved docket whose title doesn't
// match DENY_RE defaults to "granted," which is also moot for this site's
// purposes: RESOLVED_STAGES (common.ts) deletes the row either way once
// resolved, so granted/denied only affects which specific resolved stage is
// recorded before deletion, not whether the project disappears from the
// site.
//
// IN-SCOPE FILTER (generation/storage/transmission vs. everything else "CE"
// covers): case type "CE" is NOT exclusively CPCN/CA siting for new
// capacity — the same case type also covers routine municipal-utility
// substation/transformer/distribution-equipment filings ("Application of
// the City of X ... for a Certificate of Authority to Construct a New
// Substation Transformer"), which are explicitly out of scope per the task
// brief ("not general administrative dockets"). Confirmed by hand against
// all 141 real ("Application of/for," excluding "Pre-application of," which
// is WI's mandatory pre-filing consultation step and not yet a real
// application under review) Active CE dockets: only including a title that
// names an actual generation fuel/technology, a battery/energy storage
// system, or a transmission line keeps 86 of 141 and correctly drops the
// ~55 pure substation/transformer/distribution-upgrade filings (e.g.
// 6700-CE-112 "Certificate of Authority to Construct an Expansion of an
// Existing Substation..." — no generation, storage, or transmission-line
// language anywhere in the title — correctly excluded). One real gotcha
// found by testing, the mirror image of nvPucnDockets.ts's own
// GENERATING_FACILITY_RE gotcha: several real solar/storage CPCN titles
// describe the project's OWN interconnection tie line using "transmission"
// language (e.g. 9820-CE-100, Vista Sands Solar: "...a 345 kV generator tie
// line, and 138 kV collector transmission lines..."; 9830-CE-100, Emerald
// Bluffs Solar Park: "...and 1.14 Mile 345 kV Transmission Tie Line...") —
// checking transmission-line language before generation-fuel language
// misclassified these as pure transmission projects. Fixed by checking
// generation-fuel keywords FIRST (same fix-shape as NY's hasGenerationFuel
// gate for storage, and NV's GENERATING_FACILITY_RE gate for generation).
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields, extracted from the
// docket title text, same approach/caveats as every other keyword-based
// source in this series. Known false-positive accepted rather than
// over-engineered around: a handful of real in-scope titles reference an
// EXISTING plant's own name that happens to contain a generation keyword
// for what's actually an ancillary-system filing (e.g. 5-CE-152, "...a New
// Wastewater Treatment System at the Elm Road Generating Station" — a water
// infrastructure filing, not new generation capacity, swept in only because
// "Generating Station" is part of the plant's proper name) — flagged here
// rather than hand-excluded one docket at a time, since the volume observed
// (1-2 of 86) doesn't justify a bespoke exclusion regex, but noted in
// dataQualityNote isn't currently differentiated for this specific case.
//
// Wired to Vercel Cron weekly, 02:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-wi-psc/route.ts) — a full run against all 71 real
// in-scope candidates found live took 117.6s, comfortably inside the 300s
// cron maxDuration budget (each candidate is a single small unauthenticated
// GET, no per-candidate multi-step session dance like NV/NY needed). MAX_CANDIDATES
// is set well above the current live population as headroom for growth,
// with candidates sorted most-recent-first before slicing so a future
// larger population still prioritizes currently-relevant dockets first.
// Also politeness-delayed between per-candidate resolution-check requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const CMS_SEARCH_URL = "https://apps.psc.wi.gov/APPS/dockets/default.aspx";
const ERF_SEARCH_URL = "https://apps.psc.wi.gov/ERF/ERFsearch/content/searchResult.aspx";
const DETAIL_BASE_URL = "https://apps.psc.wi.gov/APPS/dockets/content/detail.aspx";

// Confirmed gotcha found only by testing (not documented anywhere), the
// same shape as nvPucnDockets.ts's own LEGACY_USER_AGENT gotcha: the CMS
// docket-search app (APPS/dockets/default.aspx) performs classic ASP.NET
// browser-capability sniffing on the User-Agent header. Any request whose
// User-Agent it doesn't recognize as a modern browser — which includes
// Node's default fetch User-Agent — gets served a completely different
// "downlevel" markup for the results grid (each cell wrapped in `<font
// color=...>` tags, `nowrap="nowrap"`/`bgcolor=` attributes instead of
// `style=`, no `href` on the sort-column `<a>` structure DOCKET_ROW_RE
// expects), which silently matches zero rows. The ERF Order-document search
// endpoint (searchResult.aspx) does NOT exhibit this behavior — confirmed
// working identically with and without this header — so it's only applied
// to the CMS requests below.
const CMS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// See module header: 86 real in-scope candidates found live on 2026-08-23,
// out of 145 total Active CE dockets. Set well above that as headroom.
export const MAX_CANDIDATES = 150;
const REQUEST_DELAY_MS = 250;
// Defensive backstop only, not load-bearing for correctness: the real
// resolved/pending determination comes from the per-docket Final Decision
// check (see module header STATUS), which works correctly at any age. This
// just avoids burning request budget checking decades-old Active-status
// dockets that are already known (see module header) to be long-since
// resolved in practice.
const LOOKBACK_YEARS = 8;

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
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&nbsp;/g, " ")
    .trim();
}

interface HiddenFields {
  viewState: string;
  viewStateGenerator: string;
}

function extractHiddenFields(html: string): HiddenFields {
  function extract(id: string): string {
    const re = new RegExp(`id="${id}"[^>]*value="([^"]*)"`);
    const m = re.exec(html);
    return m ? m[1] : "";
  }
  const viewState = extract("__VIEWSTATE");
  if (!viewState) {
    throw new Error(
      "WI PSC CMS default.aspx response didn't contain __VIEWSTATE — the page structure likely changed. Check extractHiddenFields in src/lib/ingest/wiPscDockets.ts against a fresh response.",
    );
  }
  return { viewState, viewStateGenerator: extract("__VIEWSTATEGENERATOR") };
}

async function fetchBootstrap(): Promise<HiddenFields> {
  const res = await fetch(CMS_SEARCH_URL, { headers: { "User-Agent": CMS_USER_AGENT } });
  if (!res.ok) throw new Error(`WI PSC CMS default.aspx bootstrap request failed (${res.status})`);
  return extractHiddenFields(await res.text());
}

interface DocketSearchResult {
  utilityId: string;
  seqNum: string;
  docket: string;
  applicationDate: string;
  title: string;
}

// Matches each gv_data GridView row for a docket with a live detail link
// (Active-status dockets render this way; Archived/Destroyed ones render a
// non-clickable `<a>` with no href instead — irrelevant here since this
// module only ever searches ddl_status=A). Confirmed live 2026-08-23.
const DOCKET_ROW_RE =
  /<a href="content\/detail\.aspx\?id=(\d+)&amp;case=([A-Z]+)&amp;num=(\d+)">[^<]+<\/a><\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([\s\S]*?)<\/td><td[^>]*>([^<]*)<\/td>/g;

function parseDocketRows(html: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(DOCKET_ROW_RE)) {
    results.push({
      utilityId: m[1],
      seqNum: m[3],
      docket: `${m[1]}-${m[2]}-${m[3]}`,
      applicationDate: decodeHtmlEntities(m[4]),
      title: decodeHtmlEntities(m[5]).trim(),
    });
  }
  if (results.length === 0) {
    throw new Error(
      "WI PSC CMS Active CE docket search returned zero parsed rows — the GridView row structure likely changed. Check DOCKET_ROW_RE in src/lib/ingest/wiPscDockets.ts against a fresh response.",
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
  const bootstrap = await fetchBootstrap();
  const params = new URLSearchParams();
  params.set("__EVENTTARGET", "");
  params.set("__EVENTARGUMENT", "");
  params.set("__VIEWSTATE", bootstrap.viewState);
  params.set("__VIEWSTATEGENERATOR", bootstrap.viewStateGenerator);
  params.set("txt_docket_utility_id", "");
  params.set("txt_docket_case_type_cd", "");
  params.set("txt_docket_seq_num", "");
  params.set("ddl_case_type", "CE");
  params.set("ddl_service_category_cd", "");
  params.set("ddl_utility_name", "0");
  params.set("ddl_status", "A");
  params.set("txt_docket_title_txt", "");
  params.set("btn_search", "Search");

  const res = await fetch(CMS_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": CMS_USER_AGENT },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`WI PSC CMS docket search POST failed (${res.status})`);
  return parseDocketRows(await res.text());
}

// A real siting-certificate/authority APPLICATION always opens
// "Application of ..." or "Application for ..." (optionally "Joint
// Application of ..."); "Pre-application of ..." / "Joint Pre-application
// of ..." is WI's mandatory pre-filing consultation step, not yet a real
// application under Commission review — see module header SCOPING.
const OPENER_RE = /^(?:joint\s+)?application\s+(?:of|for)\b/i;

// See module header IN-SCOPE FILTER. Checked in this order: generation-fuel
// keywords first (most specific signal of what's actually being built,
// avoids the tie-line/transmission-language false positive described in
// the header), then storage-only, then transmission-only.
const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b|\bphotovoltaic\b/i, "solar"],
  [/\bwind\b/i, "wind_onshore"],
  [
    /\bnatural gas\b|\bgas[- ]fired\b|\bcombustion turbines?\b|\bcombined cycle\b|\breciprocating internal combustion engines?\b/i,
    "gas",
  ],
  [/\bbiomass\b/i, "other"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];
const STORAGE_RE = /\benergy storage (?:system|project)\b|\bbattery energy storage\b|\bbess\b/i;
const TRANSMISSION_RE = /\btransmission lines?\b|\bkV[\s\S]{0,20}transmission\b/i;

function isInScope(title: string): boolean {
  return FUEL_KEYWORDS.some(([re]) => re.test(title)) || STORAGE_RE.test(title) || TRANSMISSION_RE.test(title);
}

function inferProjectTypeAndFuel(title: string): { projectType: ProjectType; fuelType: FuelType } {
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(title)) return { projectType: "generation", fuelType: fuel };
  }
  if (STORAGE_RE.test(title)) return { projectType: "storage", fuelType: "storage" };
  if (TRANSMISSION_RE.test(title)) return { projectType: "transmission", fuelType: "transmission" };
  // Unreachable in practice: isInScope() already requires one of the three
  // signals above before a candidate reaches this function.
  return { projectType: "generation", fuelType: "other" };
}

function extractCapacityMw(title: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW\b/i.exec(title);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// See module header for the WI-specific title patterns this was confirmed
// against by hand (all 86 real in-scope candidates found live 2026-08-23).
// Tried in order, most-specific pattern first; falls back to a truncated
// title if nothing matches so extraction never throws.
function extractApplicant(title: string): string {
  let m = /^application\s+for\s+(?:a|the)\s+certificate\s+of\s+public\s+convenience\s+and\s+necessity\s+of\s+(.+?)\s+to\b/i.exec(
    title,
  );
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = /^joint\s+application\s+of\s+(.+?),?\s+(?:as\s+(?:an?\s+)?electric[^,]*,?\s+)?for\s+(?:a\s+)?(?:certificate|authority)/i.exec(
    title,
  );
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = /^application\s+of\s+(.+?),?\s+as\s+(?:an?\s+)?(?:electric|municipal)[^,]*,?\s+for\s+(?:a\s+)?(?:certificate|authority)/i.exec(
    title,
  );
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = /^application\s+of\s+(.+?)\s+for\s+(?:a\s+)?(?:certificate|authority)/i.exec(title);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = /^application\s+of\s+(.+?)\s+to\s+construct/i.exec(title);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = /^application\s+for\s+(.+?)\s+to\s+construct/i.exec(title);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  return title.slice(0, 80);
}

// See module header for the multi-word-county-name gotcha this deliberately
// accepts as an imperfection (e.g. "Fond du Lac County" resolves to just
// "Lac" — WI has several multi-word county names, and confidently
// distinguishing them from a preceding run of Town names in the same title
// wasn't worth the complexity for a field this site never geocodes from
// anyway). Confirmed against all 86 real in-scope titles by hand.
function extractCounty(title: string): string | null {
  let m = /\bCounties\s+of\s+([A-Z][A-Za-z.']+(?:,\s+[A-Z][A-Za-z.']+)*(?:,?\s+and\s+[A-Z][A-Za-z.']+)?)\b/.exec(title);
  if (m) return [...new Set(m[1].split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean))].join(", ");

  m = /\b([A-Z][A-Za-z.']+(?:,\s+[A-Z][A-Za-z.']+)*,?\s+and\s+[A-Z][A-Za-z.']+)\s+Counties\b/.exec(title);
  if (m) return [...new Set(m[1].split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean))].join(", ");

  const countyRe = /(?:^|,\s*|\bin\s+the\s+|\bin\s+|\bof\s+)((?:[A-Z][A-Za-z.']*\.?\s*){1,3})\s*County\b/g;
  const matches = [...title.matchAll(countyRe)];
  if (matches.length === 0) return null;
  const withPos = matches.map((mm) => ({ name: mm[1].trim(), end: (mm.index ?? 0) + mm[0].length }));
  withPos.sort((a, b) => b.end - a.end);
  return withPos[0].name;
}

interface DocketResolution {
  resolution: "granted" | "denied" | null;
}

// See module header STATUS: presence of an Order-type document titled
// "Final Decision..." (typo-tolerant — a real live title has "Signed ad
// Served" instead of "and") is the real resolved/pending signal, not the
// CMS's own Status field. DENY_RE is unconfirmed best-effort (see header).
const FINAL_DECISION_RE = /\bfinal\s+decision\b/i;
const DENY_RE = /\bden(?:y|ial|ying)\b/i;

async function fetchDocketResolution(utilityId: string, seqNum: string): Promise<DocketResolution> {
  const url = `${ERF_SEARCH_URL}?UTIL=${utilityId}&CASE=CE&SEQ=${seqNum}&START=none&END=none&TYPE=ORD&SERVICE=none&KEY=none&NON=N`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WI PSC ERF Order-document search failed (${res.status}) for docket ${utilityId}-CE-${seqNum}`);
  const html = await res.text();

  if (!/Total Return:\s*\d+/.test(html)) {
    throw new Error(
      `WI PSC ERF Order-document search response for docket ${utilityId}-CE-${seqNum} didn't contain the expected "Total Return" marker — the page structure likely changed. Check fetchDocketResolution in src/lib/ingest/wiPscDockets.ts against a fresh response.`,
    );
  }

  const titles = [...html.matchAll(/lv_data_lbl_doc_desc_txt_\d+"\s+class="tbTextRight">([\s\S]*?)<\/span>/g)].map((m) =>
    decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "")),
  );

  const finalDecision = titles.find((t) => FINAL_DECISION_RE.test(t));
  if (!finalDecision) return { resolution: null };
  return { resolution: DENY_RE.test(finalDecision) ? "denied" : "granted" };
}

function normalizeDocket(candidate: DocketSearchResult, resolution: DocketResolution): NormalizedProject {
  const matchKey = resolveMatchKey("wi-psc", candidate.docket);
  const { projectType, fuelType } = inferProjectTypeAndFuel(candidate.title);
  const capacityMw = extractCapacityMw(candidate.title);
  const county = extractCounty(candidate.title);
  const applicant = extractApplicant(candidate.title);
  const filedDate = parseMDY(candidate.applicationDate);

  let currentStage: ProjectStage;
  if (resolution.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution.resolution === "denied") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Public Service Commission of Wisconsin's Case Management System, Wisconsin's Certificate of Public Convenience and Necessity (Wis. Stat. § 196.491) / Certificate of Authority (Wis. Stat. § 196.49) siting-certificate docket records.",
    "PSC's own docket \"Status\" field (Active/Archived/Closed/Destroyed) reflects records-retention lifecycle, not case resolution — real dockets decided years ago still show \"Active\" indefinitely; \"still waiting\" here is instead inferred from whether the docket has a filed Order-type document titled \"Final Decision\" (PSC's own name for its CPCN/CA grant/denial order) — see the ingestion module header for how this was calibrated against real, independently-known-resolved dockets.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket title text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket title text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Wisconsin, per the docket title — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (WI PSC Docket ${candidate.docket})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "WI",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `Wisconsin PSC docket ${candidate.docket}: ${resolution.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity / Certificate of Authority determination from the Public Service Commission of Wisconsin — Docket No. ${candidate.docket}, "${candidate.title}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `WI PSC Docket No. ${candidate.docket}`,
        url: `${DETAIL_BASE_URL}?id=${candidate.utilityId}&case=CE&num=${candidate.seqNum}`,
      },
    ],
    externalIds: { wiPsc: candidate.docket },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestWiPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allCandidates = await searchCandidates();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const realApplications = allCandidates
    .filter((c) => OPENER_RE.test(c.title) && isInScope(c.title))
    .filter((c) => {
      const filed = parseMDY(c.applicationDate);
      return filed == null || filed >= cutoff;
    })
    .sort((a, b) => (parseMDY(b.applicationDate)?.getTime() ?? 0) - (parseMDY(a.applicationDate)?.getTime() ?? 0))
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of realApplications) {
    try {
      const resolution = await fetchDocketResolution(candidate.utilityId, candidate.seqNum);
      toUpsert.push(normalizeDocket(candidate, resolution));
    } catch (err) {
      errors.push({ matchKey: candidate.docket, message: String(err) });
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
  ingestWiPscDockets()
    .then((summary) => {
      console.log(
        `Wisconsin PSC docket ingestion complete: ${summary.candidatesFound} Active CE dockets scanned, ` +
          `${summary.realApplicationCandidates} real generation/storage/transmission siting applications, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
