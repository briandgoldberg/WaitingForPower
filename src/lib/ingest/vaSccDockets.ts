// Virginia State Corporation Commission (SCC) docket ingestion — the first
// of what's meant to become a per-state series covering the gap this site's
// other five sources can't: state-level Certificate of Public Convenience
// and Necessity (CPCN) proceedings, which for many generation/storage
// projects are the actual bottleneck, not anything federal or ISO-level.
// Today those projects (if tracked at all) fall into the vague
// "local_state_opposition" cause with no real docket, date, or procedural
// detail — this gives that category its first real data.
//
// FETCHING: scc.virginia.gov's public docket-search tool
// (scc.virginia.gov/docketsearch) is a Durandal/Knockout single-page app,
// but confirmed 2026-08-23 that it's backed by a plain, unauthenticated
// Breeze/OData JSON API at scc.virginia.gov/docketsearchapi/breeze/ — no
// headless browser needed, same "fetch and parse" shape as this project's
// other sources. Found by reading the SPA's own (unminified) JS source
// rather than guessing:
//   - Search: {Host}/CASES_ESTABDATE/GetCasesEstDate — OData $filter/$select/
//     $orderby/$top all work. See src/lib/ingest/README.md for the exact
//     search-source discovery trail.
//   - Activities (per case): {Host}/CaseDetails/GetActivities returns a
//     Hearing_Time/Location/Web_Cast field alongside each activity —
//     confirmed live 2026-09-05 real and populated (not just present in
//     the schema) on several past "Hearing"/"Hearing Continued" entries
//     (e.g. Case PUR-2021-00085: "10:00 AM" at "SCC 2nd Floor Court
//     Room"), null on every non-hearing activity type. Used to surface
//     the next still-upcoming hearing as commentPeriodStart/commentLink —
//     see findNextHearing below.
//   - Detail (per case, via MATTER_NO): {Host}/CaseDetails/GetDetail,
//     GetActivities, GetParticipants, GetDocuments.
// IMPORTANT — confirmed the hard way 2026-08-23: these detail endpoints do
// NOT take MATTER_NO as a plain query-string parameter the way the search
// endpoint takes TypeCode. They require a real OData clause:
// `$filter=MATTER_NO eq 146698`. Passing `?MATTER_NO=146698` directly is
// silently ignored and returns the entire unfiltered table — tens of
// thousands of rows, tens of megabytes, from a small state government
// server. Always pass MATTER_NO via $filter, and always pass $top on every
// request, no exceptions, including one-off manual/debugging calls.
//
// SCOPING: searches Case_Caption for the literal phrase "Certificate of
// Public Convenience and Necessity" (the standard legal phrase every VA
// CPCN filing's caption uses) rather than searching by case "type" —
// confirmed 2026-08-23 that the CERT case type also catches unrelated
// things (bank charters, telecom CLEC certificates), while this phrase
// search is precise. Restricted to Case_Number starting with "PUR" (Public
// Utility Regulation division). Each candidate is then detail-fetched and
// kept only if Section === "Energy" (further excludes telecom/other PUR
// certificate cases) — this two-step search-then-filter shape is unlike
// this project's other sources (which get everything in one file/API call)
// because this API has no combined "search by caption AND by a detail-only
// field" query.
//
// NOT YET COVERED: rate cases, tariff cases, and financing dockets also
// live under Section "Energy" but aren't a project waiting on a siting
// decision — the CPCN caption-phrase filter already excludes most of
// these, but this is a narrower net than a human reviewing every VA SCC
// energy docket would draw. Widening scope (e.g. to rate-adjustment-clause
// cases for a named facility) is a deliberate future decision, not
// something to guess at here.
//
// YIELD, confirmed 2026-08-23 against a real full run: only 46 cases in
// this system's *entire history* match `startswith(Case_Number,'PUR')` +
// the CPCN phrase, and after the Section==="Energy" filter, only 1 is
// currently Active (the rest are closed/resolved, correctly dropped via
// RESOLVED_STAGES). A 13.8s run, well within any reasonable timeout — the
// API can comfortably support a much wider net than this. The phrase-match
// scope is deliberately narrow-but-precise for a first version, not a
// ceiling on what this source could return; broadening it (e.g. searching
// all Section==="Energy" PUR cases within a recent date window, not just
// ones whose caption repeats the exact CPCN phrase) is the natural next
// step, traded off against pulling in more rate-case/tariff noise that
// needs its own filter.
//
// GEOCODING: no lat/lon or structured county field in this API. A CPCN
// caption often names the county/counties in prose (e.g. "in Henry and
// Pittsylvania Counties") — extractCounty() below does a best-effort regex
// pull from that text and geocodes to the county centroid, same
// approximation LBNL Queued Up already uses; when it can't confidently
// parse a single county, the project just gets no map pin, same as
// EIA's pipeline tracker.
//
// CAPACITY: no structured capacity field either. extractCapacityMw() pulls
// a "NNN MW" / "NNN MWac" pattern out of the caption text when present —
// present on maybe half of real CPCN captions, absent (e.g. procedural or
// storage-only filings) on the rest. Text-inferred, not authoritative —
// dataQualityNote says so on every project this applies to.
//
// LICENSE/REDISTRIBUTION: open question, same as README open question #7's
// pattern for the other sources — this is a state government's own public
// case-record search tool (state records are generally public under
// Virginia's public records law, similar footing to FERC eLibrary), but no
// dataset-specific redistribution/terms-of-use page was found for the
// docketsearchapi endpoints specifically. Get an explicit answer before
// redistributing bulk data via this site's own API at scale, same as the
// other five sources.
//
// Wired to Vercel Cron weekly, 18:00 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-va-scc/route.ts) — a real run's request
// count/duration was measured (46 candidates, 13.8s) before scheduling this,
// not guessed at. This module makes one search request plus up to 3 detail
// requests *per candidate case* (detail, activities, participants), with a
// deliberate delay between candidates (see REQUEST_DELAY_MS) so a run
// doesn't hammer a small state server the way LBNL/EIA's
// single-workbook-download sources never risk.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject, type NormalizedMilestone } from "@/lib/ingest/common";

