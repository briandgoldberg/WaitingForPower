// Indiana Utility Regulatory Commission (IURC) Certificate of Public
// Convenience and Necessity (CPCN, Ind. Code ch. 8-1-8.5) docket ingestion —
// one of several states built in parallel in the per-state series started
// with vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23 via real GET/POST requests against the live
// iurc.portal.in.gov site and its backing API — no assumption below was
// taken from documentation or training-data memory alone.
//
// FETCHING: iurc.portal.in.gov is a Microsoft Power Pages (Dynamics 365
// portal) site sitting behind Cloudflare, confirmed live to have NO bot
// challenge, NO auth wall, and NO enforced CAPTCHA on the actual data path
// (see below) — a bare curl/fetch with no special User-Agent and no cookie
// jar gets identical results to a browser. The human-facing Advanced Search
// page (/advanced-search/) renders a form with a visible Google reCAPTCHA
// widget, but that widget is ONLY checked in the page's own client-side JS
// (loadLists() calls grecaptcha.getResponse() and refuses to submit if
// empty) — the real backing API it eventually calls never receives or
// checks a captcha token, confirmed by POSTing directly to it with no
// token at all and getting real results. That real API is a SEPARATE
// Azure App Service the portal's JS calls cross-origin:
//   POST https://zus1iurcprodd365companionappmaster-appservice.azurewebsites.net/api/search/advanced
//   Content-Type: application/json
//   body: {"txtCause":"","txtSubDocket":"","ddlPetitionType":"<guid>",
//          "ddlCaseStatus":"","ddlIndustry":"<guid>","txtParties":"",
//          "ddlUtilities":"","txtDateBegin":"","txtDateEnd":"",
//          "txtFilingDateBegin":"","txtFilingDateEnd":"",
//          "txtOrderDateBegin":"","txtOrderDateEnd":"","txtPageNumber":"1"}
// returns JSON {TotalRecords, PageSize:10, data:[...10 rows...],
// PagerDetails:{TotalPages,...}}, sorted newest-petition-date-first
// (confirmed against every page of a real 80-record result set — matches
// exactly, not assumed). ddlPetitionType/ddlIndustry are Dynamics GUIDs
// resolved from the same host's public, unauthenticated list endpoints
// (GET /api/list/petitiontypes and /api/list/industrytypes/all) — see
// PETITION_TYPE_ID/INDUSTRY_ID below for the two confirmed live 2026-08-23.
// txtDateBegin/txtDateEnd were tried as a server-side date filter and
// silently returned zero rows for a real non-empty range (a real gotcha,
// not used) — this module instead paginates the full result set and stops
// once dates fall outside LOOKBACK_YEARS, the same "broad server search,
// precise local filter" pattern nyDpsDockets.ts documents.
// Per-docket detail: GET https://iurc.portal.in.gov/docketed-case-details/?id=<legalCaseId>
// is a plain server-rendered HTML page (part of the Power Pages site
// itself, NOT the companion API) containing a labeled
// "Caption/Description" field with the docket's full petition caption —
// this is the only place a human-readable description of what's actually
// being proposed exists; the search API's own rows carry no description at
// all, only Cause/Sub-Docket/Industry/Petition Type/Case Status/Petition
// Date/Parties. This module only fetches this expensive detail page for
// candidates whose search-row Case Status suggests they're still open (see
// STATUS) — confirmed live this is a small fraction of the population (3 of
// 80 real electric CPCN dockets as of 2026-08-23), so the per-candidate
// detail fetch this module's cron timing budget actually has to worry about
// is cheap in practice even without a tight MAX_CANDIDATES.
//
// SCOPING: Ind. Code ch. 8-1-8.5 requires a CPCN from the IURC before a
// regulated electric utility constructs, acquires, or contracts for a
// major generating facility (including, per real captions checked, a
// build-transfer/purchase-and-sale acquisition of an existing plant, or a
// long-term renewable PPA structured as a "Clean Energy Project" under the
// related Ind. Code ch. 8-1-8.8). IURC's own docket system tags every such
// case with Petition Type "Certificate of Need" (its internal label — the
// docket's own Caption/Description text uses "Certificate of Public
// Convenience and Necessity"/"CPCN" throughout, confirmed identical
// statute citation IC 8-1-8.5 on every real caption checked) crossed with
// Industry "Electric" (confirmed: "Certificate of Need" also covers Gas and
// Water utility need cases under the same petition type label with a
// completely different statute basis — Industry=Electric is what actually
// narrows this to generation CPCNs; confirmed by hand querying
// Industry="Electric-Gas"/"Electric-Gas-Water-Sewer" combined codes too,
// both returned zero rows, so no combination-utility CPCN is missed by
// using the plain "Electric" industry code alone). No standalone
// storage-only or transmission-only CPCN case was found live in this
// population (every one of the ~80 historical Electric+"Certificate of
// Need" dockets checked by caption or by pattern is a generating-facility
// acquisition/construction case) — STORAGE_RE/TRANSMISSION_RE below are
// kept as an easy add, same unconfirmed-but-cheap-to-keep caveat other
// states in this series document for fuel/type branches with no live
// example to calibrate against.
//
// REAL GOTCHA — same Petition Type also covers non-application follow-on
// proceedings: Cause No. 46032 ("...FOR AN ORDER MODIFYING...THE
// COMMISSION'S NOVEMBER 22, 2023 ORDER IN CAUSE NO. 45926 TO APPROVE
// NECESSARY CHANGES TO THE RATEMAKING TREATMENT...") and Cause No. 45847
// ("...FOR AN ORDER: (1) AMENDING THE COMMISSION'S OCTOBER 27, 2021 ORDER
// IN CAUSE NO. 45501...AND AMENDING THE CERTIFICATE OF PUBLIC CONVENIENCE
// AND NECESSITY GRANTED THEREIN ACCORDINGLY") are both filed under
// Petition Type "Certificate of Need" / Industry "Electric" but are
// post-grant modification/amendment proceedings on an ALREADY-DECIDED
// CPCN, not a new application "waiting" on anything in this site's sense.
// A naive "petition type says Certificate of Need" filter would wrongly
// track these. Confirmed by testing: every genuine new CPCN application
// caption checked (46443, 46389, 46217, 46198, 46193, 46091, 45926, 45836 —
// 8 real captions) contains "ISSUANCE"/"ISSUE"/"GRANT"/"GRANTING" within a
// short window immediately before "CERTIFICATE OF PUBLIC CONVENIENCE AND
// NECESSITY"/"CERTIFICATE OF NEED", e.g. "ISSUANCE OF A CERTIFICATE OF...",
// "ISSUANCE TO NIPSCO OF A CERTIFICATE OF...", "GRANTING CEI SOUTH A
// CERTIFICATE OF...". Every real modification/amendment caption checked
// (46032, 45847, 45839) instead has "AMENDING"/"MODIFYING" in that same
// position, or no certificate phrase at all. GRANT_TRIGGER_RE/
// AMEND_TRIGGER_RE below encode exactly this distinction — a candidate is
// only treated as a genuine new application if GRANT_TRIGGER_RE matches AND
// AMEND_TRIGGER_RE does not. A candidate that fails this filter is treated
// as not-a-tracked-project (a cleanup-only upsert, same as a resolved
// docket — see below) rather than silently skipped, so a stale row from any
// earlier, looser version of this filter still gets cleaned up.
//
// STATUS — an unusually reassuring result in this series (most prior states
// found their obvious "Status" field to be unreliable): IURC's own Case
// Status field (New/Pending/Decided/Appealed/Void/Consolidated/Archived,
// confirmed live via GET /api/list/statustypes) was cross-checked, not
// trusted at face value, against a real independent signal — GET
// /api/document/orders (POST, JSON body {txtPageNumber:"1", Id:"<legalCaseId>"})
// which lists every "Final Order" filed on a docket. Across all 80 real
// Electric+"Certificate of Need" dockets live 2026-08-23: every one of the
// 77 "Decided" dockets and the 1 "Appealed" docket had at least one Final
// Order on file (spot-checked directly, e.g. Cause 46032: Final Order dated
// 8/21/2024; Cause 46193 (Appealed): Final Order dated 10/29/2025); the 2
// "Pending" dockets (46443, 46389) had zero Final Orders. So Case Status
// itself is used directly here — New/Pending means genuinely still waiting
// on the Commission, Decided/Void/Consolidated/Archived means resolved (not
// tracked, and cleaned up if previously tracked), and Appealed gets its own
// stage: an Appealed docket already has the Commission's own Final Order
// (confirmed above) but that order is being challenged further in court, so
// it's not stale/frozen the way NY DPS or NV PUCN's more ambiguous
// "resolved-with-caveats" cases are — this module maps it to this site's
// "litigation" ProjectStage (not a RESOLVED_STAGE, so it stays tracked)
// rather than deleting it, since the underlying regulatory question is
// still legally unresolved. No real "Void"/"Consolidated"/"Archived"
// electric CPCN docket was found live to confirm those map correctly to
// "resolved" — kept as the safe default (same unconfirmed-edge-case caveat
// pattern other modules in this series use) since every one of those
// statuses describes a docket that is, at minimum, not an open application
// awaiting a first decision.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields — extracted from the
// Caption/Description text, which (unlike every other state in this
// series) is entirely ALL CAPS in the source. Real gotcha found by testing:
// several real captions describe a MULTI-UNIT project as "TWO COMBINED
// CYCLE (“CC”) NATURAL GAS UNITS, AT APPROXIMATELY 738 MEGAWATTS (WINTER
// RATING) EACH" (Duke Energy Indiana's Cayuga CC Project, Cause 46193) — a
// naive single-number capacity regex captures only 738 MW, undercounting
// the real ~1,476 MW total by half. This module still only extracts the
// single first MW figure (no reliable general way to parse an arbitrary
// unit-count multiplier out of free text) but flags this specific
// EACH-after-MW pattern in dataQualityNote rather than silently
// under-reporting with no caveat. Many real captions (e.g. Cause 46389's
// "918 MW SYCAMORE RIVERSIDE ENERGY CENTER", Cause 46217's "OREGON CLEAN
// ENERGY CENTER GENERATING FACILITY" with no fuel word at all — a real
// acquisition of an existing out-of-state Ohio gas plant, confirmed by the
// caption never actually saying "gas"/"natural gas" anywhere) name neither
// a specific fuel nor an Indiana county at all — these fall through to
// fuelType "other" and county null rather than guessing, consistent with
// this module's/this series' "confirm, don't guess" rule.
//
// HEARING SCHEDULE: the same docketed-case-details page's own client-side JS
// (see FETCHING above) also renders a "Hearing Schedules" DataTable by
// calling a second, separate real JSON endpoint on the same companion Azure
// App Service — confirmed live 2026-09-05:
//   POST https://zus1iurcprodd365companionappmaster-appservice.azurewebsites.net/api/list/hearings
//   Content-Type: application/json
//   body: {"txtPageNumber":"1","Id":"<legalCaseId>"}
// returns a plain JSON array, e.g. (real response for Cause 46443, Indiana
// Michigan Power's pending CPCN, fetched live 2026-09-05):
//   [{"iurc_hearingstartdate":"11/20/2026 9:30 AM","iurc_hearingenddate":
//     "11/20/2026 4:30 PM","iurc_hearingroom":"222","iurc_length":"7.50",
//     "iurc_hearingtype":"Evidentiary Hearing","iurc_remarks":""}, ...]
// No CAPTCHA, no auth — same unauthenticated companion API this module
// already relies on for the search itself. Real hearingtype values
// confirmed live across several real dockets: "Evidentiary Hearing",
// "Field Hearing" (an in-person public hearing held in the affected
// community, e.g. Cause 46193's real Bloomington/Terre Haute field
// hearings), "Settlement Hearing", and "Attorney Conference" (a private
// scheduling/status conference between counsel, confirmed NOT open to the
// public the way the other three are) — EXCLUDED_HEARING_TYPES below
// excludes only that last one. Fetched only for the same small New/Pending/
// Appealed subset this module already fetches a Caption for (see FETCHING
// above), not the full candidate list — matches this module's existing
// cost discipline, and a resolved docket's hearing history is all in the
// past by construction anyway. Real live check confirmed both hit and miss:
// Cause 46443 (Pending) has two genuinely upcoming hearings (11/20/2026,
// 12/1/2026); Cause 46389 (Pending) has one real hearing on file but it's
// already in the past (8/17/2026, before this writing's 2026-09-05 "today");
// Cause 46193 (Appealed) has seven real hearings on file, all in the past
// (the case's own IURC hearing record ended when its Final Order issued —
// see module header STATUS — even though the case remains open on appeal in
// court). Only the earliest still-future entry (of a non-excluded type) is
// kept, matching this project's standard "only upcoming dates are useful"
// rule; commentLink points at the docket's own detail page (no per-hearing
// notice URL is published) since that's the only page a visitor could use
// to find the hearing's exact room/format.
//
// Wired to Vercel Cron weekly, 03:30 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-in-iurc/route.ts). A real full run (27 candidates
// within the 6-year lookback, 3 requiring a detail fetch) completed in
// 11.7s, comfortably inside the 300s cron budget, because (per FETCHING
// above) the expensive per-candidate detail fetch only ever runs for the
// small New/Pending/Appealed subset, not the full candidate list.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const SEARCH_API_URL =
  "https://zus1iurcprodd365companionappmaster-appservice.azurewebsites.net/api/search/advanced";
