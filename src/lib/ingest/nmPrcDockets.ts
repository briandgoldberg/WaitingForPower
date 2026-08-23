// New Mexico Public Regulation Commission (NM PRC) docket ingestion — one
// of several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23.
//
// FETCHING: prc.nm.gov's public docket search links to
// e360.prc.nm.gov/portal/public/ ("PRCe360"), an Angular SPA — but confirmed
// by hand (via the browser's own network tab, then independently replayed
// with plain unauthenticated curl, no cookies/session/auth required) that it
// is backed by a real JSON API, no headless browser needed:
//   - Search: POST /core/api/apiflow/v1/prc/nm/intake/casedetails/getAll —
//     body shape confirmed from a live request capture (see
//     buildSearchBody below); the only fields that matter are
//     parameters.caseType ("UTILITY") and parameters.caseCategory (an array
//     of category codes, confirmed "CCN_PPA" via the Advanced Search UI's
//     own category dropdown — see SCOPING). Returns `items` with a clean
//     pre-parsed `casedocketnumber`, `casedatacaption`, `casedatastatus`,
//     `caseprimarycompany`, `createdon`, and an internal `id` (a GUID, not
//     the public docket number) used for the per-candidate detail fetch.
//   - Detail: POST /core/api/apiflow/v1/prc/nm/intake/casepublicdocument/
//     getAll with `parameters.caseId` = that internal GUID, returns every
//     public pleading/order filed in the case (documentname, documenttype,
//     fileddate) — used only to cross-check STATUS below, not for basic
//     fields (the search response already has everything else).
//   - Public source link for site visitors: e360.prc.nm.gov/portal/public/
//     #/public/nm-prc/en/CaseXscreen?screen=external-Case360&caseId={id} —
//     confirmed by hand this renders the same docket with no login prompt
//     when navigated to directly (a fresh tab with no prior SPA state does
//     redirect to the portal home, but that's a client-side routing quirk,
//     not an auth gate — the underlying data API call it makes once loaded
//     is the same unauthenticated endpoint above).
// Confirmed gotcha: the server is noticeably flaky — repeated identical
// GETs to the docketCategory lookup endpoint returned HTTP 500 roughly half
// the time in testing (both from curl and from the live Angular app itself,
// visibly retrying its own spinner). The category codes don't need to be
// looked up at runtime (CCN_PPA is a fixed, confirmed value — see SCOPING),
// so this module never calls that flaky endpoint; the actual search/detail
// endpoints used here were reliable across ~15 real test calls, but
// fetchJson still retries once after a short delay as a defensive measure
// given the server's observed flakiness.
//
// SCOPING: NM's statutory name for a CPCN is literally "Certificate of
// Public Convenience and Necessity" (NMSA 1978 § 62-9-1). The Advanced
// Search UI's own Docket Category dropdown (fetched from
// /cms/lookup/docketCategory?caseType=UTILITY) has a single category
// covering it: "Resource: Certificate of Convenience and Necessity (CCN)
// /Power Purchase Agreement (PPA)" (code CCN_PPA) — confirmed this is the
// right one by selecting it in the live UI and reading the resulting
// search request's own body. Confirmed gotcha: NM PRC regulates water and
// sewer utilities through the same docket system, and CCN applications for
// water infrastructure land in this exact same CCN_PPA category — a live
// 6-record CCN_PPA search (2026-08-23, no date filter, so effectively
// this system's full history) included docket 26-0000095, "...NEW MEXICO
// WATER SERVICE COMPANY FOR A CERTIFICATE OF CONVENIENCE AND NECESSITY...
// PFAS TREATMENT FACILITIES...ELEPHANT BUTTE WATER SYSTEM" — nothing in the
// structured fields distinguishes it from an electric CCN, so this module
// excludes it locally via NON_ELECTRIC_RE against the caption text (see
// below). Confirmed gotcha #2: the same 6-record search included a second
// record for the same underlying PNM transmission project (Rio Puerco to
// Pajarito to Prosperity 345kV line) with `casedocketnumber: null` and
// `casedatastatus: "Rejected"` — this is an e-filing *intake* rejection
// (the submission never got a real docket number assigned), not a
// Commission ruling on the merits; the real docket for that project is a
// separate record, 26-0000041, which does have a real docket number.
// Candidates with a null docketNumber are excluded — they were never a
// real case.
//
// STATUS: unlike South Carolina and Arizona (see those modules' headers),
// NM's own `casedatastatus` field ("Active" / "Closed" / "Rejected" — the
// only three values observed across a live 714-record sample of a
// different category, Rate Case, used to check the field's full
// vocabulary) held up under testing rather than lying. Calibrated against
// three real dockets with independently-checked outcomes (2026-08-23):
//   - 26-0000095 (water CCN), status "Closed" — its pleading-documents list
//     includes a document literally named "FINAL ORDER". Correctly closed.
//   - 25-00089-UT (PNM's original Rio Puerco transmission CCN filing),
//     status "Closed" — its documents list includes "FINAL ORDER DISMISSING
//     APPLICATION WITHOUT PREJUDICE," and the same project was immediately
//     refiled as a new docket (26-0000041). Correctly closed.
//   - 26-0000041 (that refiled Rio Puerco docket), status "Active" — its
//     newest document (filed 2026-08-19, the day before this check) is
//     "Order Vacating Hearing and Admitting Evidence," a procedural order,
//     with no final order anywhere in its history. Correctly still active.
// Also spot-checked the two other in-scope Active dockets (26-0000137,
// 26-0000114) the same way: both have substantial procedural histories
// (scheduling orders, intervention motions, confidentiality agreements)
// but no document resembling a final ruling. Given this, `casedatastatus`
// is used as the primary signal, but every candidate's documents are still
// fetched and scanned for a "final order"-shaped filename as a defensive
// cross-check (classifyResolution below) rather than trusting the status
// string blindly — consistent with this series' standing practice, even
// though in NM's case the field turned out to be trustworthy.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields; caption-text
// keyword extraction, same approach and caveats as the other keyword-based
// sources in this series. One NM-specific wrinkle: this CCN_PPA category
// also catches broad multi-resource procurement dockets, not just
// single-project siting applications — e.g. 26-0000114, PNM's application
// covering "PURCHASED POWER AGREEMENTS, ENERGY STORAGE AGREEMENTS, AND
// CERTIFICATE OF PUBLIC CONVENIENCE AND NECESSITY FOR 2029-2032 SYSTEM
// RESOURCES AND THE ABANDONMENT OF THE FOUR CORNERS POWER PLANT" in one
// docket. PORTFOLIO_RE flags these in the data-quality note rather than
// silently presenting them as a single physical project.
//
// NOT WIRED TO CRON YET, same as the other per-state modules. Also
// politeness-delayed between per-candidate detail requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://e360.prc.nm.gov";
const SEARCH_PATH = "/core/api/apiflow/v1/prc/nm/intake/casedetails/getAll";
const DOCUMENTS_PATH = "/core/api/apiflow/v1/prc/nm/intake/casepublicdocument/getAll";
const CASE_TYPE_UTILITY = "UTILITY";
// Confirmed via the Advanced Search UI's own Docket Category dropdown — see
// module header SCOPING.
const CATEGORY_CCN_PPA = "CCN_PPA";

