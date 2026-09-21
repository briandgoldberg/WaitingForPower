// Georgia Public Service Commission (PSC) electric docket ingestion —
// closing a real gap flagged during outreach research: Georgia is a major
// data-center/large-load corridor with no dedicated docket source in this
// project until now. Confirmed by hand 2026-09-09 via real GET/fetch
// requests against the live psc.ga.gov site — no assumption below was
// taken from documentation or training-data memory alone.
//
// FETCHING: psc.ga.gov's Advanced Search is a plain server-rendered page
// backed by a real JSON XHR endpoint,
// /facts-advanced-search/docket-filter-service/, confirmed live via the
// browser's own network tab (not guessed): a GET with
// industryId=3 (Electric), pageSize, and pageNumber returns every matching
// docket as JSON, no auth, no session token. Confirmed gotcha: the `title`
// query parameter is accepted but silently ignored server-side — tested
// twice, once via direct navigation and once via a real
// X-Requested-With: XMLHttpRequest fetch to rule out a client-only quirk,
// and the result count (3,075) was identical with or without a title
// filter. All scoping here is therefore done client-side against the full
// result set, same pattern as alPscDockets.ts's content-based filtering.
// `statusId`, by contrast, does filter server-side (confirmed: statusId=1
// returned 0 rows, statusId=7 returned 2,296, both real, different
// counts) — this module still scopes by content match rather than status
// alone, since "Open" (statusId 7) covers far more than siting-relevant
// dockets (retail-service transfers, financing approvals, demand-side
// management filings all share the same status).
//
// SCOPING — Georgia's real structure, confirmed by hand: unlike most other
// states in this series, individual generation/storage projects do not
// each file their own separate CPCN-style application in Georgia. Georgia
// Power's own new resource additions are approved in bulk through periodic
// Integrated Resource Plan and RFP proceedings, then the resulting power
// purchase agreements with third-party developers are "certified" through
// a single docket per RFP round (e.g. "GEORGIA POWER COMPANY'S APPLICATION
// FOR THE CERTIFICATION OF THE 2029-2031 ALL-SOURCE CAPACITY RFP") —
// confirmed live: 43 of 3,075 electric dockets match /certificat/i, and
// the real ones found are overwhelmingly RFP/PPA certification rounds, not
// single-project applications. Those are tracked here as aggregate
// entries (isAggregateExample: true, matching Project.isAggregateExample's
// documented purpose) rather than invented as fake individual projects.
//
// "CONSTRUCTION MONITORING" DOCKETS DELIBERATELY NOT TRACKED: real, named
// individual plants do appear under titles like "McIntosh CC Construction
// Monitoring" (6 confirmed live 2026-09-09: McIntosh, Bowen, Wansley,
// Yates Units 8-10, a BESS program, and Vogtle Units 3&4) — but every one
// of them is already at under_construction (a RESOLVED_STAGES value) the
// very first time this source ever mentions it. upsertNormalizedProject's
// own guard (common.ts, added after a real incident where an unguarded
// LBNL run created ~30,000 fake historical rows) correctly refuses to
// create a brand-new project that arrives already resolved — confirmed
// live: all 6 were correctly rejected, 0 inserted, 0 errors. That's this
// project's existing safeguard working as designed, not a bug to route
// around, so this module doesn't attempt to track that category at all.
//
// NOT GEOCODED, NO CAPACITY FIGURE: the docket list gives only a title,
// status, industry, and date — no county, capacity, or applicant as
// separate structured fields (unlike Ohio's OPSB list). Since every
// tracked docket here is an aggregate certification (many underlying
// projects, no single capacity), capacityValue is always left null with
// an honest dataQualityNote rather than guessed.
//
// STATUS: docket-level `statusName` values seen live: Open, Closed,
// Certified, Ongoing, Compliance, Appeal, Opened, Tariff. This module
// only ever queries statusId=7 ("Open") — a resolved Georgia docket isn't
// separately re-checked for a real resolution date the way several other
// state modules do (see wvPscDockets.ts, e.g.), since a "Construction
// Monitoring" or "RFP Certification" docket's own real completion
// (a facility going into service, an RFP's PPAs all executed) isn't
// reliably inferable from title text alone — a genuine, documented
// limitation rather than a guess.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";
import { classifyReviewStep, type DocketEvent } from "@/lib/ingest/reviewStep";

const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SERVICE_URL =
  "https://psc.ga.gov/facts-advanced-search/docket-filter-service/?statusId=7&industryId=3&title=&docketDateFrom=&docketDateTo=&pageSize=5000&pageNumber=1";

interface GaDocket {
  docketId: number;
  title: string;
  statusName: string;
  industryName: string;
  docketDate: string;
  docketDateName: string;
}

interface GaSearchResponse {
  resultsCount: number;
  resultsItems: GaDocket[] | null;
}

export async function fetchOpenElectricDockets(): Promise<GaDocket[]> {
  const res = await fetch(SERVICE_URL, { headers: { "X-Requested-With": "XMLHttpRequest" } });
  if (!res.ok) throw new Error(`Georgia PSC request failed (${res.status}): ${SERVICE_URL}`);
  const json = (await res.json()) as GaSearchResponse;
  return json.resultsItems ?? [];
}