const DETAIL_BASE_URL = "https://iurc.portal.in.gov/docketed-case-details/";
// See module header HEARING SCHEDULE.
const HEARINGS_API_URL =
  "https://zus1iurcprodd365companionappmaster-appservice.azurewebsites.net/api/list/hearings";

// Confirmed live 2026-08-23 via GET /api/list/petitiontypes and
// GET /api/list/industrytypes/all on the companion API host above — see
// module header FETCHING/SCOPING.
const PETITION_TYPE_ID = "75c7e1c3-d881-e611-8107-1458d04eabe0"; // "Certificate of Need"
const INDUSTRY_ID = "002a5051-0a08-e611-80f6-1458d04eabe0"; // "Electric"

// See module header FETCHING for why this is high relative to how few
// candidates actually trigger an expensive detail fetch, and STATUS for why
// LOOKBACK_YEARS is generous — CPCN cases plus a possible court appeal can
// legitimately run a few years from petition to final resolution.
export const MAX_CANDIDATES = 100;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
const LOOKBACK_YEARS = 6;
const MAX_SEARCH_PAGES = 20; // safety cap; real population is ~80 total records, 10/page

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMDY(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
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

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

interface SearchResultRow {
  legalCaseId: string;
  docketNumber: string;
  caseStatus: string;
  petitionDate: Date | null;
  parties: string;
}

interface SearchApiResponse {
  data?: Record<string, unknown>[];
  PagerDetails?: { TotalPages?: number };
}

async function fetchSearchPage(page: number): Promise<{ rows: SearchResultRow[]; totalPages: number }> {
  const res = await fetch(SEARCH_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      txtCause: "",
      txtSubDocket: "",
      ddlPetitionType: PETITION_TYPE_ID,
      ddlCaseStatus: "",
      ddlIndustry: INDUSTRY_ID,
      txtParties: "",
      ddlUtilities: "",
      txtDateBegin: "",
      txtDateEnd: "",
      txtFilingDateBegin: "",
      txtFilingDateEnd: "",
      txtOrderDateBegin: "",
      txtOrderDateEnd: "",
      txtPageNumber: String(page),
    }),
  });
  if (!res.ok) {
    throw new Error(`IN IURC search/advanced request failed (${res.status}) for page ${page}`);
  }
  const json = (await res.json()) as SearchApiResponse;
  if (!Array.isArray(json.data)) {
    throw new Error(
      "IN IURC search/advanced response didn't contain a data array — the API shape likely changed. Check fetchSearchPage in src/lib/ingest/inIurcDockets.ts against a fresh response.",
    );
  }
  const rows = json.data.map((r) => ({
    legalCaseId: String(r.iurc_legalcaseid ?? ""),
    docketNumber: String(r.iurc_docketnumber ?? ""),
    caseStatus: String(r.iurc_casestatustype ?? ""),
    petitionDate: parseMDY(r.iurc_petitiondate as string | undefined),
    parties: decodeHtmlEntities(String(r.iurc_forpetionersearch ?? "")).replace(/,\s*$/, ""),
  }));
  return { rows, totalPages: json.PagerDetails?.TotalPages ?? page };
}

