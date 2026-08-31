// New York Department of Public Service (DPS) docket ingestion — one of
// several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23.
//
// SCOPING — two real, currently-active siting-certificate tracks, both
// live in the SAME underlying system (see FETCHING below), so this one
// module covers both rather than needing a separate ny-ores module:
//   1. Article VII of the Public Service Law — major electric transmission
//      (and gas transmission) facility siting, run by the PSC. Structured
//      MatterSubType "Certificate of Environmental Compatibility and
//      Public Need" ("CECPCN"), NY's own name for what other states in
//      this series call a CPCN. Case numbers use the format YY-T-NNNN
//      ("T" observed on every real Article VII CECPCN docket checked,
//      e.g. 25-T-0245, 18-T-0487 — empirically confirmed against dozens of
//      real dockets, not from documentation).
//   2. Generation/renewable siting has changed regimes twice and DPS's own
//      MatterSubType field tracks that history rather than normalizing it:
//      pre-2020 "Article 10" cases used case letter "F" and are no longer
//      being newly filed (confirmed: the CECPCN search below returns zero
//      new "F" dockets after 2020); 2021–~2022 filings under the old
//      Executive Law § 94-c process kept MatterSubType "94-c Permit"
//      (case numbers are plain YY-NNNNN, no letter); a large number of
//      2022-onward filings — including several originally filed *under*
//      94-c — carry MatterSubType "Article VIII Permit" instead, because
//      the 2024 RAPID Act repealed § 94-c and replaced it with PSL Article
//      VIII ("Siting of Renewable Energy and Electric Transmission"), and
//      DPS retroactively relabeled most (not all — the boundary is
//      inconsistent, confirmed by hand) pre-2024 dockets to the new
//      subtype. This module queries both "94-c Permit" and "Article VIII
//      Permit" to get full coverage regardless of which side of that
//      relabeling a given docket landed on.
//
// FETCHING: documents.dps.ny.gov is NYS DPS's public "Document and Matter
// Management" (DMM) system, an ASP.NET WebForms site. The human-facing
// Advanced Search (public/Common/AdvanceSearch.aspx) is a full WebForms
// postback form (__VIEWSTATE/__EVENTVALIDATION), but submitting a search
// redirects to public/Common/SearchResults.aspx?MC=1&IA=&MT=&MST=&CN=&MCT=
// <title keyword>&C=&M=&CO=0, and *that* page's results grid is itself
// populated by a plain client-side GET to a real, unauthenticated JSON API:
//   GET /CaseMaster/MatterExternal/<anything>?MC=1&IA=&MT=&MST=&CN=
//       &MCT=<url-encoded keyword>&C=&M=&CO=0
// The leading path segment after MatterExternal/ (a hardcoded "17-02256" in
// the page's own JS, left over from that script being shared with the
// single-matter CaseMaster view) is ignored server-side — confirmed by
// hand with garbage text and with the segment entirely empty, both return
// identical results to the real search. No auth, no session cookie, no
// CSRF token, no pagination cap observed (a 273-result search returned all
// 273 in one response, `TotalRecords` matching `data.length` exactly).
// This module searches MCT="certificate of environmental compatibility"
// for track 1 and MCT="renewable energy" for track 2, then filters the
// (title-text-matched, not exact) results locally to an exact
// `MatterSubType` field match — same "broad server search, precise local
// filter" pattern as scPscDockets.ts/txPuctDockets.ts, except here the
// local filter is on a real structured field instead of a caption regex.
// Each search result's `MatterID` is also the "MatterSeq" used everywhere
// else in the system (confirmed identical to the id embedded in its own
// `CaseOrMatterNumber` HTML fragment) — no separate detail fetch needed to
// resolve an id.
// Detail/status: GET /CaseMaster/PublicDocuments/<MatterID> (same pattern
// as the case-detail page's own PublicDocument grid, which loads via this
// identical endpoint) returns every publicly filed document for that
// docket as JSON, each with a `Doctype` and an HTML-wrapped `DocTitle`.
//
// STATUS — same lesson as every prior state in this series, independently
// reconfirmed here: NY DPS's CaseMaster detail page (public/MatterManagement
// /CaseMaster.aspx) doesn't even surface a "Status" field to be wrong about
// — there's Matter Type/Subtype/Industry but nothing resembling open/closed.
// The real signal, confirmed against real dockets:
//   - Track 1 (CECPCN): a resolved docket has a document with
//     Doctype="Orders" whose title contains "granting" within ~60 chars of
//     "certificate" — e.g. 06-T-1040's "Order Adopting the Terms of a
//     Joint Proposal with Exceptions and Modifications and Granting
//     Certificate of Environmental Compatibility and Public Need" (filed
//     2006, confirmed granted) vs. 25-T-0245 (Vineyard Northeast offshore
//     transmission, filed 4/16/2025), whose only Orders-doctype document
//     is "Order on Waiver Requests" — no grant signal, correctly still
//     active. GRANT_RE requires "certificate" (not just "permit") nearby
//     for this track since every real granted-CECPCN order observed says
//     "Certificate," never "Permit."
//   - Track 2 (Article VIII/94-c): DPS does NOT file the final
//     determination under Doctype="Orders" for this track at all — of
//     Alfred Oaks Solar's 297 filed documents (22-F-0968-equivalent,
//     granted 2024), zero have Doctype "Orders" or "Decisions." The actual
//     grant is filed under Doctype="Correspondence" with a title/filename
//     of "2024.09.10_Alfred_Oaks_Solar_-_Final_Siting_Permit_-_Signed" —
//     found only by scanning every document's title regardless of
//     Doctype, not just an Orders bucket. Because real titles here use
//     underscores/hyphens as word separators instead of spaces, all
//     detection regexes below run against a normalized (separators →
//     spaces) copy of the title, not the raw string.
//   - DENY_RE exists for both tracks but is under-confirmed: a real
//     73-docket sample of Track 1 CECPCN dockets turned up exactly zero
//     denied siting certificates, but two *procedural* denials that would
//     have been false positives on a loose "denying" match — 18-T-0604's
//     "Order Denying Petitions for Rehearing" and 19-T-0549's "Order
//     Denying Interlocutory Appeal," neither of which denies the
//     certificate itself. DENY_RE requires "certificate"/"permit" within a
//     tight ~30-char window of "den(y/ial/ying)" for exactly this reason
//     (same tight-window lesson as scPscDockets.ts's GRANT_RE). No real
//     denial was available to confirm DENY_RE positively fires on one —
//     same caveat azAccLineSiting.ts documented for its own DENY_RE.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields, but both tracks'
// titles are unusually descriptive and consistent (DPS's own template
// language: "...to Construct and Operate a 100 MW Major Renewable Energy
// Facility in the Towns of X and Y, Z County" / "...100-Megawatt (MW)
// Solar Energy Facility Located in the Town of X, Y County"), so
// keyword/regex extraction is reliable, same approach as every other
// state in this series. One deliberate deviation from the SC/AZ pattern:
// several real NY Track 2 titles describe a hybrid project ("200 MW
// PV/100 MW BESS", "125-Megawatt (MW) Solar Energy Facility, Including a
// 20-Megawatt (MW) Battery Energy Storage Facility") where a naive
// "check storage keyword before generation keywords" order (as SC/AZ do)
// would misclassify an obviously-primarily-solar project as pure
// "storage." inferProjectType here instead only classifies as "storage"
// when NO solar/wind/gas/etc. keyword is also present in the same title —
// i.e. genuinely storage-only projects still classify correctly, but a
// paired-battery generation project keeps its generation type.
//
// Wired to Vercel Cron weekly, 23:00 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-ny-dps/route.ts) — a real run's timing was
// measured (130.6s with MAX_CANDIDATES=60, see above) before scheduling
// this. Also politeness-delayed between per-candidate detail requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://documents.dps.ny.gov/public";