const API_BASE = "https://www.scc.virginia.gov/docketsearchapi/breeze";
const SEARCH_URL = `${API_BASE}/CASES_ESTABDATE/GetCasesEstDate`;
const DETAIL_URL = `${API_BASE}/CaseDetails/GetDetail`;
const ACTIVITIES_URL = `${API_BASE}/CaseDetails/GetActivities`;
const PARTICIPANTS_URL = `${API_BASE}/CaseDetails/GetParticipants`;

const CPCN_PHRASE = "Certificate of Public Convenience and Necessity";

// Bounds a single run's request volume — see module header. 100 candidate
// cases means up to 1 + 100*3 = 301 requests in one run.
//
// NOT rotated (see selectWithRotation in common.ts, used by every other
// module in this series): this cap is enforced server-side via the search
// request's own OData $top param (searchCpcnCandidates below), not a
// client-side slice over an already-fetched full list — there's no larger
// local pool to rotate through without changing the live request itself.
// Also low real risk today: module header YIELD (confirmed 2026-08-23)
// puts VA's entire real population at 46 historical cases, ~1 currently
// active — nowhere near this cap.
export const MAX_CANDIDATES = 100;
// Politeness delay between each candidate's detail-fetch sequence — this
// is a small state government server, not a bulk-data API meant for this.
const REQUEST_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CaseSearchResult {
  MATTER_NO: number;
  Case_Number: string;
  Case_Name: string;
  Case_Caption: string;
  Case_Established_Date: string;
  STATUS: string;
}

interface CaseDetail {
  Case_Number: string;
  Case_Name: string;
  Caption: string;
  Status: string;
  Case_Established_Date: string;
  Division: string;
  Section: string | null;
  Disposition: string | null;
  Disposition_Date: string | null;
  Closed_Date: string | null;
}

interface CaseActivity {
  Activity: string;
  Activity_Status: string;
  Activity_Date: string;
  // Real, confirmed-live 2026-09-05 against several past hearings (e.g.
  // Case PUR-2021-00085: "10:00 AM" / "SCC 2nd Floor Court Room") — only
  // populated on an "Activity" whose name contains "Hearing", null on
  // every other activity type. See findNextHearing below.
  Hearing_Time: string | null;
  Location: string | null;
}

interface CaseParticipant {
  Name: string;
  Role: string;
}