async function searchCpcnCandidates(maxCandidates: number): Promise<SearchResultRow[]> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const all: SearchResultRow[] = [];
  for (let page = 1; page <= MAX_SEARCH_PAGES; page++) {
    const { rows, totalPages } = await fetchSearchPage(page);
    if (rows.length === 0) break;
    all.push(...rows);
    const oldestOnPage = rows.reduce<Date | null>((oldest, r) => {
      if (!r.petitionDate) return oldest;
      if (!oldest || r.petitionDate < oldest) return r.petitionDate;
      return oldest;
    }, null);
    if (oldestOnPage && oldestOnPage < cutoff) break;
    if (page >= totalPages) break;
    if (all.length >= maxCandidates * 2) break; // generous safety margin before local filtering
  }

  return selectWithRotation(
    all.filter((r) => r.docketNumber && r.legalCaseId).filter((r) => r.petitionDate == null || r.petitionDate >= cutoff),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );
}

// See module header STATUS.
const ACTIVE_STATUSES = new Set(["New", "Pending"]);
const LITIGATION_STATUSES = new Set(["Appealed"]);

// See module header REAL GOTCHA for why both a positive and negative
// pattern are needed — Petition Type "Certificate of Need" also covers
// post-grant modification/amendment proceedings on an already-decided CPCN.
const GRANT_TRIGGER_RE =
  /\b(?:ISSUANCE|ISSUE|GRANTING|GRANT)\b[^.;]{0,60}?CERTIFICATE(?:S)?\s+OF\s+(?:PUBLIC\s+CONVENIENCE\s+AND\s+NECESSITY|NEED)\b/i;