// Confirmed 2026-08-23: a full 100-candidate run against the live site took
// 236s (real per-candidate detail-fetch latency here runs noticeably slower
// than the other states in this series, not just REQUEST_DELAY_MS) — too
// close to the 300s cron maxDuration budget for comfort on a slow day.
// Capped lower instead of trimming REQUEST_DELAY_MS (kept at this series'
// standard politeness delay).
export const MAX_CANDIDATES = 60;

// Revised 2026-08-27 — see selectWithRotation in common.ts: NY DPS's real
// population (99 as of this date) already exceeds MAX_CANDIDATES, so a
// plain top-60-by-recency slice would freeze the ~39 oldest still-active
// dockets forever (confirmed live — see markVanished's wasCapped doc for
// the false-vanish incident this same growth caused). The newest
// ROTATING_RECENT_SLOTS are fetched every run; the rest of the budget
// rotates through the backlog a slice at a time, cycling fully in roughly
// (real population − ROTATING_RECENT_SLOTS) ÷ (MAX_CANDIDATES −
// ROTATING_RECENT_SLOTS) days — at today's population, about 3 days.
const ROTATING_RECENT_SLOTS = 40;
const REQUEST_DELAY_MS = 250;
const LOOKBACK_YEARS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as scPscDockets.ts, not a full HTML-entity library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

