// Colorado Public Utilities Commission (PUC) docket ingestion — third
// state in the per-state series started with vaSccDockets.ts (see that
// file's header for the overall rationale). Found via a parallel research
// agent (see conversation), independently confirmed by hand against real
// responses before writing this module — same "confirm before guessing"
// standard as vaSccDockets.ts / txPuctDockets.ts.
//
// FETCHING: Colorado's e-filing system (dora.state.co.us/pls/efi — note
// the *legacy* `www.dora.state.co.us` host; the newer `dora.colorado.gov`
// Drupal site 404s for this) is an Oracle PL/SQL web-gateway. Confirmed
// 2026-08-23: a plain unauthenticated GET returns real HTML directly, no
// headless browser, no session/CSRF token. Two endpoints:
//   - Search: EFI_SEARCH_UI.getProceedingResults — returns a small HTML
//     table (title+link, date, docket ID, status) for every matching
//     docket. Confirmed gotcha: passing an *empty* value for an unused
//     param throws `ORA-00909: invalid number of arguments` — omit unused
//     params from the query string entirely rather than sending `param=`.
//     `p_title` needs explicit `*wildcards*`; a bare term requires an
//     exact full-title match and returns nothing.
//   - Detail: EFI.Show_Docket?p_docket_id=<id> — full docket page,
//     confirms Open Date + Status (redundant with the search row, see
//     below) and a "Documents" table (title, submitted date, document
//     type, filing party) — this site's only source of real per-project
//     milestones.
//
// THE GOOD NEWS THIS SOURCE HAS THAT VIRGINIA/TEXAS DON'T: status is a
// real structured field *already present in the search results row*
// (Active/Closed/Effective/Withdrawn/Suspended/Appealed/etc., confirmed by
// hand against a live query returning real CPCN dockets) — no per-candidate
// detail fetch is needed just to know whether a docket is still open,
// unlike Virginia (needs one GetDetail call) or Texas (needs the entire
// filing history). The detail fetch here is *only* for milestones, an
// enrichment, not a requirement for correctness.
//
// STATUS MAPPING: "Active" is the only status kept as still-waiting
// (currentStage "local_review"). Every other observed value is mapped to a
// RESOLVED_STAGES value so common.ts's shared guard deletes any
// previously-tracked row — including "Appealed": the PUC's own docket
// process concluded to reach an appealable decision, even though the
// underlying dispute continues elsewhere (in court, which is a different
// waiting-reason this site already models separately via the
// "litigation_legal_challenge" cause — not re-derived here). An
// unrecognized status string (should it exist in a future edition) also
// maps to resolved by default — understating "still waiting" is the safer
// failure mode than overstating it.
//
// SCOPING: searches title for "*CPCN*" (Colorado's own abbreviation for
// Certificate of Public Convenience and Necessity, confirmed to appear
// literally in real docket titles, e.g. "Public Service Co - CPCN - 400 MW
// Ft St. Vrain 7&8 Project") restricted to the Electric industry.
// Confirmed 2026-08-23: modest yield — 82 all-time matches, ~13-20 in a
// recent window — smaller than Texas, comparable to Virginia; Colorado's
// own major utilities (Xcel/Public Service Co, Black Hills, Tri-State) are
// simply fewer than Texas's, not a sign of a scoping problem.
//
// Wired to Vercel Cron weekly, 19:00 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-co-puc/route.ts) — a real run's timing was
// measured (22 candidates, ~41s) before scheduling this.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject, type NormalizedMilestone } from "@/lib/ingest/common";

const BASE_URL = "https://www.dora.state.co.us/pls/efi";
const SEARCH_URL = `${BASE_URL}/EFI_SEARCH_UI.getProceedingResults`;
const DETAIL_URL = `${BASE_URL}/EFI.Show_Docket`;