const AMEND_TRIGGER_RE =
  /\b(?:AMEND(?:ING|MENT)?|MODIF(?:Y|YING|ICATION))\b[^.;]{0,60}?CERTIFICATE(?:S)?\s+OF\s+(?:PUBLIC\s+CONVENIENCE\s+AND\s+NECESSITY|NEED)\b/i;

function isGenuineNewCpcnApplication(caption: string): boolean {
  return GRANT_TRIGGER_RE.test(caption) && !AMEND_TRIGGER_RE.test(caption);
}

// Matches the labeled Caption/Description field on the server-rendered
// docketed-case-details page — see module header FETCHING. Confirmed live
// 2026-08-23 against real detail pages for both New/Pending and
// Decided/Appealed dockets.
const CAPTION_FIELD_RE =
  /<label>Caption\/Description<\/label>[\s\S]{0,200}?class="control text-wrap">([\s\S]*?)<\/div>/i;

async function fetchCaption(legalCaseId: string): Promise<string> {
  const res = await fetch(`${DETAIL_BASE_URL}?id=${encodeURIComponent(legalCaseId)}`);
  if (!res.ok) {
    throw new Error(`IN IURC docketed-case-details request failed (${res.status}) for id ${legalCaseId}`);
  }
  const html = await res.text();
  const m = CAPTION_FIELD_RE.exec(html);
  if (!m) {
    throw new Error(
      `IN IURC docketed-case-details page for id ${legalCaseId} didn't contain a Caption/Description field — the page structure likely changed. Check CAPTION_FIELD_RE in src/lib/ingest/inIurcDockets.ts against a fresh response.`,
    );
  }
  return stripTags(m[1]);
}

