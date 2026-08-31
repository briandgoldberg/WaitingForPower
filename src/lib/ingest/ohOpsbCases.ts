// Ohio Power Siting Board (OPSB) case ingestion — fourth state in the
// per-state series started with vaSccDockets.ts (see that file's header
// for the overall rationale). Found via a parallel research agent,
// independently confirmed by hand before writing this module.
//
// NOT PUCO: Ohio's regular Public Utilities Commission (PUCO) docketing
// system (dis.puc.state.oh.us) sits behind an F5 bot-defense WAF —
// confirmed 2026-08-23 that every POST search gets silently redirected to
// a blocked error page, full browser headers or not. That's a real dead
// end for a zero-cost source, not worth working around. The Ohio Power
// Siting Board is the actual authority for generation/transmission siting
// certificates in Ohio (Certificate of Environmental Compatibility and
// Public Need, under case suffixes like -EL-BGN/-EL-BTX) and turned out to
// be the easiest source in this entire series.
//
// FETCHING: opsb.ohio.gov's public case list loads via one unauthenticated
// GET to a WebSphere WCM "component" endpoint — confirmed 2026-08-23 that
// it returns the *entire* case history (227 cases) as a single JSON array,
// no pagination, no query params, no session/CSRF. The page's own UI just
// filters this client-side. A browser-like User-Agent is required (a
// bare-header curl 404s; confirmed by hand) — same requirement as several
// other .gov sources in this project, not unique to Ohio.
//
// GOTCHA: the response's declared Content-Type is text/html even though
// the body is genuine JSON — parse it as JSON regardless of what the
// header claims.
//
// STATUS: a real structured field, no inference needed (like Colorado, not
// like Texas) — Approved / Operational / Under construction / Withdrawn /
// Denied / Pending / Pre-application, plus two blank values observed.
// "Pending" and "Pre-application" are the only two treated as still
// waiting; everything else — including "Under construction" and
// "Approved", which on this site's terms have already cleared the
// decision this source is about — maps to RESOLVED_STAGES.
//
// FUEL/PROJECT TYPE: `type` is *also* a real structured field (Wind /
// Solar / Natural Gas Power Plant / Natural Gas Transmission / Electric
// Transmission / Battery Storage / Amendment), not free text to guess a
// keyword out of — the first source in this series where fuel type isn't
// an approximation. "Amendment" is a real gap: it's a case-type label
// (an amendment to a previously-certificated project), not a technology,
// so those rows fall back to fuelType "other" same as a genuinely unclear
// case would — 14 of 227 all-time, confirmed 2026-08-23.
//
// NOT GEOCODED: `location` is a real Ohio county name (e.g. "Hardin"),
// but mapping that to this project's countyCentroids.json (keyed by
// 5-digit FIPS) needs a real Ohio county-name → FIPS reference, not
// guessed at — same gap flagged as future work in vaSccDockets.ts.
// Deferred, not built here.
//
// NO MILESTONES YET: each case has its own detail page (see the `url`
// field), but this module only fetches the one list endpoint — the list
// alone already gives structured status/type/applicant/county/date, more
// than any other state source in this series gets for free, and the
// currently-waiting set is small (16 of 227, confirmed 2026-08-23) making
// per-case enrichment a cheap, low-priority follow-up rather than a
// requirement.
//
// Wired to Vercel Cron weekly, 19:30 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-oh-opsb/route.ts) — a real run's timing was
// measured (227 cases, 7.6s, the fastest source in this series) before
// scheduling this.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const CASES_URL =
  "https://opsb.ohio.gov/wps/wcm/connect/gov/Ohio%20Content%20English/opsb?source=library&srv=cmpnt&cmpntid=691ce407-26ae-4653-9dc1-4789a8a6711e&WCM_Page.ResetAll=TRUE&location=Ohio%20Content%20English";

// Confirmed 2026-08-23: a bare curl request 404s; this site wants a
// browser-like UA, same as several other .gov sources this project talks
// to (see lbnlQueuedUp.ts).
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