interface MatterSearchResult {
  matterId: number;
  caseOrMatterNumber: string;
  matterSubType: string;
  matterTitle: string;
  startDate: Date | null;
}

// .NET JSON date format, e.g. "/Date(1782913975000)/". A handful of
// documents (never matter-level StartDate, in every case observed) use a
// "/Date(-62135578800000)/" sentinel — .NET's DateTime.MinValue (year 1)
// serialized — meaning "no real date," not an actual 1st-century filing.
function parseDotNetDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /\/Date\((-?\d+)\)\//.exec(raw);
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (d.getUTCFullYear() < 1900) return null;
  return d;
}

function parseMDY(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function searchMatters(titleKeyword: string): Promise<MatterSearchResult[]> {
  const url =
    `${BASE_URL}/CaseMaster/MatterExternal/?MC=1&IA=&MT=&MST=&CN=` +
    `&MCT=${encodeURIComponent(titleKeyword)}&C=&M=&CO=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NY DPS search request failed (${res.status}) for keyword "${titleKeyword}"`);
  const text = await res.text();
  if (text.trim().length === 0) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      `NY DPS search response for keyword "${titleKeyword}" wasn't valid JSON — the endpoint shape likely changed. Check searchMatters in src/lib/ingest/nyDpsDockets.ts against a fresh response.`,
    );
  }
  if (!Array.isArray(raw)) {
    throw new Error(
      `NY DPS search response for keyword "${titleKeyword}" wasn't a JSON array — the endpoint shape likely changed. Check searchMatters in src/lib/ingest/nyDpsDockets.ts against a fresh response.`,
    );
  }
  return (raw as Record<string, unknown>[]).map((r) => {
    const caseOrMatterNumberHtml = String(r.CaseOrMatterNumber ?? "");
    return {
      matterId: Number(r.MatterID),
      caseOrMatterNumber: stripTags(caseOrMatterNumberHtml),
      matterSubType: String(r.MatterSubType ?? ""),
      matterTitle: decodeHtmlEntities(String(r.MatterTitle ?? "")),
      startDate: parseDotNetDate(r.StartDate as string | undefined) ?? parseMDY(r.strSubmitDate as string | undefined),
    };
  });
}

// Track 1: legacy/current Article VII electric (and gas) transmission
// siting. Track 2: current Article VIII renewable siting plus its
// immediate predecessor, Executive Law § 94-c (both still returned by DPS
// under different MatterSubType values — see module header SCOPING).
const CECPCN_SUBTYPE = "Certificate of Environmental Compatibility and Public Need";
const ARTICLE_VIII_SUBTYPES = new Set(["Article VIII Permit", "94-c Permit"]);

// A real siting-certificate/permit *application* always opens "Application
// of/by ...", "Petition of/by ...", "Joint Application/Petition ...", or
// (Track 2's mandatory pre-filing step) "Notice of Intent to File an
// Application of ...". Confirmed 2026-08-23 against real batches: this
// correctly excludes petitions to AMEND or TRANSFER an already-granted
// certificate (which share the same MatterSubType but aren't a project
// newly waiting on approval) and one stray declaratory-ruling matter that
// happened to title-match the search keyword.
const OPENER_RE = /^(?:the\s+)?(?:part\s+a\s+)?(?:joint\s+)?(?:application|petition|notice\s+of\s+intent)\b/i;
const EXCLUDE_RE = /\bfor\s+an?\s+amendment\b|\btransfer\s+of\s+an?\s+certificate\b|\bapproval\s+of\s+the\s+transfer\b/i;

interface DocketDetail {
  resolution: "granted" | "denied" | null;
}

// See module header STATUS. Runs against every filed document's title
// regardless of Doctype (Track 2's grant isn't filed as an Order/Decision
// at all), after normalizing underscore/hyphen separators to spaces since
// Track 2 filenames commonly use those instead of spaces (e.g.
// "Final_Siting_Permit_-_Signed").
const GRANT_RE = /\bgranting\b[\s\S]{0,60}\bcertificate\b|\bfinal\b[\s\S]{0,30}\bsiting permit\b/i;
const DENY_RE = /\bden(?:y|ial|ying)\b[\s\S]{0,30}\b(?:certificate|permit)\b/i;

