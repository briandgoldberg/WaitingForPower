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
// NO FULL MILESTONES YET: each case has its own detail page (see the `url`
// field), and this module now fetches it for every still-waiting case
// (small: 16 of 227, confirmed 2026-08-23) to pull the "Local public
// hearing"/"Evidentiary hearing" date blocks it publishes there — see
// fetchNextHearing below — but doesn't yet build a full Milestone history
// from that same page. The list endpoint alone still gives structured
// status/type/applicant/county/date, more than any other state source in
// this series gets for free; per-case milestone enrichment remains a cheap,
// low-priority follow-up rather than a requirement.
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

// Real OPSB case detail page markup varies more than a single example
// suggests — confirmed by hand 2026-09-05 across several real cases:
//   - Label and date in the SAME paragraph (Case 24-0881-EL-BGN):
//       <p dir="ltr"><strong>Local public hearing</strong><br />
//       August 11, 2025, at 5 p.m.<br />Amanda Clearcreek High School<br />...
//   - Label and date in SEPARATE paragraphs (Case 26-196-EL-BGN):
//       <p dir="ltr"><strong>Evidentiary hearing</strong></p>
//       <p dir="ltr">September 9, 2026, at 10 a.m.<br />Offices of...
//   - No year at all (Case 26-0426-EL-BTX): "October 27 at 6 p.m." — OPSB
//     evidently drops the year when it's simply "this year"; see
//     parseHearingDateTime's year-inference fallback below.
// So rather than one regex tying a label to an adjacent date, every
// "<strong>...hearing</strong>" label position is found first, then the
// first date-shaped line in the text following it (label's own `<p>` or
// the next one) is taken as that hearing's date — label and date can be up
// to a couple hundred chars apart across a paragraph break.
const HEARING_LABEL_RE = /<strong>([^<]*[Hh]earing)<\/strong>/g;
const DATE_LINE_RE = /^([A-Za-z]+\.?)\s+(\d{1,2})(?:,\s+(\d{4}))?,?\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.)/i;

function findDateLineAfter(html: string, labelEndIndex: number): string | null {
  const window = html.slice(labelEndIndex, labelEndIndex + 400).replace(/<[^>]+>/g, "\n");
  for (const line of window.split("\n").map((s) => s.trim()).filter(Boolean)) {
    if (DATE_LINE_RE.test(line)) return line;
  }
  return null;
}

// "August 11, 2025, at 5 p.m." / "February 9, 2026, at 10 a.m." / "Feb. 27,
// 2026, at 5 p.m." (abbreviated with a trailing period) / "October 27 at 6
// p.m." (no year at all) — every format observed. No timezone stated
// anywhere on the page (OPSB is implicitly Eastern time); parsed as a
// literal wall-clock time, same exact/approximate-precision tradeoff every
// other source in this series already makes where a source doesn't
// publish full precision. A missing year is inferred as the current year,
// rolled forward one year if that would otherwise land more than a month
// in the past — OPSB's own convention (confirmed: every yearless example
// seen names a date still genuinely upcoming) is evidently "assume this
// year unless that's already passed."
function parseHearingDateTime(raw: string, now: Date): Date | null {
  const m = DATE_LINE_RE.exec(raw.trim());
  if (!m) return null;
  const [, monthName, day, yearStr, hourStr, minuteStr, ampm] = m;
  let hour = Number(hourStr);
  const minute = minuteStr ? Number(minuteStr) : 0;
  const isPM = /p/i.test(ampm);
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  const timePart = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

  if (yearStr) {
    const d = new Date(`${monthName} ${day}, ${yearStr} ${timePart}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const thisYear = now.getFullYear();
  const candidate = new Date(`${monthName} ${day}, ${thisYear} ${timePart}`);
  if (Number.isNaN(candidate.getTime())) return null;
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  if (candidate.getTime() < now.getTime() - oneMonthMs) {
    return new Date(`${monthName} ${day}, ${thisYear + 1} ${timePart}`);
  }
  return candidate;
}

// OPSB's generic case contact form — confirmed by hand: every case detail
// page carries the same "Have questions or comments about this Case? Send
// us a message!" link to this same URL, not a per-case submission portal.
const OPSB_CONTACT_URL = "https://opsb.ohio.gov/wps/wcm/connect/gov/ohio+content+english/opsb/help-center/contact-us";

// Only the earliest still-upcoming hearing is surfaced — a case can list
// both a past "Local public hearing" and a future "Evidentiary hearing" (or
// vice versa once the local hearing is rescheduled), and only a future date
// is something a visitor can actually still show up to or comment ahead of.
async function fetchNextHearing(detailUrl: string): Promise<Date | null> {
  const res = await fetch(detailUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) return null;
  const html = await res.text();
  const now = new Date();
  let earliest: Date | null = null;
  for (const m of html.matchAll(HEARING_LABEL_RE)) {
    const dateLine = findDateLineAfter(html, m.index! + m[0].length);
    if (!dateLine) continue;
    const d = parseHearingDateTime(dateLine, now);
    if (d && d.getTime() > now.getTime() && (!earliest || d.getTime() < earliest.getTime())) earliest = d;
  }
  return earliest;
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

function normalizeCase(c: OpsbCase, nextHearing: Date | null): NormalizedProject {
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
    commentPeriodStart: nextHearing,
    commentPeriodEnd: null,
    commentLink: nextHearing ? OPSB_CONTACT_URL : null,
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
      // Hearing-date extraction needs a second (per-case) request, so it's
      // only fetched for cases still actually waiting — see module header
      // ("16 of 227" — cheap at this volume) and stageForStatus above.
      const currentStage = stageForStatus(c.status);
      const stillWaiting = currentStage === "local_review" || currentStage === "planned_pre_filing";
      const nextHearing = stillWaiting ? await fetchNextHearing(`https://opsb.ohio.gov${c.url}`).catch(() => null) : null;
      toUpsert.push(normalizeCase(c, nextHearing));
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
