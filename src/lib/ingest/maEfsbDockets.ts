// Massachusetts Energy Facilities Siting Board (EFSB) docket ingestion —
// one of several states built in parallel in the per-state series started
// with vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23.
//
// WHY EFSB, NOT DPU's OWN "Siting" INDUSTRY TRACK: the task brief started
// from the hint that Massachusetts's Department of Public Utilities (DPU)
// runs the public docket search, matching the WUTC-first hint that turned
// out wrong for Washington. Checked here too, per this project's "confirm
// before guessing" rule, rather than assumed either way. MA DPU's own
// e-filing system (eeaonline.eea.state.ma.us/dpu/fileroom, an Angular SPA —
// see FETCHING) tags every docket with an `Industry` taxonomy term, and two
// of its values are relevant: "Siting" (Id=6, DPU's own direct siting
// jurisdiction — mostly G.L. c.164 §72 transmission-line petitions, G.L.
// c.40A §3 zoning-exemption petitions, and eminent-domain takings) and
// "EFSB" (Id=4, the Energy Facilities Siting Board's own docket track).
// EFSB is a board that sits inside DPU administratively but issues its own
// "Certificate of Environmental Impact and Public Interest" under G.L.
// c.164 §§69J/69J¼/69K — Massachusetts's real CPCN-equivalent for large
// generation, storage, transmission, and gas-facility projects, same kind
// of "the real siting authority isn't the obvious one" situation
// waEfsecFacilities.ts documented for WA EFSEC vs. WUTC. Filtering
// IndustryId=6 (DPU-Siting) instead of 4 (EFSB) mostly returns a different,
// less relevant docket population: 175 "Zoning" and 69 "Eminent Domain"
// dockets (land-use/property matters, not project-approval certificates)
// plus 78 "Transmission Line" dockets — and confirmed by hand, nearly every
// recent one of those "Transmission Line" DPU-Siting dockets is an explicit
// companion filing to an EFSB docket already covered here (e.g. DPU 19-142
// carries "(see EFSB 19-06)" in its own description, DPU 19-15 carries
// "(see EFSB-19-03)") — ingesting both would create duplicate rows for the
// same physical project under two different matchKeys. This module
// therefore scopes to IndustryId=4 (EFSB) only. Known accepted gap, same
// shape as EFSEC's "smaller facilities go through county/city land use
// permitting, out of scope" note: a handful of standalone DPU-Siting
// "Transmission Line" petitions with no "(see EFSB ...)" companion (e.g.
// DPU 19-46) exist for lines too small to trigger EFSB jurisdiction —
// deliberately not covered here.
//
// FETCHING: eeaonline.eea.state.ma.us/dpu/fileroom is an Angular SPA (no
// server-rendered HTML at all — confirmed by hand, the root document is
// just an empty `<app-root>` loading shell). Its own bundled JS
// (main.*.js) embeds the real API base as a plain config constant:
// `https://eeaonline.eea.state.ma.us/dpu/fileroom/api`. Every endpoint used
// below was confirmed by reading that bundle's own HttpClient service
// calls, then verified with real requests — no auth, no session cookie, no
// CSRF token, no CAPTCHA, no Cloudflare challenge on any of them:
//   - GET  /industries/GetAll, /casetypes/GetAll — static taxonomy lookups
//     (confirmed Industry "EFSB"=4, CaseType "Siting/DPU"=9).
//   - POST /search/dockets/ with JSON body `{"IndustryId":4,"TypeId":9}` —
//     returns every EFSB docket tagged case-type "Siting/DPU" as a single
//     JSON array, no pagination cap observed (104 total EFSB-industry
//     dockets returned in one response; 71 of those are case-type
//     "Siting/DPU" specifically, confirmed by both a client-side filter and
//     an equivalent server-side TypeId=9 filter returning the identical
//     count).
//   - GET  /dockets/get?id=<Id> — full docket detail, including every
//     filed document's `Type` (a taxonomy term, e.g. "Initial Filing",
//     "Final Decision", "Compliance Filing") and free-text `Description`
//     (an HTML fragment, the filer's own cover-letter text — there is no
//     separate structured project-detail record here, same "regex over the
//     one free-text field the filer wrote" situation as NY DPS's docket
//     titles).
//
// SCOPING to real applications: `search/dockets/` with IndustryId=4 &
// TypeId=9 also returns non-application dockets sharing that case type —
// "Project Change" amendment requests, "Jurisdictional Determination"
// petitions (asking whether EFSB even has jurisdiction, not itself an
// application), "Notice of Inquiry" rulemakings, "Extension Request"
// procedural filings, "Petition for Rehearing/Reconsideration" — filtered
// out by EXCLUDE_RE below. Real applications use inconsistent phrasing
// across 30+ years of filings (confirmed by hand reading all 71
// descriptions) — "Petition of X ... for approval to construct", "Petition
// and Application of X for a Certificate of Environmental Impact and
// Public Interest", "X petitions, pursuant to ... seeking approval",
// "On behalf of X, attached please find its Initial Petition..." — too
// varied for a single "opener" regex to reliably match without false
// negatives (confirmed: an early strict opener-only regex missed real
// 2022–2026 applications like EFSB22-05 and efsb26-01). EXCLUDE_RE is used
// instead, on the theory that IndustryId=4 + TypeId=9 is already a tightly
// scoped docket population (this case type alone excludes every rate case,
// tariff filing, merger, etc. tracked elsewhere in DPU's Fileroom).
//
// LOOKBACK: LOOKBACK_YEARS=10 excludes dockets opened before ~2016. Not
// just a volume-control measure (the whole IndustryId=4/TypeId=9 population
// is only 71 dockets) — a correctness necessity. Confirmed by hand: EFSB
// 95-2 (opened 1995-12-21) has zero digitized Filings and a null
// ClosedDate, which would make the STATUS check below (see next section)
// wrongly conclude it's still "pending" 30 years later. Pre-digitization-era
// dockets simply don't have complete enough records for this module's
// resolution check to be trustworthy, so they're excluded by date instead
// of by (unreliable) status.
//
// STATUS — same "don't trust the obvious field" lesson as every other
// state in this series, reconfirmed here with two independently-checked
// real dockets: EFSB's own docket-level `ClosedDate` field looks like the
// obvious signal but is NOT reliably populated even for long-since-decided
// dockets. EFSB22-01 (NSTAR Electric, opened 2022-02-16) has a filed
// document of Type "Final Decision" dated 2022-11-30 — an unambiguous
// grant — yet `ClosedDate` is still null years later (the docket keeps
// receiving "Compliance Filing" documents indefinitely for post-approval
// monitoring, the most recent as of this writing dated 2026-08-06).
// Trusting `ClosedDate` alone would keep EFSB22-01 on this site forever as
// "still waiting." Conversely, `ClosedDate` IS sometimes set: EFSB21-03
// (Mayflower Wind / renamed SouthCoast Wind Energy LLC, opened
// 2021-11-17) has no "Final Decision" filing at all — instead a "Notice of
// Wit[hdrawal]" filed 2025-11-14, followed by a Presiding Officer's
// "Correspondence" filed 2025-12-04 formally "designating the proceeding
// ... as closed," and `ClosedDate` is set to that same 2025-12-04 date.
// So both signals are real but each misses cases the other catches; a
// docket is treated as RESOLVED here if EITHER `ClosedDate` is non-null OR
// any filed document has Type.Name === "Final Decision" (case-insensitive
// exact match against the small enumerated set of Type values actually
// observed — see FINAL_DECISION_TYPE below). One further near-miss caught
// by hand: EFSB22-06 (Commonwealth Wind)'s most recent filing (2024-03-06)
// is titled "Notice of Withdrawal of Counsel Cloe Pippin" — an attorney
// withdrawing from the case, NOT a project withdrawal. A loose
// `/withdraw/i` match against filing titles would have wrongly resolved
// this docket; no such loose match is used here. As of 2026-08-23
// EFSB22-06 has had no filing since that attorney-withdrawal notice (over
// two years stale — real-world context: Commonwealth Wind's PPA was
// reportedly terminated around then) and no `ClosedDate` and no "Final
// Decision" filing either, so per EFSB's own record it is still,
// technically, an open proceeding — kept as a live "still waiting"
// candidate rather than guessed closed on staleness alone, consistent with
// this project's "verify, don't infer" rule. Flagged in its
// dataQualityNote so a reader can judge for themselves.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields — parsed from the
// docket's own free-text Description, same regex-over-prose approach as
// nyDpsDockets.ts, with the same real gotchas: (1) `/\bwind\b/i` alone
// would false-positive on company names like "Cape Wind Associates, LLC"
// even for a docket whose description never actually says "wind" as a
// project descriptor — not exercised by any live candidate here (Cape
// Wind's own docket, EFSB07-8, is far outside the 10-year lookback window)
// but noted for future maintainers. (2) efsb26-01 (Moraga Storage LLC)'s
// own docket Description is pure filing-cover-letter boilerplate ("attached
// please find its Initial Petition and Application for a Certificate...")
// with no technical project detail at all — no fuel/technology keyword
// anywhere in it, confirmed by reading every one of its 6 filed documents'
// descriptions too (information requests, a determination letter, a town's
// opposition comment — none describe the technology). inferProjectType
// falls back to checking the extracted applicant name for "Storage" when
// the description itself gives no signal, which correctly classifies this
// one real case; flagged in dataQualityNote whenever that fallback fires,
// since a company being named "___ Storage LLC" is a strong but unverified
// proxy, not a confirmed technical fact.
//
// LOCATION: no structured field; extracted from "Town of X" / "City of X"
// phrases in the docket description, falling back to the same phrase
// pattern scanned across all filed documents' own descriptions (cheap —
// full Filings data is already fetched for the STATUS check above, no
// extra request) since some filings (e.g. a host municipality's own
// opposition comment) name the town when the top-level docket description
// doesn't. Recorded in the `county` field despite being a town/city name,
// not a county — Massachusetts's county governments are almost entirely
// defunct, so "town" is the real local unit here, same kind of field-reuse
// WA's module did storing multiple counties in one string; flagged in
// dataQualityNote.
//
// Wired to Vercel Cron weekly, 00:30 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-ma-efsb/route.ts). A real run against the live
// site (71 candidates before lookback/exclude filtering, 24 after) was
// timed at under 20 seconds end to end — comfortably inside the 300s cron
// budget, no MAX_CANDIDATES trimming needed for timing (MAX_CANDIDATES is
// set well above the current real candidate count purely as a sanity
// ceiling, same rationale as waEfsecFacilities.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://eeaonline.eea.state.ma.us/dpu/fileroom/api";
const APP_BASE_URL = "https://eeaonline.eea.state.ma.us/dpu/fileroom";