function normalizeSeparators(s: string): string {
  return s.replace(/[_-]+/g, " ");
}

async function fetchDetail(matterId: number): Promise<DocketDetail> {
  const res = await fetch(`${BASE_URL}/CaseMaster/PublicDocuments/${matterId}`);
  if (!res.ok) throw new Error(`NY DPS detail request failed (${res.status}) for matter ${matterId}`);
  const text = await res.text();
  if (text.trim().length === 0) return { resolution: null };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      `NY DPS detail response for matter ${matterId} wasn't valid JSON — the endpoint shape likely changed. Check fetchDetail in src/lib/ingest/nyDpsDockets.ts against a fresh response.`,
    );
  }
  if (!Array.isArray(raw)) {
    throw new Error(
      `NY DPS detail response for matter ${matterId} wasn't a JSON array — the endpoint shape likely changed. Check fetchDetail in src/lib/ingest/nyDpsDockets.ts against a fresh response.`,
    );
  }
  const titles = (raw as Record<string, unknown>[]).map((d) => normalizeSeparators(stripTags(String(d.DocTitle ?? ""))));

  let resolution: DocketDetail["resolution"] = null;
  for (const title of titles) {
    if (GRANT_RE.test(title)) {
      resolution = "granted";
      break;
    }
    if (DENY_RE.test(title)) {
      resolution = "denied";
      break;
    }
  }
  return { resolution };
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b|\bpv\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(combined cycle|combustion turbine|natural gas|gas[- ]fired)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

const TRANSMISSION_RE = /\btransmission\b|\bkv\s+(?:double-circuit\s+)?(?:line|facilit)/i;
const STORAGE_RE = /\bbattery energy storage\b|\bbess\b|\benergy storage facility\b/i;

// See module header FUEL/PROJECT TYPE & CAPACITY for why storage is only
// inferred when no generation fuel keyword is also present.
function inferProjectType(title: string): ProjectType {
  if (TRANSMISSION_RE.test(title)) return "transmission";
  const hasGenerationFuel = FUEL_KEYWORDS.some(([re]) => re.test(title));
  if (!hasGenerationFuel && STORAGE_RE.test(title)) return "storage";
  return "generation";
}

function inferFuelType(title: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(title)) return fuel;
  }
  if (projectType === "storage") return "storage";
  return "other";
}

// Pulls the applicant/petitioner name out of the docket title for a
// cleaner project name (same intent as scPscDockets.ts's
// extractApplicant), rather than truncating the full statutory-citation
// title. Confirmed against real titles from both tracks, including their
// odd corners: "Permit Application of X ..." (Track 2's own phrasing
// variant), "Notice of Intent to File an Application of X ...", and
// "Joint Application for a Certificate ... Filed by X" (name comes after
// "Filed by," not after "of"/"by").
const APPLICANT_RE =
  /^(?:notice\s+of\s+intent\s+to\s+file\s+an\s+)?(?:the\s+)?(?:part\s+a\s+)?(?:joint\s+)?(?:permit\s+)?(?:application|petition)\s+(?:of|by)\s+(?:the\s+)?(.+?)\s+for\s+an?\s+/i;
const FILED_BY_RE = /\bfiled\s+by\s+(.+?)(?:[,.]|$)/i;

function extractApplicant(title: string): string {
  const m = APPLICANT_RE.exec(title);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  const m2 = FILED_BY_RE.exec(title);
  if (m2) return m2[1].trim().replace(/[,.]+$/, "");
  return title.slice(0, 80);
}

function extractCapacityMw(title: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)[\s-]*(?:MW|Megawatt)(?:ac|dc)?\b/i.exec(title);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Titles often name more than one county (a project spanning towns in two
// counties); every match is kept rather than only the first, joined for
// display, since picking just one would silently under-report location.
function extractCounties(title: string): string | null {
  const matches = [...title.matchAll(/([A-Z][A-Za-z.']+(?:\s+[A-Z][A-Za-z.']+)*)\s+County\b/g)];
  if (matches.length === 0) return null;
  const names = [...new Set(matches.map((m) => m[1].trim()))];
  return names.join(", ");
}