// This API wraps every plain array response in Breeze's own metadata
// envelope ($id, $type per row) — irrelevant to us, just cast through.
async function breezeGet<T>(url: string, params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}?${qs}`);
  if (!res.ok) {
    throw new Error(`VA SCC API request failed (${res.status}): ${url}?${qs}`);
  }
  return (await res.json()) as T[];
}

async function searchCpcnCandidates(top: number): Promise<CaseSearchResult[]> {
  return breezeGet<CaseSearchResult>(SEARCH_URL, {
    $filter: `startswith(Case_Number,'PUR') and substringof('${CPCN_PHRASE}',Case_Caption)`,
    $select: "MATTER_NO,Case_Number,Case_Name,Case_Caption,Case_Established_Date,STATUS",
    $orderby: "EstablishedDate desc",
    $top: String(top),
  });
}

async function fetchDetail(matterNo: number): Promise<CaseDetail | null> {
  const rows = await breezeGet<CaseDetail>(DETAIL_URL, {
    $filter: `MATTER_NO eq ${matterNo}`,
    $select:
      "Case_Number,Case_Name,Caption,Status,Case_Established_Date,Division,Section,Disposition,Disposition_Date,Appealed,Final_Order_Date,Closed_Date",
    $top: "1",
  });
  return rows[0] ?? null;
}

async function fetchActivities(matterNo: number): Promise<CaseActivity[]> {
  return breezeGet<CaseActivity>(ACTIVITIES_URL, {
    $filter: `MATTER_NO eq ${matterNo}`,
    $select: "MATTER_ID,Activity,Activity_Status,Activity_Date,Hearing_Time,Location,Web_Cast",
    $top: "100",
  });
}

async function fetchParticipants(matterNo: number): Promise<CaseParticipant[]> {
  return breezeGet<CaseParticipant>(PARTICIPANTS_URL, {
    $filter: `MATTER_NO eq ${matterNo}`,
    $select: "MATTER_NO,Case_Number,Name,Role",
    $top: "50",
  });
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(battery|storage|bess)\b/i, "storage"],
  [/\b(gas|natural gas|combined cycle|combustion turbine)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

function inferFuelType(caption: string): FuelType {
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(caption)) return fuel;
  }
  return "other";
}

function inferProjectType(caption: string): "generation" | "storage" | "transmission" {
  if (/\btransmission line\b/i.test(caption)) return "transmission";
  if (/\b(battery|storage|bess)\b/i.test(caption) && !/\bsolar\b|\bwind\b|\bgas\b/i.test(caption)) return "storage";
  return "generation";
}

// Pulls a capacity figure out of caption prose, e.g. "201.1 MW Solar
// Generating Facility" or "240 MWac Solar Facility" — present on roughly
// half of real CPCN captions, per manual review 2026-08-23. Text-inferred,
// not a structured field; dataQualityNote says so whenever this matches.
function extractCapacityMw(caption: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW(?:ac|dc)?\b/i.exec(caption);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// countyCentroids.json is keyed by 5-digit FIPS, not name — this project's
// other county-centroid consumer (lbnlQueuedUp.ts) always has a FIPS code
// already in hand from its source file, unlike this API which only gives a
// county name in free caption text (e.g. "in Henry and Pittsylvania
// Counties"). Building a real VA county-name → FIPS lookup (and deciding
// what to do with the multi-county case, where no single centroid is the
// project's true site) is deliberate scope, not a quick regex guess — left
// as a follow-up. Every project from this source is ungeocoded for now,
// same honest gap as EIA's pipeline tracker.
function extractCountyCentroid(): { lat: number; lon: number; county: string } | null {
  return null;
}

const STATUS_TO_RESOLVED_STAGE: Record<string, ProjectStage> = {
  closed: "completed",
  withdrawn: "cancelled",
  dismissed: "cancelled",
};

function normalizeCase(search: CaseSearchResult, detail: CaseDetail, activities: CaseActivity[]): NormalizedProject {
  const matchKey = resolveMatchKey("va-scc", search.Case_Number);
  const caption = detail.Caption || search.Case_Caption;
  const statusLower = (detail.Status || search.STATUS || "").toLowerCase();
  const isActive = statusLower === "active";

  const currentStage: ProjectStage = isActive ? "local_review" : (STATUS_TO_RESOLVED_STAGE[statusLower] ?? "completed");

  const capacityMw = extractCapacityMw(caption);
  const countyHit = extractCountyCentroid();
  const fuelType = inferFuelType(caption);
  const projectType = inferProjectType(caption);

  const filedDate = parseUsDate(detail.Case_Established_Date || search.Case_Established_Date);

  const milestones: NormalizedMilestone[] = [];
  for (const a of activities) {
    const date = parseUsDate(a.Activity_Date);
    if (!date) continue;
    milestones.push({ date, dateConfidence: "exact", stage: a.Activity_Status, description: a.Activity });
  }
  const nextHearing = findNextHearing(activities, new Date());

  const dataQualityNoteParts: string[] = [
    "Sourced from the Virginia State Corporation Commission's public docket search — an \"unofficial\" copy per the SCC's own disclaimer, provided for public convenience.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the case caption's prose, not a structured field — not independently verified.");
  }
  if (!countyHit) {
    dataQualityNoteParts.push("No structured location field is published for this docket; this project will not appear on the map until geocoded another way.");
  }

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  return {
    matchKey,
    name: `${(detail.Case_Name || search.Case_Name).trim()} (VA SCC ${search.Case_Number})`,
    projectType,
    fuelType,
    lat: countyHit?.lat ?? null,
    lon: countyHit?.lon ?? null,
    state: "VA",
    county: countyHit?.county ?? null,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `Virginia SCC docket status: ${detail.Status || search.STATUS}${
      milestones.length > 0 ? ` (most recent activity: ${activities[0].Activity}, ${activities[0].Activity_Date})` : ""
    }`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Virginia State Corporation Commission — case ${search.Case_Number}, "${caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    commentPeriodStart: nextHearing?.date ?? null,
    commentPeriodEnd: null,
    commentLink: nextHearing ? `https://scc.virginia.gov/docketsearch/#/caseDetails/${search.MATTER_NO}` : null,
    sources: [
      {
        label: `Virginia SCC Case ${search.Case_Number}`,
        url: `https://scc.virginia.gov/docketsearch/#/caseDetails/${search.MATTER_NO}`,
      },
    ],
    milestones,
    externalIds: { vaScc: search.Case_Number },
  };
}