const EFSB_INDUSTRY_ID = 4;
const SITING_DPU_TYPE_ID = 9;

// Comfortably above the current ~15-20 real live candidates — see module
// header timing note. The whole IndustryId=4/TypeId=9 population is only
// ~71 dockets all-time, so there's no realistic scenario of this cap
// silently dropping a genuinely-still-open one.
export const MAX_CANDIDATES = 50;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
// See module header LOOKBACK rationale: pre-~2016 dockets have unreliably
// sparse digitized Filings records, not just lower relevance.
const LOOKBACK_YEARS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`MA EFSB request failed (${res.status}): ${url}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `MA EFSB response for ${url} wasn't valid JSON — the Fileroom API shape likely changed. Check src/lib/ingest/maEfsbDockets.ts against a fresh response.`,
    );
  }
}

function stripHtml(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Strips a single leading parenthetical ("(consolidated with D.P.U. ...)")
// or bold-markdown marker ("**PROJECT CHANGE**") so applicant/opener
// regexes below can match starting from the real first sentence — confirmed
// necessary by hand against real descriptions (both prefixes appear on live
// dockets, e.g. EFSB22-06 and EFSB19-06A respectively).
function stripLeadingAnnotation(desc: string): string {
  return desc.replace(/^\([^)]*\)\s*/, "").replace(/^\*\*[^*]*\*\*\s*/, "");
}