interface UpcomingHearing {
  date: Date;
}

interface HearingApiRow {
  iurc_hearingstartdate?: string;
  iurc_hearingtype?: string;
}

// See module header HEARING SCHEDULE — a private attorney-only scheduling
// conference, confirmed live not open to the public the way every other
// real hearingtype value observed (Evidentiary Hearing/Field Hearing/
// Settlement Hearing) is.
const EXCLUDED_HEARING_TYPES = new Set(["Attorney Conference"]);

// Real observed format: "11/20/2026 9:30 AM" — parseable directly by the
// JS Date constructor (confirmed live), unlike this module's own parseMDY
// (date-only, no time component).
async function fetchUpcomingHearing(legalCaseId: string): Promise<UpcomingHearing | null> {
  const res = await fetch(HEARINGS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txtPageNumber: "1", Id: legalCaseId }),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as HearingApiRow[];
  if (!Array.isArray(rows)) return null;

  const now = Date.now();
  let earliest: Date | null = null;
  for (const row of rows) {
    if (!row.iurc_hearingstartdate || EXCLUDED_HEARING_TYPES.has(row.iurc_hearingtype ?? "")) continue;
    const d = new Date(row.iurc_hearingstartdate);
    if (Number.isNaN(d.getTime()) || d.getTime() <= now) continue;
    if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
  }
  return earliest ? { date: earliest } : null;
}