interface OpsbCase {
  caseNumber: string;
  project: string;
  applicant: string;
  location: string;
  status: string;
  type: string;
  url: string;
  openDate: string;
}

export async function fetchCases(): Promise<OpsbCase[]> {
  const res = await fetch(CASES_URL, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`OPSB request failed (${res.status}): ${CASES_URL}`);
  // Declared Content-Type is text/html despite a real JSON body — see
  // module header.
  const text = await res.text();
  return JSON.parse(text) as OpsbCase[];
}

const STATUS_TO_STAGE: Record<string, ProjectStage> = {
  pending: "local_review",
  "pre-application": "planned_pre_filing",
  approved: "approved_awaiting_construction",
  "under construction": "under_construction",
  operational: "completed",
  denied: "cancelled",
  withdrawn: "cancelled",
};

function stageForStatus(status: string): ProjectStage {
  return STATUS_TO_STAGE[status.trim().toLowerCase()] ?? "cancelled";
}

const TYPE_TO_FUEL: Record<string, FuelType> = {
  wind: "wind_onshore",
  solar: "solar",
  "natural gas power plant": "gas",
  "natural gas transmission": "pipeline",
  "electric transmission": "transmission",
  "battery storage": "storage",
};

const TYPE_TO_PROJECT_TYPE: Record<string, ProjectType> = {
  wind: "generation",
  solar: "generation",
  "natural gas power plant": "generation",
  "natural gas transmission": "pipeline",
  "electric transmission": "transmission",
  "battery storage": "storage",
};

function classify(type: string): { fuelType: FuelType; projectType: ProjectType } {
  const key = type.trim().toLowerCase();
  return {
    fuelType: TYPE_TO_FUEL[key] ?? "other",
    projectType: TYPE_TO_PROJECT_TYPE[key] ?? "generation",
  };
}

// Same pattern as the other per-state sources — present on some project
// names, absent on most (OPSB project names are usually just the facility
// name, e.g. "Hog Creek Wind Farm I", with no capacity stated).
function extractCapacityMw(text: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW\b/i.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parseOpenDate(raw: string): Date | null {
  const d = new Date(`${raw} UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeCase(c: OpsbCase): NormalizedProject {
  const matchKey = resolveMatchKey("oh-opsb", c.caseNumber);
  const currentStage = stageForStatus(c.status);
  const { fuelType, projectType } = classify(c.type);
  const capacityMw = extractCapacityMw(c.project);
  const filedDate = parseOpenDate(c.openDate);

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Ohio Power Siting Board's public case list.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the project name text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push('OPSB lists this case\'s type as "Amendment" — a case-type label, not a technology, so no fuel type could be determined.');
  }
  dataQualityNoteParts.push(
    `Located in ${c.location} County, Ohio, per OPSB — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`,
  );

  return {
    matchKey,
    name: `${c.project} (OH OPSB Case ${c.caseNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "OH",
    county: c.location || null,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    applicant: c.applicant,
    currentStatus: `Ohio OPSB case ${c.caseNumber}: ${c.status || "unknown"} (applicant: ${c.applicant})`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Environmental Compatibility and Public Need from the Ohio Power Siting Board — Case No. ${c.caseNumber}, "${c.project}" (${c.applicant})`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `Ohio OPSB Case ${c.caseNumber}`,
        url: `https://opsb.ohio.gov${c.url}`,
      },
    ],
    externalIds: { ohOpsb: c.caseNumber },
  };
}

export interface IngestSummary {
  totalCases: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestOhOpsbCases(): Promise<IngestSummary> {
  const cases = await fetchCases();
  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const c of cases) {
    try {
      toUpsert.push(normalizeCase(c));
    } catch (err) {
      errors.push({ matchKey: c.caseNumber, message: String(err) });
    }
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return { totalCases: cases.length, upserted, removedResolved, errors };
}

if (require.main === module) {
  ingestOhOpsbCases()
    .then((summary) => {
      console.log(
        `Ohio OPSB ingestion complete: ${summary.totalCases} total cases, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