function normalizeMatter(search: MatterSearchResult, detail: DocketDetail, track: "article7" | "article8"): NormalizedProject {
  const matchKey = resolveMatchKey("ny-dps", search.caseOrMatterNumber);
  const projectType = inferProjectType(search.matterTitle);
  const fuelType = inferFuelType(search.matterTitle, projectType);
  const capacityMw = extractCapacityMw(search.matterTitle);
  const counties = extractCounties(search.matterTitle);
  const applicant = extractApplicant(search.matterTitle);

  let currentStage: ProjectStage;
  if (detail.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (detail.resolution === "denied") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const trackLabel =
    track === "article7"
      ? "Article VII of the New York Public Service Law (major transmission facility siting)"
      : "Article VIII of the New York Public Service Law / its predecessor Executive Law § 94-c (major renewable energy facility siting)";

  const dataQualityNoteParts: string[] = [
    `Sourced from the New York Department of Public Service's public Document and Matter Management system, ${trackLabel}.`,
    "This system does not publish a case/matter \"Status\" field at all; \"still waiting\" here is inferred from scanning every publicly filed document's title for a granting/denying determination — see the ingestion module header for how this was calibrated, including a track-specific gotcha (renewable-siting grants are filed as plain correspondence, not as an Order or Decision document type).",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket title text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket title text.");
  }
  if (counties) {
    dataQualityNoteParts.push(`Located in ${counties} County, New York, per the docket title — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (NY DPS Case ${search.caseOrMatterNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "NY",
    county: counties,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: search.startDate,
    dateConfidence: "exact",
    applicant,
    currentStatus: `New York DPS Case ${search.caseOrMatterNumber}: ${detail.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a determination from the New York Department of Public Service under ${trackLabel} — Case No. ${search.caseOrMatterNumber}, "${search.matterTitle}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `NY DPS Case No. ${search.caseOrMatterNumber}`,
        url: `${BASE_URL}/MatterManagement/CaseMaster.aspx?MatterSeq=${search.matterId}&MNO=${encodeURIComponent(search.caseOrMatterNumber)}`,
      },
    ],
    externalIds: { nyDps: search.caseOrMatterNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

interface TrackedCandidate {
  search: MatterSearchResult;
  track: "article7" | "article8";
}

export async function ingestNyDpsDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const [cecpcnResults, renewableResults] = await Promise.all([
    searchMatters("certificate of environmental compatibility"),
    searchMatters("renewable energy"),
  ]);

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const track1: TrackedCandidate[] = cecpcnResults
    .filter((r) => r.matterSubType === CECPCN_SUBTYPE)
    .map((search) => ({ search, track: "article7" as const }));
  const track2: TrackedCandidate[] = renewableResults
    .filter((r) => ARTICLE_VIII_SUBTYPES.has(r.matterSubType))
    .map((search) => ({ search, track: "article8" as const }));

  const allCandidates = [...track1, ...track2];

  const seen = new Set<number>();
  const realCandidatesSortedByRecency = allCandidates
    .filter((c) => {
      if (seen.has(c.search.matterId)) return false;
      seen.add(c.search.matterId);
      return true;
    })
    .filter((c) => OPENER_RE.test(c.search.matterTitle) && !EXCLUDE_RE.test(c.search.matterTitle))
    .filter((c) => c.search.startDate == null || c.search.startDate >= cutoff)
    .sort((a, b) => (b.search.startDate?.getTime() ?? 0) - (a.search.startDate?.getTime() ?? 0));

  const realApplications = selectWithRotation(realCandidatesSortedByRecency, maxCandidates, ROTATING_RECENT_SLOTS);
  const rotatingTier = new Set(realApplications.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of realApplications) {
    try {
      const detail = await fetchDetail(candidate.search.matterId);
      const normalized = normalizeMatter(candidate.search, detail, candidate.track);
      toUpsert.push(normalized);
      if (rotatingTier.has(candidate)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: candidate.search.caseOrMatterNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See ROTATING_RECENT_SLOTS above and the `wasCapped` doc on
  // markVanished in common.ts: even with rotation, any single run's
  // candidates can still be a subset of the source's full active list, so
  // vanished-detection must be skipped on a run where that happened,
  // rather than wrongly flagging dockets outside today's rotation window
  // as no longer reported.
  const wasCapped = realApplications.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allCandidates.length,
    realApplicationCandidates: realApplications.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestNyDpsDockets()
    .then((summary) => {
      console.log(
        `New York DPS docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.realApplicationCandidates} real siting applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