export const MAX_CANDIDATES = 100;
const REQUEST_DELAY_MS = 250;
// The entire CCN_PPA category's history (confirmed 2026-08-23) is a
// handful of records, all from late 2025 onward — this e360 system appears
// to only cover dockets since NM PRC's migration to it; nothing older is
// reachable here (the legacy edocket.nmprc.state.nm.us system requires a
// manual, human-approved guest-account registration, so isn't used by this
// module). A generous page size costs nothing given the real volume.
const SEARCH_PAGE_SIZE = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses (e.g.
// "PUBLIC SERVICE COMPANY OF NEW MEXICO&#8217;S APPLICATION...") — same
// approach as scPscDockets.ts/txPuctDockets.ts, not a full HTML-entity
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

interface SearchParameters {
  docketNumber: string;
  caseType: string;
  caseCategory: string[];
  caseCategories: string;
  other: string;
  caseCaption: string;
  status: string[];
  statuses: string;
  partyName: string;
  primaryPartyCompany: string[];
  primaryPartyCompanies: string;
  caseFiledDateFrom: string;
  caseFiledDateTo: string;
  confirmationId: string;
  cancel: boolean;
  reset: boolean;
  submit: boolean;
  searchTerm: string;
}

// Confirmed live 2026-08-23 by capturing the Advanced Search UI's own XHR
// request body when submitting a real search from the browser — see module
// header FETCHING.
function buildSearchBody(pageSize: number) {
  const parameters: SearchParameters = {
    docketNumber: "",
    caseType: CASE_TYPE_UTILITY,
    caseCategory: [CATEGORY_CCN_PPA],
    caseCategories: JSON.stringify([CATEGORY_CCN_PPA]),
    other: "",
    caseCaption: "",
    status: [],
    statuses: "",
    partyName: "",
    primaryPartyCompany: [""],
    primaryPartyCompanies: "",
    caseFiledDateFrom: "",
    caseFiledDateTo: "",
    confirmationId: "",
    cancel: false,
    reset: false,
    submit: true,
    searchTerm: "",
  };
  return {
    data: {},
    origin: "",
    origin_key: "CaseX",
    queryParams: [],
    gridInput: { params: { parameters }, persistPrevParams: false },
    parameters,
    pageNo: 1,
    pageSize,
    sortBy: {},
  };
}

interface RawSearchItem {
  casedocketnumber: string | null;
  confirmationnumber: string | null;
  casedatacaption: string;
  casedatastatus: string;
  caseprimarycompany: string;
  createdon: string;
  id: string;
}

interface DocketSearchResult {
  caseId: string;
  docketNumber: string;
  caption: string;
  status: string;
  company: string;
  filedDate: Date | null;
}

// Retries once after a short delay — see module header FETCHING for the
// observed server flakiness this defends against.
async function fetchJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as T;
    if (attempt === 2) {
      throw new Error(`NM PRC request failed (${res.status}) after retry: ${url}`);
    }
    await sleep(1000);
  }
  throw new Error(`NM PRC request failed: ${url}`);
}