// Confirmed against real captions of both forms: "VERIFIED PETITION OF X
// FOR...", "VERIFIED JOINT PETITION OF X AND Y FOR...", and "IN THE MATTER
// OF THE VERIFIED PETITION OF X FOR...". Parenthetical asides (nicknames,
// abbreviations like "(“NIPSCO”)") are stripped separately below rather
// than excluded here, so a joint-petition applicant list stays intact.
// Real gotcha found by testing: Cause 46193's caption reads "...PETITION OF
// DUKE ENERGY INDIANA, LLC (“DUKE ENERGY INDIANA”) PURSUANT TO IND. CODE
// CHS. 8-1-8.5...FOR (1) ISSUANCE..." — the applicant name is followed by
// "PURSUANT TO" (a full statute-citation clause) before the caption's own
// "FOR" ever appears, so a regex that only stops at " FOR " swallows that
// entire clause into the "applicant" capture. Stopping at whichever of
// " FOR "/" PURSUANT TO " comes first fixes this without regressing the
// far more common "...PETITION OF X FOR (1) ISSUANCE..." captions (which
// never contain an earlier "PURSUANT TO").
const APPLICANT_RE = /^(?:IN THE MATTER OF THE\s+)?VERIFIED\s+(?:JOINT\s+)?PETITION OF\s+(.+?)\s+(?:FOR\b|PURSUANT\s+TO\b)/i;

// A handful of abbreviations/entity suffixes that a naive per-word
// title-case pass would otherwise mangle (e.g. "Llc", "Inc.") — confirmed
// against real applicant names in this population (I&M, NIPSCO, LLC, INC,
// CO all observed live).
const PRESERVE_UPPER = new Set(["LLC", "INC", "INC.", "CO", "CO.", "LP", "L.P.", "I&M", "NIPSCO", "CEI"]);
const LOWERCASE_WORDS = new Set(["and", "of", "the", "d/b/a"]);

function toTitleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[.,]+$/, "");
      if (PRESERVE_UPPER.has(word) || PRESERVE_UPPER.has(bare)) return word;
      const lower = word.toLowerCase();
      if (LOWERCASE_WORDS.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function extractApplicant(caption: string, fallback: string): string {
  const m = APPLICANT_RE.exec(caption);
  const raw = m ? m[1] : fallback;
  const cleaned = raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "");
  return cleaned.length > 0 ? toTitleCase(cleaned) : toTitleCase(fallback);
}

const CAPACITY_RE = /([\d,]+(?:\.\d+)?)\s*(?:MW|MEGAWATTS?)\b/i;