export const MAX_CANDIDATES = 150;
const REQUEST_DELAY_MS = 250;
// Colorado's total CPCN-title history is small (82 all-time, confirmed
// 2026-08-23) — a several-year window still comfortably bounds candidate
// volume without needing a tight recent-only cutoff the way Texas did.
const LOOKBACK_YEARS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Search result titles wrap the matched term in <b>CPCN</b> — strip tags
// to get the plain caption text.
function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, ""));
}

interface DocketSearchResult {
  docketId: string;
  title: string;
  date: string;
  status: string;
}

const SEARCH_ROW_RE =
  /<tr>\s*<td[^>]*><a href="EFI\.Show_Docket\?[^"]*p_docket_id=([^"&]+)"[^>]*>([\s\S]*?)<\/a><\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/g;

// Row shape confirmed 2026-08-23 against a real response: 4 <td> columns —
// (1) linked title, (2) date, (3) docket ID again as plain text
// (redundant with the URL's p_docket_id, used here only as a sanity check),
// (4) status.
export function parseSearchResults(html: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(SEARCH_ROW_RE)) {
    results.push({
      docketId: decodeURIComponent(m[1]),
      title: stripTags(m[2]),
      date: decodeHtmlEntities(m[3]),
      status: decodeHtmlEntities(m[5]),
    });
  }
  return results;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CO PUC request failed (${res.status}): ${url}`);
  return res.text();
}

async function searchCandidates(): Promise<DocketSearchResult[]> {
  const from = new Date();
  from.setFullYear(from.getFullYear() - LOOKBACK_YEARS);
  const p_after = `${String(from.getMonth() + 1).padStart(2, "0")}/${String(from.getDate()).padStart(2, "0")}/${from.getFullYear()}`;
  const params = new URLSearchParams({
    p_title: "*CPCN*",
    p_industry: "ELECTRIC",
    p_after,
    p_cache: "1",
  });
  const html = await fetchText(`${SEARCH_URL}?${params.toString()}`);
  return parseSearchResults(html);
}

// Unlike the search endpoint (which 400s if given a *blank* param and
// wants unused ones omitted entirely), Show_Docket does the opposite:
// confirmed 2026-08-23 that it needs p_session_id present, even empty, or
// it 400s. Same Oracle PL/SQL web toolkit, different procedure, different
// required-parameter behavior — not assumed to generalize between the two.
async function fetchDetail(docketId: string): Promise<string> {
  const params = new URLSearchParams({ p_session_id: "", p_docket_id: docketId });
  return fetchText(`${DETAIL_URL}?${params.toString()}`);
}

interface DocketDocument {
  title: string;
  submitted: string;
  docType: string;
}

const DOCUMENT_ROW_RE =
  /<a href="EFI\.Show_Filing\?[^"]*"[^>]*class="clsTableText">([\s\S]*?)<\/a><\/td>\s*<td[^>]*>\s*(\w{3} \d{1,2}\/\d{1,2}\/\d{4})/g;

// The Documents grid's Document Type(s) column isn't reliably capturable
// with the same simple pattern as title+date (it can hold multiple
// comma-separated types across nested markup) — milestones use the
// document title alone as the description, which is already the real,
// human-written filing name (e.g. "Order Granting Certificate...", not a
// generic type code).
export function parseDocuments(html: string): DocketDocument[] {
  const docs: DocketDocument[] = [];
  for (const m of html.matchAll(DOCUMENT_ROW_RE)) {
    docs.push({ title: decodeHtmlEntities(m[1]), submitted: m[2].replace(/^\w{3} /, ""), docType: "" });
  }
  return docs;
}

function parseUsDate(raw: string): Date | null {
  const m = /^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/.exec(raw.trim()) ?? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  if (m[1].length <= 2 && /^\d+$/.test(m[1])) {
    const [, mm, dd, yyyy] = m;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const RESOLVED_STATUS_MAP: Record<string, ProjectStage> = {
  closed: "completed",
  effective: "completed",
  withdrawn: "cancelled",
  suspended: "cancelled",
  appealed: "cancelled",
};

function stageForStatus(status: string): ProjectStage {
  const key = status.trim().toLowerCase();
  if (key === "active") return "local_review";
  return RESOLVED_STATUS_MAP[key] ?? "cancelled";
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(battery|storage|bess)\b/i, "storage"],
  [/\b(natural gas|combined cycle|combustion turbine|thermal plant|gas plant)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

const TRANSMISSION_RE = /\btransmission\b[\s\S]{0,25}\b(line|project)\b|\bsubstation\b/i;

function inferProjectType(title: string): "generation" | "storage" | "transmission" {
  if (TRANSMISSION_RE.test(title)) return "transmission";
  if (/\b(battery|storage|bess)\b/i.test(title) && !/\bsolar\b|\bwind\b|\bgas\b/i.test(title)) return "storage";
  return "generation";
}

function inferFuelType(title: string, projectType: "generation" | "storage" | "transmission"): FuelType {
  if (projectType === "transmission") return "transmission";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(title)) return fuel;
  }
  return "other";
}

function extractCapacityMw(title: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW\b/i.exec(title);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function buildMilestones(docs: DocketDocument[]): NormalizedMilestone[] {
  const milestones: NormalizedMilestone[] = [];
  for (const d of docs) {
    const date = parseUsDate(d.submitted);
    if (!date) continue;
    milestones.push({ date, dateConfidence: "exact", stage: "Filing", description: d.title });
  }
  return milestones;
}

function normalizeDocket(search: DocketSearchResult, docs: DocketDocument[]): NormalizedProject {
  const matchKey = resolveMatchKey("co-puc", search.docketId);
  const currentStage = stageForStatus(search.status);
  const filedDate = parseUsDate(search.date);
  const capacityMw = extractCapacityMw(search.title);
  const projectType = inferProjectType(search.title);
  const fuelType = inferFuelType(search.title, projectType);
  const milestones = buildMilestones(docs);
  // The Documents grid returns newest-first (confirmed 2026-08-23) —
  // don't assume array order for "most recent" below; the project page's
  // own timeline re-sorts independently (see serializeProject.ts) so this
  // only affects the currentStatus summary text.
  const mostRecentMilestone = milestones.length > 0 ? [...milestones].sort((a, b) => b.date.getTime() - a.date.getTime())[0] : null;
  const company = search.title.split(/\s*-\s*CPCN\b/i)[0].trim();

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Colorado Public Utilities Commission's public e-filing search.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket title text, not a structured field — not independently verified.");
  }
  dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");

  return {
    matchKey,
    name: `${company || search.title} (CO PUC Docket ${search.docketId})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "CO",
    county: null,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `Colorado PUC docket ${search.docketId}: ${search.status}${
      mostRecentMilestone ? ` (${milestones.length} filings, most recent: ${mostRecentMilestone.description.slice(0, 60)})` : ""
    }`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Colorado Public Utilities Commission — Docket No. ${search.docketId}, "${search.title}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `Colorado PUC Docket No. ${search.docketId}`,
        url: `${DETAIL_URL}?p_docket_id=${encodeURIComponent(search.docketId)}`,
      },
    ],
    milestones,
    externalIds: { coPuc: search.docketId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestCoPucDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const candidates = (await searchCandidates()).slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      // Only fetch detail (for milestones) on still-active dockets — a
      // resolved one is about to be deleted via RESOLVED_STAGES regardless,
      // so its filing history is never displayed; skipping the fetch saves
      // a request per resolved candidate.
      const docs = stageForStatus(candidate.status) === "local_review" ? parseDocuments(await fetchDetail(candidate.docketId)) : [];
      toUpsert.push(normalizeDocket(candidate, docs));
    } catch (err) {
      errors.push({ matchKey: candidate.docketId, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return { candidatesFound: candidates.length, upserted, removedResolved, errors };
}

if (require.main === module) {
  ingestCoPucDockets()
    .then((summary) => {
      console.log(
        `Colorado PUC docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