interface DocketTaxonomyTerm {
  Id: number;
  Name: string;
}

interface DocketSearchResult {
  Id: number;
  Number: string;
  Description: string | null;
  OpenedDate: string | null;
  ClosedDate: string | null;
  Type: DocketTaxonomyTerm | null;
  Industry: DocketTaxonomyTerm | null;
  Petitioner: { Name: string | null } | null;
}

async function searchEfsbDockets(): Promise<DocketSearchResult[]> {
  const results = await fetchJson<DocketSearchResult[]>(`${BASE_URL}/search/dockets/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IndustryId: EFSB_INDUSTRY_ID, TypeId: SITING_DPU_TYPE_ID }),
  });
  if (!Array.isArray(results)) {
    throw new Error(
      "MA EFSB /search/dockets/ response wasn't a JSON array — the Fileroom API shape likely changed. Check searchEfsbDockets in src/lib/ingest/maEfsbDockets.ts.",
    );
  }
  return results;
}

// Real non-application dockets confirmed sharing IndustryId=4/TypeId=9 with
// real applications — see module header SCOPING. Matched against the
// stripped description text, not anchored to the start, since these
// phrases appear at varying positions across real descriptions.
const EXCLUDE_RE =
  /\bproject change\b|\bjurisdictional determination\b|\bnotice of inquiry\b|\bextension request\b|\binformal resolution agreement\b|\bmotion to dismiss\b|\brequest for (?:a )?waiver\b|\bpetition for (?:rehearing|reconsideration)\b/i;

interface DocketFiling {
  FiledDate: string | null;
  Type: DocketTaxonomyTerm | null;
  Description: string | null;
}

interface DocketDetail {
  Id: number;
  ClosedDate: string | null;
  Filings: DocketFiling[];
}

async function fetchDocketDetail(id: number): Promise<DocketDetail> {
  return fetchJson<DocketDetail>(`${BASE_URL}/dockets/get?id=${id}`);
}

// See module header STATUS for how both signals were independently
// confirmed against real dockets (EFSB22-01 for the Final-Decision path,
// EFSB21-03 for the ClosedDate path).
const FINAL_DECISION_TYPE = "final decision";

function isResolved(detail: DocketDetail): boolean {
  if (detail.ClosedDate) return true;
  return detail.Filings.some((f) => f.Type?.Name?.trim().toLowerCase() === FINAL_DECISION_TYPE);
}

const TRANSMISSION_RE = /transmission (?:line|facilit)|(?:^|[^0-9])\d[\d,]*[\s-]*kv\b/i;
const LNG_RE = /liquefaction|\bLNG\b|liquefied natural gas/i;
const PIPELINE_RE = /gas pipeline|distribution main|point of delivery|meter station|regulator station/i;
const STORAGE_RE = /battery energy storage|energy storage system/i;
const WIND_OFFSHORE_RE = /offshore wind/i;
const WIND_RE = /\bwind\b/i;
const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const GAS_RE = /combined[- ]cycle|simple[- ]cycle|natural gas[- ]fired|dual-fuel|gas-fired/i;

// See module header FUEL/PROJECT TYPE & CAPACITY for the Moraga Storage
// (efsb26-01) case this applicant-name fallback exists for.
function inferProjectType(desc: string, applicant: string): ProjectType {
  if (TRANSMISSION_RE.test(desc)) return "transmission";
  if (LNG_RE.test(desc)) return "lng";
  if (PIPELINE_RE.test(desc)) return "pipeline";
  if (STORAGE_RE.test(desc)) return "storage";
  if (/\bstorage\b/i.test(applicant)) return "storage";
  return "generation";
}

function inferFuelType(desc: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "lng") return "lng";
  if (projectType === "pipeline") return "pipeline";
  if (projectType === "storage") return "storage";
  if (WIND_OFFSHORE_RE.test(desc)) return "wind_offshore";
  if (WIND_RE.test(desc)) return "wind_onshore";
  if (SOLAR_RE.test(desc)) return "solar";
  if (GAS_RE.test(desc)) return "gas";
  return "other";
}

function extractCapacityMw(desc: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)[\s-]*(?:MW|[Mm]egawatts?)\b/.exec(desc);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

const TOWN_RE = /\b(?:Towns?|Cit(?:y|ies))\s+of\s+([A-Z][A-Za-z]+(?:,?\s+and\s+[A-Z][A-Za-z]+)*)/g;

function extractTowns(text: string): string | null {
  const matches = [...text.matchAll(TOWN_RE)].map((m) => m[1].trim());
  if (matches.length === 0) return null;
  return [...new Set(matches)].join("; ");
}

// Real applicant-naming patterns confirmed across live descriptions — see
// module header SCOPING for why phrasing varies this much across 30+ years
// of filings. Tried in order from most to least specific.
const PETITION_OF_RE = /petition(?:\s+and\s+application)?\s+of\s+(.+?)\s+(?:for|pursuant)\b/i;
const ON_BEHALF_OF_RE = /^on behalf of (.+?),/i;
const SUBJECT_VERB_RE = /^(.+?)\s+(?:petitions|files? a petition|filed[^,]*a petition)/i;

function extractApplicant(desc: string): string {
  let m = PETITION_OF_RE.exec(desc);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = ON_BEHALF_OF_RE.exec(desc);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = SUBJECT_VERB_RE.exec(desc);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  return desc.slice(0, 80);
}

function normalizeDocket(search: DocketSearchResult, detail: DocketDetail): NormalizedProject {
  const sourceId = String(search.Id);
  const matchKey = resolveMatchKey("ma-efsb", sourceId);

  const rawDesc = stripHtml(search.Description);
  const desc = stripLeadingAnnotation(rawDesc);
  const applicant = extractApplicant(desc) || (search.Petitioner?.Name ?? search.Number);

  const usedApplicantStorageFallback =
    !STORAGE_RE.test(desc) && !TRANSMISSION_RE.test(desc) && !LNG_RE.test(desc) && !PIPELINE_RE.test(desc) && /\bstorage\b/i.test(applicant);
  const projectType = inferProjectType(desc, applicant);
  const fuelType = inferFuelType(desc, projectType);
  const capacityMw = extractCapacityMw(desc);

  const filingsText = detail.Filings.map((f) => stripHtml(f.Description)).join(" ");
  const town = extractTowns(desc) ?? extractTowns(filingsText);

  const filedDate = search.OpenedDate ? new Date(search.OpenedDate) : null;

  const currentStage: ProjectStage = "local_review";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Massachusetts Energy Facilities Siting Board (EFSB)'s public docket records in the DPU e-Filing (\"Fileroom\") system, not the Department of Public Utilities' own separate \"Siting\" industry docket track — EFSB is the board that actually issues Massachusetts's Certificate of Environmental Impact and Public Interest (the state's real CPCN equivalent for large energy facilities); DPU's own Siting-industry dockets are overwhelmingly zoning-exemption and eminent-domain matters plus companion filings to an EFSB docket already tracked here. See the ingestion module header for the full comparison.",
    "This system's own docket-level \"Closed Date\" field is not reliably populated even for long-since-decided dockets (confirmed against a real granted certificate, EFSB22-01, whose Closed Date is still null years after a \"Final Decision\" document was filed) — \"still waiting\" here is instead determined by scanning every filed document's own type for a \"Final Decision\" filing, or a populated Closed Date, whichever is present. See the ingestion module header for how this was verified against two independent real dockets.",
    "Fuel/technology and capacity are parsed from the applicant's own free-text filing description (the only project-detail text this source publishes in structured form), not a structured field — not independently verified against the underlying application documents.",
  ];
  if (usedApplicantStorageFallback) {
    dataQualityNoteParts.push(
      'This docket\'s own filing description contains no technical project detail at all (a generic cover-letter only) — storage classification here is inferred solely from "Storage" appearing in the applicant\'s own company name, not confirmed against the actual application.',
    );
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket's filing description text.");
  }
  if (town) {
    dataQualityNoteParts.push(`Located in the Town/City of ${town}, Massachusetts, per the docket's own filing text — this is a municipality name, not a county (Massachusetts county government is almost entirely defunct); no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (MA EFSB ${search.Number})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "MA",
    county: town,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `MA EFSB Docket ${search.Number}: pending before the Energy Facilities Siting Board`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Environmental Impact and Public Interest (or related siting approval) from the Massachusetts Energy Facilities Siting Board — Docket ${search.Number}, "${desc.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `MA EFSB Docket ${search.Number}`,
        url: `${APP_BASE_URL}/#/dockets/docket/${search.Id}`,
      },
    ],
    externalIds: { maEfsb: sourceId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestMaEfsbDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allDockets = await searchEfsbDockets();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const realApplications = selectWithRotation(
    allDockets
      .filter((d) => d.Type?.Name === "Siting/DPU")
      .filter((d) => d.OpenedDate != null && new Date(d.OpenedDate) >= cutoff)
      .filter((d) => !EXCLUDE_RE.test(stripHtml(d.Description)))
      .sort((a, b) => new Date(b.OpenedDate ?? 0).getTime() - new Date(a.OpenedDate ?? 0).getTime()),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );

  const rotatingTier = new Set(realApplications.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let removedResolvedFromStatusCheck = 0;

  for (const candidate of realApplications) {
    try {
      const detail = await fetchDocketDetail(candidate.Id);
      if (isResolved(detail)) {
        removedResolvedFromStatusCheck++;
      } else {
        const normalized = normalizeDocket(candidate, detail);
        toUpsert.push(normalized);
        if (rotatingTier.has(candidate)) rotatingMatchKeys.add(normalized.matchKey);
      }
    } catch (err) {
      errors.push({ matchKey: candidate.Number, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = realApplications.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allDockets.length,
    realApplicationCandidates: realApplications.length,
    upserted,
    // Includes both docket-status-check exclusions (a resolved docket is
    // never even built into a NormalizedProject) and any that were built
    // but caught by upsertNormalizedProject's own RESOLVED_STAGES check —
    // in practice the former (currentStage is always "local_review" here,
    // so the latter should never fire, but both are counted for an honest
    // total).
    removedResolved: removedResolvedFromStatusCheck + removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestMaEfsbDockets()
    .then((summary) => {
      console.log(
        `Massachusetts EFSB docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.realApplicationCandidates} real siting applications within lookback, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