// Case_Established_Date and Activity_Date come back as "MM/DD/YYYY"
// strings, confirmed 2026-08-23 — not ISO, not Excel-serial like LBNL's
// workbook.
function parseUsDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

// "10:00 AM" / "10:00AM " (no space, trailing space — both confirmed live)
// combined onto Activity_Date's own UTC-midnight Date. No timezone stated
// (SCC is implicitly Eastern); same wall-clock-as-literal tradeoff every
// other source in this series makes where full precision isn't published.
function combineDateAndHearingTime(dateOnly: Date, hearingTime: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(hearingTime.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const isPM = /pm/i.test(m[3]);
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  return new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), hour, minute));
}

interface NextHearing {
  date: Date;
  location: string | null;
}

// Only an activity whose name contains "Hearing" AND has a real
// Hearing_Time counts — Activity_Status isn't used to distinguish
// upcoming from past (both "No Action" and "Completed" were observed on
// real future-dated hearings in this series' own research — see module
// header), so the date itself (still in the future) is the only reliable
// signal.
function findNextHearing(activities: CaseActivity[], now: Date): NextHearing | null {
  let next: NextHearing | null = null;
  for (const a of activities) {
    if (!/hearing/i.test(a.Activity) || !a.Hearing_Time) continue;
    const dateOnly = parseUsDate(a.Activity_Date);
    if (!dateOnly) continue;
    const dt = combineDateAndHearingTime(dateOnly, a.Hearing_Time);
    if (!dt || dt.getTime() <= now.getTime()) continue;
    if (!next || dt.getTime() < next.date.getTime()) next = { date: dt, location: a.Location };
  }
  return next;
}

export interface IngestSummary {
  candidatesFound: number;
  upserted: number;
  removedResolved: number;
  skippedNotEnergy: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestVaSccDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const candidates = await searchCpcnCandidates(maxCandidates);

  let skippedNotEnergy = 0;
  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const detail = await fetchDetail(candidate.MATTER_NO);
      // Excludes non-energy PUR certificate cases (telecom CLEC
      // certificates, bank charters that happen to share the "PUR"
      // division prefix historically) — see module header SCOPING.
      if (!detail || detail.Section !== "Energy") {
        skippedNotEnergy += 1;
        continue;
      }
      const activities = await fetchActivities(candidate.MATTER_NO);
      toUpsert.push(normalizeCase(candidate, detail, activities));
    } catch (err) {
      errors.push({ matchKey: candidate.Case_Number, message: String(err) });
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
    candidatesFound: candidates.length,
    upserted,
    removedResolved,
    skippedNotEnergy,
    errors,
  };
}

// fetchParticipants is exposed but not yet folded into causeDetail/sources
// — intervenor names are real, useful data (see README example), but
// deciding how to surface them (a new field? appended to causeDetail?) is
// a product call, not made unilaterally here. Wired up and ready for
// whoever makes that call.
export { fetchParticipants };

if (require.main === module) {
  ingestVaSccDockets()
    .then((summary) => {
      console.log(
        `Virginia SCC docket ingestion complete: ${summary.candidatesFound} CPCN-phrase candidates found, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ` +
          `skipped ${summary.skippedNotEnergy} non-Energy-section cases, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