function extractCapacityMw(caption: string): number | null {
  const m = CAPACITY_RE.exec(caption);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// See module header FUEL/PROJECT TYPE & CAPACITY: a bare "EACH" shortly
// after the MW figure means the caption is describing a per-unit capacity
// for a multi-unit project, so the single extracted number understates the
// real total.
function hasMultiUnitEachHint(caption: string): boolean {
  const m = CAPACITY_RE.exec(caption);
  if (!m) return false;
  const after = caption.slice(m.index, m.index + 80);
  return /\bEACH\b/i.test(after);
}

// No standalone storage-only or transmission-only CPCN case was found live
// in this population — see module header SCOPING. Kept for the same
// easy-to-add, unconfirmed-live reason other modules in this series keep
// unobserved branches.
const TRANSMISSION_RE = /\btransmission line\b|\btransmission facilit/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b|\bbess\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b|\bphotovoltaic\b/i, "solar"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(combined cycle|combustion turbine|natural gas|gas[- ]fired|ngcc)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

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

// Real Indiana county names are usually 1-2 words immediately before
// "COUNTY, INDIANA" — but since the entire source caption is ALL CAPS,
// case can't distinguish a real county name from a preceding common word
// like "IN"/"THE"/"FACILITY" the way title-cased sources elsewhere in this
// series allow; STOPWORDS strips those off the front of whatever the regex
// captures. Confirmed against real captions naming "POSEY COUNTY, INDIANA"
// and "WARRICK COUNTY, INDIANA" — most real captions in this population
// name no county at all (see module header), so this frequently returns
// null, which is expected, not a bug.
const COUNTY_RE = /((?:[A-Z][A-Z'.]*\s+){0,3}[A-Z][A-Z'.]*)\s+COUNT(?:Y|IES),\s+INDIANA\b/;
const COUNTY_STOPWORDS = new Set([
  "IN",
  "THE",
  "A",
  "AN",
  "OF",
  "TO",
  "FOR",
  "AND",
  "THAT",
  "WILL",
  "HAVE",
  "WITH",
  "FACILITY",
  "LOCATED",
]);

function extractCounty(caption: string): string | null {
  const m = COUNTY_RE.exec(caption);
  if (!m) return null;
  const words = m[1].trim().split(/\s+/);
  while (words.length > 1 && COUNTY_STOPWORDS.has(words[0])) words.shift();
  const cleaned = words.join(" ").trim();
  return cleaned.length > 0 ? toTitleCase(cleaned) : null;
}

function detailUrl(legalCaseId: string): string {
  return `${DETAIL_BASE_URL}?id=${encodeURIComponent(legalCaseId)}`;
}

// Cleanup-only record for a candidate that is resolved (Case Status
// Decided/Void/Consolidated/Archived) or that failed the genuine-new-
// application filter (see REAL GOTCHA). No expensive detail fetch is made
// for these — matchKey/currentStage are all that matter, since
// upsertNormalizedProject deletes any previously-tracked row for a
// RESOLVED_STAGE without reading the other fields. Fields are still filled
// with reasonable non-null values because NormalizedProject requires them.
function buildCleanupPlaceholder(row: SearchResultRow): NormalizedProject {
  const matchKey = resolveMatchKey("in-iurc", row.docketNumber);
  const applicant = row.parties.split(",")[0]?.trim() || "Unknown Applicant";
  return {
    matchKey,
    name: `${applicant} (IN IURC Cause No. ${row.docketNumber})`,
    projectType: "generation",
    fuelType: "other",
    state: "IN",
    currentStatus: `Indiana IURC Cause No. ${row.docketNumber}: ${row.caseStatus.toLowerCase() || "resolved"}`,
    currentStage: "completed",
    causeSlugs: ["local_state_opposition"],
    causeDetail: `Indiana IURC Cause No. ${row.docketNumber} is no longer an open Certificate of Public Convenience and Necessity application awaiting a Commission determination.`,
    commentPeriodStart: null,
    commentPeriodEnd: null,
    commentLink: null,
    sources: [{ label: `IN IURC Cause No. ${row.docketNumber}`, url: detailUrl(row.legalCaseId) }],
    externalIds: { inIurc: row.docketNumber },
  };
}

function buildActiveProject(row: SearchResultRow, caption: string, hearing: UpcomingHearing | null): NormalizedProject {
  const matchKey = resolveMatchKey("in-iurc", row.docketNumber);
  const applicant = extractApplicant(caption, row.parties.split(",")[0]?.trim() || "Unknown Applicant");
  const projectType = inferProjectType(caption);
  const fuelType = inferFuelType(caption, projectType);
  const capacityMw = extractCapacityMw(caption);
  const multiUnitHint = hasMultiUnitEachHint(caption);
  const county = extractCounty(caption);

  const currentStage: ProjectStage = LITIGATION_STATUSES.has(row.caseStatus) ? "litigation" : "local_review";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Indiana Utility Regulatory Commission's public Certificate of Public Convenience and Necessity (CPCN, Ind. Code ch. 8-1-8.5) docket search.",
    "IURC's own docket \"Case Status\" field was independently checked against each docket's filed Final Orders (via IURC's companion API) rather than trusted at face value — see the ingestion module header for how this was calibrated.",
  ];
  if (row.caseStatus === "Appealed") {
    dataQualityNoteParts.push(
      "This docket's Case Status is \"Appealed\": the Commission has already issued a Final Order, but that order is being challenged further in court, so the underlying CPCN determination is not yet fully final.",
    );
  }
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket's petition caption text, not a structured field — not independently verified.");
    if (multiUnitHint) {
      dataQualityNoteParts.push(
        "The caption describes capacity on a per-unit (\"...EACH\") basis for what appears to be a multi-unit project — the extracted figure is likely a significant undercount of total project capacity.",
      );
    }
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket's petition caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Indiana, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No Indiana county is named in the docket caption — some IURC CPCN cases approve acquisition of an already-existing (possibly out-of-state) generating facility rather than new in-state construction. No structured coordinates are published regardless, so this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (IN IURC Cause No. ${row.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "IN",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: row.petitionDate,
    dateConfidence: "exact",
    applicant,
    currentStatus: `Indiana IURC Cause No. ${row.docketNumber}: ${row.caseStatus.toLowerCase()}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Indiana Utility Regulatory Commission — Cause No. ${row.docketNumber}, "${caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    commentPeriodStart: hearing?.date ?? null,
    commentPeriodEnd: null,
    commentLink: hearing ? detailUrl(row.legalCaseId) : null,
    sources: [{ label: `IN IURC Cause No. ${row.docketNumber}`, url: detailUrl(row.legalCaseId) }],
    externalIds: { inIurc: row.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  detailFetches: number;
  realApplicationsTracked: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestInIurcDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const candidates = await searchCpcnCandidates(maxCandidates);
  const rotatingTier = new Set(candidates.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let detailFetches = 0;
  let realApplicationsTracked = 0;

  for (const row of candidates) {
    const needsDetail = ACTIVE_STATUSES.has(row.caseStatus) || LITIGATION_STATUSES.has(row.caseStatus);
    if (!needsDetail) {
      const normalized = buildCleanupPlaceholder(row);
      toUpsert.push(normalized);
      if (rotatingTier.has(row)) rotatingMatchKeys.add(normalized.matchKey);
      continue;
    }
    try {
      detailFetches += 1;
      const caption = await fetchCaption(row.legalCaseId);
      let normalized: NormalizedProject;
      if (isGenuineNewCpcnApplication(caption)) {
        // See module header HEARING SCHEDULE — a failure here shouldn't
        // block tracking the underlying application over this
        // supplementary feature.
        const hearing = await fetchUpcomingHearing(row.legalCaseId).catch(() => null);
        normalized = buildActiveProject(row, caption, hearing);
        realApplicationsTracked += 1;
      } else {
        normalized = buildCleanupPlaceholder(row);
      }
      toUpsert.push(normalized);
      if (rotatingTier.has(row)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: resolveMatchKey("in-iurc", row.docketNumber), message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: candidates.length,
    detailFetches,
    realApplicationsTracked,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestInIurcDockets()
    .then((summary) => {
      console.log(
        `Indiana IURC CPCN docket ingestion complete: ${summary.candidatesFound} candidates scanned, ` +
          `${summary.detailFetches} detail fetches, ${summary.realApplicationsTracked} real CPCN applications tracked, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