interface SearchResponse {
  statusCode: number;
  totalItemCount: number;
  items: RawSearchItem[];
}

async function searchCandidates(): Promise<DocketSearchResult[]> {
  const body = buildSearchBody(SEARCH_PAGE_SIZE);
  const data = await fetchJson<SearchResponse>(SEARCH_PATH, body);
  if (!Array.isArray(data.items)) {
    throw new Error(
      "NM PRC search response didn't contain an items array — the API shape likely changed. Check searchCandidates in src/lib/ingest/nmPrcDockets.ts against a fresh response.",
    );
  }
  const results: DocketSearchResult[] = [];
  for (const item of data.items) {
    // Excludes intake-rejected duplicate submissions that never got a real
    // docket number — see module header SCOPING, gotcha #2.
    if (!item.casedocketnumber) continue;
    results.push({
      caseId: item.id,
      docketNumber: item.casedocketnumber,
      caption: decodeHtmlEntities(item.casedatacaption),
      status: item.casedatastatus,
      company: decodeHtmlEntities(item.caseprimarycompany),
      filedDate: parseIsoDate(item.createdon),
    });
  }
  return results;
}

interface RawDocument {
  documentname: string;
  documenttype: string;
  fileddate: string;
}

interface DocumentsResponse {
  totalItemCount: number;
  items: RawDocument[];
}

async function fetchDocuments(caseId: string): Promise<RawDocument[]> {
  const parameters = { caseId, searchTerm: "" };
  const body = {
    data: {},
    origin: "",
    origin_key: "CaseX",
    queryParams: ["caseId"],
    gridInput: { params: { parameters }, persistPrevParams: false },
    parameters,
    pageNo: 1,
    pageSize: 100,
    sortBy: {},
  };
  const data = await fetchJson<DocumentsResponse>(DOCUMENTS_PATH, body);
  if (!Array.isArray(data.items)) {
    throw new Error(
      "NM PRC documents response didn't contain an items array — the API shape likely changed. Check fetchDocuments in src/lib/ingest/nmPrcDockets.ts against a fresh response.",
    );
  }
  return data.items;
}

function parseIsoDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Resolution = "granted" | "denied" | "dismissed" | null;

const DENY_RE = /\bdeny(?:ing|al)?\b/i;
const DISMISS_RE = /\bdismiss(?:ing|ed)?\b/i;
const FINAL_ORDER_RE = /\bfinal order\b/i;

// Cross-checks `casedatastatus` against the docket's actual document
// history rather than trusting it blindly — see module header STATUS.
function classifyResolution(documents: RawDocument[]): { hasFinalOrder: boolean; resolution: Resolution } {
  let hasFinalOrder = false;
  let resolution: Resolution = null;
  for (const doc of documents) {
    if (!FINAL_ORDER_RE.test(doc.documentname)) continue;
    hasFinalOrder = true;
    if (DISMISS_RE.test(doc.documentname)) {
      resolution = "dismissed";
      break;
    }
    if (DENY_RE.test(doc.documentname)) {
      resolution = "denied";
      break;
    }
    // A "FINAL ORDER" with no denial/dismissal language is treated as a
    // grant — same best-effort assumption as azAccLineSiting.ts (no
    // confirmed real denial was observed in NM's CCN_PPA history to
    // calibrate against either).
    resolution = "granted";
  }
  return { hasFinalOrder, resolution };
}

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(combined cycle|combustion turbine|natural gas|gas[- ]fired|gas plant)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Checked before any fuel keyword, same reasoning as the other
// keyword-based sources in this series: a transmission line's own
// route/substation names (e.g. "345KV") shouldn't be misread as a
// generation fuel.
const TRANSMISSION_RE = /\btransmission\b|\bkv\b|\bsubstation\b/i;
const STORAGE_RE = /\benergy storage\b|\bbattery\b|\bbess\b/i;