// PROCEDURAL STEP (added 2026-09-21): the docket page's own document list loads
// from a second JSON endpoint, /search/service-facts-docket/ (found in
// psc.ga.gov's docket.v2.js, confirmed live). It returns every filing in a
// docket with a filed date and description, so the step can be read from
// filings the same way txPuctDockets.ts does. Confirmed gotcha: the endpoint
// returns an empty body unless pageNumber is passed. One request per matched
// docket. Hearing dates are not published as data (only "Hearing Transcript"
// filings after the fact, and notices whose dates live in the PDF), so
// hearings stays undefined rather than guessed.
interface GaDocketFiling {
  description: string;
  filedDate: string;
}

export async function fetchDocketFilings(docketId: number): Promise<GaDocketFiling[]> {
  const url =
    `https://psc.ga.gov/search/service-facts-docket/?docketId=${docketId}&sortDirection=ASC&sortColumn=Filed&searchText=&pageSize=500&pageNumber=1`;
  const res = await fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest" } });
  if (!res.ok) throw new Error(`Georgia PSC filings request failed (${res.status}): ${url}`);
  const json = (await res.json()) as { resultsItems: GaDocketFiling[] | null };
  return json.resultsItems ?? [];
}

// Georgia closes a certification with an order titled "Order Adopting
// Stipulation" / "Order Approving Joint Stipulation" (often "... and Granting
// Certification"), or older "Final Order" / "Certification Order" filings.
// The lookbehind skips party filings such as "Joint Proposed Order Adopting the
// Stipulation". Deliberately narrower than the shared default, which would also
// treat "ORDER APPROVING CHANGE OF CONTROL" or "ORDER DENYING MOTION ..."
// (routine mid-docket orders) as closing.
const GA_SIGNALS = {
  closed: /(?<!proposed )\b(order (adopting|approving) (the )?(joint )?stipulation|order (granting|denying) (the )?certification|final order|certification order)\b/i,
  // A stipulation between Staff and the utility means the decision is next.
  decisionNext:
    /\bstipulation\b|\bpost-?\s?hearing brief|\bproposed (final )?order\b/i,
  hearingHeld: /\btranscripts?\b/i,
  hearingSet: /\bnotice of (scheduled )?(special )?(hearing|administrative session)\b/i,
};

function parseIsoDate(raw: string): Date | null {
  const d = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function classifyFilings(filings: GaDocketFiling[]) {
  const events: DocketEvent[] = filings.map((f) => ({ date: parseIsoDate(f.filedDate), text: f.description.replace(/\s+/g, " ") }));
  return classifyReviewStep(events, GA_SIGNALS);
}

// Real certification-docket titles seen live all describe an RFP round or
// a batch of power purchase agreements, never a single named facility —
// see module header for why these become aggregate rows.
const CERTIFICATION_RE = /certificat/i;

function parseDocketDate(raw: string): Date | null {
  const d = new Date(`${raw} UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeCertification(d: GaDocket, filings: GaDocketFiling[]): NormalizedProject {
  const matchKey = resolveMatchKey("ga-psc", String(d.docketId));
  const filedDate = parseDocketDate(d.docketDate);
  const review = filings.length > 0 ? classifyFilings(filings) : undefined;

  return {
    matchKey,
    name: `${d.title} (GA PSC Docket ${d.docketId})`,
    projectType: "generation",
    fuelType: "other",
    lat: null,
    lon: null,
    state: "GA",
    county: null,
    capacityValue: null,
    capacityUnit: null,
    applicationFiledDate: filedDate,
    dateConfidence: "approximate",
    applicant: "Georgia Power Company",
    currentStatus: `Georgia PSC Docket ${d.docketId}: ${d.statusName}`,
    currentStage: "local_review" as ProjectStage,
    // Undefined when the filing list was empty (nothing to judge from); null
    // when a closing order exists (the docket stays "Open" for compliance).
    reviewStep: review === undefined ? undefined : review ? review.step : null,
    reviewStepAt: review === undefined ? undefined : review ? review.at : null,
    causeSlugs: [] as CauseSlug[],
    causeDetail: `Georgia Power Company's certification of power purchase agreements or an RFP round with the Georgia PSC — represents multiple underlying projects, not one, so no single capacity or fuel type applies. Docket ${d.docketId}.`,
    isAggregateExample: true,
    dataQualityNote:
      "This docket certifies a batch of power purchase agreements or an RFP round covering multiple underlying generation/storage projects, not one project — tracked here as an aggregate entry rather than invented as a single fake project. See the docket itself for the individual facilities it covers.",
    sources: [{ label: `GA PSC Docket ${d.docketId}`, url: `https://psc.ga.gov/search/facts-docket/?docketId=${d.docketId}` }],
    externalIds: { gaPsc: String(d.docketId) },
  };
}

export interface IngestSummary {
  totalDockets: number;
  matched: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestGaPscDockets(): Promise<IngestSummary> {
  const dockets = await fetchOpenElectricDockets();
  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const d of dockets) {
    try {
      if (CERTIFICATION_RE.test(d.title)) {
        // A failed filings fetch leaves the step unmanaged rather than dropping the project.
        const filings = await fetchDocketFilings(d.docketId).catch(() => []);
        toUpsert.push(normalizeCertification(d, filings));
        await sleep(REQUEST_DELAY_MS);
      }
    } catch (err) {
      errors.push({ matchKey: String(d.docketId), message: String(err) });
    }
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return { totalDockets: dockets.length, matched: toUpsert.length, upserted, removedResolved, errors };
}

if (require.main === module) {
  ingestGaPscDockets()
    .then((summary) => {
      console.log(
        `Georgia PSC ingestion complete: ${summary.totalDockets} open electric dockets scanned, ` +
          `${summary.matched} matched, upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