// See module header SCOPING gotcha #1 — water/sewer utility CCN
// applications land in the same CCN_PPA category as electric ones.
const NON_ELECTRIC_RE = /\bwater\b|\bsewer\b|\bwastewater\b/i;

// See module header FUEL/PROJECT TYPE — flags multi-resource procurement
// dockets that don't represent one single physical project.
const PORTFOLIO_RE = /\bsystem resources\b|\bportfolio\b|\babandonment\b/i;

function inferProjectType(caption: string): ProjectType {
  if (TRANSMISSION_RE.test(caption)) return "transmission";
  if (STORAGE_RE.test(caption)) return "storage";
  return "generation";
}

function inferFuelType(caption: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(caption)) return fuel;
  }
  return "other";
}

function extractCapacityMw(caption: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW(?:ac)?\b/i.exec(caption);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function extractCounty(caption: string): string | null {
  const m = /\bin\s+([A-Z][A-Za-z.'\s]*?)\s+Count(?:y|ies),?\s+New\s+Mexico/i.exec(caption);
  return m ? m[1].trim() : null;
}

function normalizeDocket(
  search: DocketSearchResult,
  documents: RawDocument[],
): NormalizedProject {
  const matchKey = resolveMatchKey("nm-prc", search.docketNumber);
  const projectType = inferProjectType(search.caption);
  const fuelType = inferFuelType(search.caption, projectType);
  const capacityMw = extractCapacityMw(search.caption);
  const county = extractCounty(search.caption);
  const isPortfolio = PORTFOLIO_RE.test(search.caption);

  const { hasFinalOrder, resolution } = classifyResolution(documents);
  const isActive = search.status === "Active" && !hasFinalOrder;

  let currentStage: ProjectStage;
  if (!isActive) {
    currentStage = resolution === "denied" || resolution === "dismissed" ? "cancelled" : "approved_awaiting_construction";
  } else {
    currentStage = "local_review";
  }

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the New Mexico Public Regulation Commission's PRCe360 public e-filing and case-management portal.",
  ];
  if (hasFinalOrder) {
    dataQualityNoteParts.push(
      `Docket status field reads "${search.status}" but a document matching "final order" was found in its filing history, so this is treated as resolved rather than still waiting — see the ingestion module header for how this was calibrated.`,
    );
  }
  if (isPortfolio) {
    dataQualityNoteParts.push(
      "This docket covers a broader multi-resource procurement request (e.g. purchased power agreements and/or a resource portfolio) rather than a single physical project — treat capacity/fuel type as an approximation of the docket's dominant subject, not one discrete facility.",
    );
  }
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket caption text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, New Mexico, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${search.company} (NM PRC Docket ${search.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "NM",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: search.filedDate,
    dateConfidence: "exact",
    currentStatus: `New Mexico PRC docket ${search.docketNumber}: ${isActive ? "active" : (resolution ?? "closed")}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the New Mexico Public Regulation Commission — Docket No. ${search.docketNumber}, "${search.caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `NM PRC Docket No. ${search.docketNumber}`,
        url: `${BASE_URL}/portal/public/#/public/nm-prc/en/CaseXscreen?screen=external-Case360&caseId=${search.caseId}`,
      },
    ],
    externalIds: { nmPrc: search.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  electricCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestNmPrcDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allCandidates = await searchCandidates();
  const candidates = allCandidates
    .filter((c) => !NON_ELECTRIC_RE.test(c.caption))
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const documents = await fetchDocuments(candidate.caseId);
      toUpsert.push(normalizeDocket(candidate, documents));
    } catch (err) {
      errors.push({ matchKey: candidate.docketNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: allCandidates.length,
    electricCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestNmPrcDockets()
    .then((summary) => {
      console.log(
        `New Mexico PRC docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.electricCandidates} electric (non-water/sewer) CCN applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
