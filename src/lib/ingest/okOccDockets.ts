// Oklahoma Corporation Commission (OCC) High Voltage Transmission Certificate
// of Authority (COA) docket ingestion — one of several states built in
// parallel in the per-state series started with vaSccDockets.ts (see that
// file's header for the overall rationale). Confirmed by hand 2026-08-23 via
// real requests against the live public.occ.ok.gov system — no assumption
// below was taken from documentation or training-data memory alone.
//
// SCOPING — Oklahoma has no generic "Certificate of Public Convenience and
// Necessity" process for electric generation/storage/transmission siting.
// Confirmed by hand by enumerating every one of the 43 real "Relief Types"
// values that appear on real Public Utility Docket (PUD) case filings at
// OCC: the field OCC itself calls "CCN" ("Certificate of Convenience and
// Necessity" — Oklahoma's spelling, not "CPCN") is used almost exclusively
// by TELECOM carriers (CLEC/IXC certification, "CCN - Request"/"CCN -
// Cancel CCN & Tariff"/etc.) — of ~60 real "CCN"-relief-type filings found
// live, zero were electric utilities. The real electric-siting equivalent
// is a *different* relief type entirely: "High Voltage Transmission COA"
// (a Certificate of Authority under Oklahoma's High-Voltage Transmission
// Line Siting Act, Title 17 O.S. § 151 et seq.), which is what this module
// tracks. Confirmed this is genuinely the right (and only) population: of
// only 4 real PUD cases ever filed under this relief type since the imaged-
// document system's 3/21/2022 start date, one is a battery storage project
// building its own dedicated transmission tie line (Black Kettle Energy
// Storage LLC, PUD2025-000066) and three are utility-built bulk
// transmission upgrades (AEP Oklahoma Transmission Co., PUD2025-000069 and
// PUD2026-000001; Three Corners Connector LLC, PUD2026-000004) — exactly
// the "generation/storage/transmission" population this site tracks, and
// confirms the brief's hint that Oklahoma's CPCN-equivalent process is
// narrower than other states': a merchant wind/solar generator that
// doesn't itself build new high-voltage transmission facilities never
// files anything at OCC at all (it deals only with the interconnecting
// utility/SPP, outside OCC's jurisdiction) — there is no separate
// "generation siting" docket type to also search.
//
// FETCHING: OCC's legacy occeweb.com domain that older Oklahoma coverage
// might reference is dead (confirmed 2026-08-23: every path 404s, expired
// TLS cert). The real, current system for documents filed after 3/21/2022
// is public.occ.ok.gov/WebLink, a Laserfiche "WebLink" public portal. Its
// visible UI is an Angular SPA, but — confirmed by reading the compiled
// Angular bundles (app/dist/custom-search/main.js and app/dist/search/
// main.js) to find the real endpoint shapes, then verifying each with a
// real fetch call, not guessed — its backend is three plain, unauthenticated
// JSON endpoints (POST, Content-Type: application/json) requiring NO cookie
// jar / session bootstrap at all (confirmed: a cookieless Node fetch with
// zero prior requests succeeds on the very first call):
//   1. POST /WebLink/CustomSearchService.aspx/GetSearchFormInfo
//      { searchFormID, repoName } -> the OCC-configured public search
//      form's field definitions (used only once, by hand, to discover the
//      real field ids below — not called at runtime).
//   2. POST /WebLink/CustomSearchService.aspx/GetSearchQuery
//      { repoName: "OCC", searchFormID: "ImagedCaseDocumentsfiledafter3212022",
//        queryValues: { "<formId>_InputN": ["value"] } } -> a Laserfiche
//      search-syntax query string. The public search form's own field ids
//      (confirmed live): Input0=Case Number, Input1=Applicant,
//      Input2=Case/Docket Type (we use "Public Utility Docket"), Input3=
//      Document Type, Input4=Order Number, Input5=Relief Types (we use
//      "High Voltage Transmission COA" — the server wildcards this to
//      *High Voltage Transmission COA*), Input6/Input6_end=filing date
//      range.
//   3. POST /WebLink/SearchService.aspx/GetSearchListing
//      { repoName, searchSyn: <query from step 2>, searchUuid: "",
//        sortColumn: "", startIdx, endIdx, getNewListing: true,
//        sortOrder: 1, displayInGridView: true } -> the actual document
//      list, each with a `metadata` array of {name, values} pairs. Real
//      gotcha found only by testing: `sortOrder` must be the NUMBER 1 (a
//      PrimeNG-table sort-direction convention baked into this ASP.NET
//      ScriptService's deserializer), not the string "ASC" — passing a
//      string throws a hard 500 DESERIALIZATION_ERROR with no other clue.
//
// SCOPING QUERY & A REAL MISS IT WOULD OTHERWISE CAUSE: the natural filter
// would be Case/Docket Type="Public Utility Docket" AND Document
// Type="Application". Confirmed by hand this MISSES a real, live docket:
// Three Corners Connector LLC's opening filing in PUD2026-000004 was typed
// "Other Document" by OCC's own clerk, not "Application" — so this module
// deliberately filters on Case/Docket Type + Relief Types only (never
// Document Type), then identifies each case's opening filing by its lowest
// "ECF Docket Entry Number" instead of trusting the Document Type label.
//
// A SECOND REAL GOTCHA — case numbers are NOT unique across Case/Docket
// Type: a bare Case Number search for "2025-000066" (no Case Type filter)
// returned two entirely different dockets merged together — a Conservation
// Docket (CD2025-000066, an oil/gas change-of-operator case) and the real
// Public Utility Docket (PUD2025-000066, Black Kettle's COA case) — because
// OCC numbers each docket type's cases independently starting from 1 each
// year. Every per-case lookup in this module therefore always pairs the
// Case Number filter with the Case/Docket Type filter.
//
// STATUS — the real signal, calibrated against all 4 real cases found live
// (not a hypothetical): every filed document carries a "ECF Document Type"
// and, for actual Commission orders, an additional "Order Type" field with
// a small fixed vocabulary confirmed live: "Motion" (procedural rulings —
// e.g. "ORDER GRANTING MOTION FOR PROCEDURAL ORDER", "ORDER GRANTING MOTION
// TO DETERMINE NOTICE" — real orders that say "GRANTING" but do NOT resolve
// the case), "Final" (the actual disposition — e.g. PUD2025-000069 and
// PUD2026-000001 and PUD2026-000004 each have exactly one Order Type=
// "Final" document, titled "FINAL ORDER GRANTING CERTIFICATE OF AUTHORITY"),
// and a separate "Dismissal Order" ECF Document Type (PUD2025-000066's
// Black Kettle case was closed via "ORDER OF DISMISSAL WITHOUT PREJUDICE",
// whose own "Order Type" field is "Dismissal Order", not "Final"). The
// naive approach — regex "granting" anywhere in an order title — would
// have wrongly resolved every case the first time a procedural motion was
// granted, sometimes months before the real disposition; this module only
// treats a document as dispositive when Order Type is literally "Final" (or
// the ECF Document Type is "Dismissal Order"), then reads the clean
// structured "Order Title" field (not a messy free-text title) for
// granted/denied/dismissed. Across the 4 real cases this yields 3 granted,
// 1 dismissed, 0 still-pending as of 2026-08-23 — see MAX_CANDIDATES for
// what that means for a real run. No real DENIED example exists to
// calibrate DENY_RE against — same gap noted in nvPucnDockets.ts/
// azAccLineSiting.ts for their own unconfirmed DENY_RE.
//
// APPLICANT / FILED DATE / COUNTY: no free-text case title exists to
// extract from (unlike title-based states in this series) — instead pulled
// from each case's own opening filing: "ECF Applicant" (present on every
// party-filed document regardless of Document Type, confirmed on both
// "Application" and Three Corners' "Other Document" filings) and its
// CreationDate (an imaging-system timestamp, not a verified legal filing
// date — dateConfidence "approximate"). No structured county/location field
// exists anywhere in this system, but "Affidavit/Proof of Publication"
// filings' own filenames reliably embed the notice county for a multi-
// county project (confirmed live: PUD2026-000004's two publication
// affidavits are literally named "..._Proof_of_Publication_Cimarron_County_
// filed_on_behalf_of_THREE_CORNERS_..." and "..._Texas_County_...") — used
// as a best-effort signal, not present on every case (Black Kettle's single
// publication affidavit filename has no county in it).
//
// FUEL/PROJECT TYPE & CAPACITY: every real case's Relief Requested text
// (present on Order-type documents once one exists) reads "APPLICATION OF
// ... FOR A CERTIFICATE OF AUTHORITY FOR AN ELECTRIC TRANSMISSION
// FACILITY" — i.e. what OCC is actually certificating is the transmission
// facility itself, even for Black Kettle's storage project (whose docket
// authorizes only the transmission tie line, not the storage asset). Same
// lesson nyDpsDockets.ts/nvPucnDockets.ts already documented for their own
// naming gotchas: classify by what the docket itself certificates, not by
// what the applicant's name suggests. All candidates here are therefore
// classified projectType/fuelType "transmission"; no structured capacity
// (MW/kV) field exists anywhere in this system and no free-text title is
// available to regex it from, so capacityValue is always null — this is
// the one state module in this series where capacity can never be
// populated, called out explicitly in every project's dataQualityNote.
//
// SCALE: only 4 real cases have ever been filed under this relief type
// since the imaged-document system began 3/21/2022 (confirmed complete —
// a single broad query for Relief Types="High Voltage Transmission COA"
// returned exactly 84 documents across exactly 4 distinct case numbers, no
// pagination/truncation). All 4 are already resolved as of 2026-08-23
// (see STATUS), so a real run of this module upserts 0 projects today —
// this is the correct, tested behavior (RESOLVED_STAGES filtering in
// common.ts), not a bug: Oklahoma genuinely has zero currently-pending
// projects in this narrow docket population right now. MAX_CANDIDATES is
// set far above the current population (40 vs. 4 real cases in ~4.4 years)
// purely as headroom for growth, not because today's population is large.
// A case filed before 3/21/2022 cannot appear in this system at all (see
// FETCHING); LOOKBACK_YEARS=6 comfortably covers the system's entire
// history so far without needing to touch the separate, much harder-to-use
// pre-2022 case.occ.ok.gov Oracle APEX system (out of scope — no real
// High Voltage Transmission COA case has ever taken close to 4 years to
// resolve in the population observed, so a pre-2022 filing still being
// actively "waiting" today is not a realistic gap).
//
// A real run against the live site (1 broad search + 4 per-case detail
// fetches, each politeness-delayed) took under 3 seconds — nowhere near
// the 300s cron maxDuration budget even with large future growth headroom.
//
// Wired to Vercel Cron weekly, 01:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-ok-occ/route.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://public.occ.ok.gov/WebLink";
const REPO_NAME = "OCC";
const SEARCH_FORM_ID = "ImagedCaseDocumentsfiledafter3212022";
const INPUT_CASE_NUMBER = `${SEARCH_FORM_ID}_Input0`;
const INPUT_CASE_TYPE = `${SEARCH_FORM_ID}_Input2`;
const INPUT_RELIEF_TYPES = `${SEARCH_FORM_ID}_Input5`;
const CASE_TYPE_PUD = "Public Utility Docket";
const RELIEF_TYPE_COA = "High Voltage Transmission COA";

// Headroom for growth, not a reflection of today's real population — see
// module header SCALE (only 4 real cases have ever been filed under this
// relief type since the imaged-document system began in 2022).
export const MAX_CANDIDATES = 40;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
// See module header SCALE for why a case older than this cannot exist.
const LOOKBACK_YEARS = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WebLinkDocument {
  name: string;
  entryId: number;
  metadata: Record<string, string>;
  creationDate: Date | null;
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Lf-Suppress-Login-Redirect": "1" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OK OCC request to ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `OK OCC response from ${path} wasn't valid JSON — the endpoint shape likely changed. Check postJson in src/lib/ingest/okOccDockets.ts against a fresh response.`,
    );
  }
  const data = (parsed as { data?: unknown }).data;
  if (data === undefined) {
    throw new Error(
      `OK OCC response from ${path} had no "data" field — the endpoint shape likely changed. Check postJson in src/lib/ingest/okOccDockets.ts against a fresh response.`,
    );
  }
  return data;
}

// .NET's M/D/YYYY h:mm:ss AM/PM format, e.g. "12/30/2022 9:04:17 PM" — the
// only date format observed live in WebLink's "data" grid-row array
// (CreationDate/LastModified columns; every other grid column is a leftover
// Oil & Gas Conservation Docket field, always blank for these PUD records).
function parseWebLinkDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(raw.trim());
  if (!m) return null;
  let hour = Number(m[4]) % 12;
  if (/pm/i.test(m[7])) hour += 12;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), hour, Number(m[5]), Number(m[6]));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getSearchQuery(queryValues: Record<string, string[]>): Promise<string> {
  const data = await postJson("CustomSearchService.aspx/GetSearchQuery", {
    repoName: REPO_NAME,
    searchFormID: SEARCH_FORM_ID,
    queryValues,
  });
  if (typeof data !== "string") {
    throw new Error(
      "OK OCC GetSearchQuery response wasn't a string — the endpoint shape likely changed. Check getSearchQuery in src/lib/ingest/okOccDockets.ts against a fresh response.",
    );
  }
  return data;
}

async function getSearchListing(searchSyn: string): Promise<WebLinkDocument[]> {
  const data = await postJson("SearchService.aspx/GetSearchListing", {
    repoName: REPO_NAME,
    searchSyn,
    searchUuid: "",
    sortColumn: "",
    startIdx: 0,
    // Generous headroom over the real observed population (84 documents
    // across all 4 cases ever filed) — see module header SCALE. No
    // pagination cap was hit or tested beyond that real count.
    endIdx: 2000,
    getNewListing: true,
    // Must be the NUMBER 1, not the string "ASC" — see module header
    // FETCHING #3 for the real 500 DESERIALIZATION_ERROR this caused when
    // guessed as a string.
    sortOrder: 1,
    displayInGridView: true,
  });
  const results = (data as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    throw new Error(
      "OK OCC GetSearchListing response had no results array — the endpoint shape likely changed. Check getSearchListing in src/lib/ingest/okOccDockets.ts against a fresh response.",
    );
  }
  return (results as Record<string, unknown>[]).map((r) => {
    const metadata: Record<string, string> = {};
    const metadataArr = (r.metadata as { name?: string; values?: string[] }[] | null) ?? [];
    for (const m of metadataArr) {
      if (m.name) metadata[m.name] = (m.values ?? []).join("; ");
    }
    const dataRow = (r.data as string[] | undefined) ?? [];
    // Column 11 (0-indexed) of the grid's own "data" row is CreationDate —
    // confirmed against the live column definitions in the same response.
    return {
      name: String(r.name ?? ""),
      entryId: Number(r.entryId ?? 0),
      metadata,
      creationDate: parseWebLinkDate(dataRow[11]),
    };
  });
}

async function searchByRelief(): Promise<WebLinkDocument[]> {
  const query = await getSearchQuery({
    [INPUT_CASE_TYPE]: [CASE_TYPE_PUD],
    [INPUT_RELIEF_TYPES]: [RELIEF_TYPE_COA],
  });
  return getSearchListing(query);
}

async function searchByCaseNumber(caseNumber: string): Promise<WebLinkDocument[]> {
  const query = await getSearchQuery({
    [INPUT_CASE_NUMBER]: [caseNumber],
    [INPUT_CASE_TYPE]: [CASE_TYPE_PUD],
  });
  return getSearchListing(query);
}

// Order-type documents carry "Case Number" (PUD-prefixed, e.g.
// "PUD2025-000066"); party-filed documents carry "ECF Case Number" (bare,
// e.g. "2025-000066") instead — see module header for why both are needed.
function deriveCaseNumber(doc: WebLinkDocument): string | null {
  const ecf = doc.metadata["ECF Case Number"];
  if (ecf) return ecf;
  const prefixed = doc.metadata["Case Number"];
  if (prefixed) return prefixed.replace(/^PUD/i, "");
  return null;
}

interface CaseResolution {
  resolution: "granted" | "denied" | "dismissed" | null;
}

const GRANT_RE = /\bgrant/i;
const DENY_RE = /\bden(?:y|ial|ying|ied)\b/i;

// See module header STATUS: only Order Type "Final" (or ECF Document Type
// "Dismissal Order") is dispositive — a "Motion"-type order can also say
// "GRANTING" (e.g. "ORDER GRANTING MOTION FOR PROCEDURAL ORDER") without
// resolving the case at all.
function determineResolution(docs: WebLinkDocument[]): CaseResolution {
  const dismissal = docs.find(
    (d) => d.metadata["ECF Document Type"] === "Dismissal Order" || d.metadata["Order Type"] === "Dismissal Order",
  );
  if (dismissal) return { resolution: "dismissed" };

  const finalOrders = docs
    .filter((d) => d.metadata["Order Type"] === "Final")
    .sort((a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0));
  if (finalOrders.length === 0) return { resolution: null };

  const title = finalOrders[0].metadata["Order Title"] ?? "";
  if (DENY_RE.test(title)) return { resolution: "denied" };
  if (GRANT_RE.test(title)) return { resolution: "granted" };
  return { resolution: null };
}

// The case's opening filing — identified by lowest ECF Docket Entry Number,
// NOT by Document Type="Application" (see module header for the real
// docket, PUD2026-000004, whose opening filing OCC's own clerk typed
// "Other Document").
function findOpeningFiling(docs: WebLinkDocument[]): WebLinkDocument | null {
  const filed = docs.filter((d) => d.metadata["ECF Applicant"] && d.metadata["ECF Docket Entry Number"]);
  if (filed.length === 0) return null;
  filed.sort((a, b) => Number(a.metadata["ECF Docket Entry Number"]) - Number(b.metadata["ECF Docket Entry Number"]));
  return filed[0];
}

// Best-effort: the county a public-notice affidavit was published in,
// pulled from the filing's own filename convention (no structured county
// field exists anywhere in this system) — see module header APPLICANT /
// FILED DATE / COUNTY.
const PUBLICATION_COUNTY_RE = /Publication_([A-Za-z]+(?:_[A-Za-z]+)*)_County/i;

function extractCounties(docs: WebLinkDocument[]): string | null {
  const counties = new Set<string>();
  for (const d of docs) {
    const m = PUBLICATION_COUNTY_RE.exec(d.name);
    if (m) counties.add(m[1].replace(/_/g, " "));
  }
  return counties.size > 0 ? [...counties].join(", ") : null;
}

interface Candidate {
  caseNumber: string;
  earliestDate: Date | null;
}

export interface IngestSummary {
  candidateDocuments: number;
  realCaseCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

function normalizeCase(caseNumber: string, docs: WebLinkDocument[], resolution: CaseResolution): NormalizedProject | null {
  const opening = findOpeningFiling(docs);
  const applicant = opening?.metadata["ECF Applicant"] ?? `OCC Docket ${caseNumber}`;
  const filedDate = opening?.creationDate ?? null;
  const county = extractCounties(docs);
  // Deep link to the case's opening filing document — confirmed live to
  // resolve (redirects through WebLink's normal cookie-check flow, which a
  // real browser handles transparently; see module header FETCHING).
  const sourceEntryId = opening?.entryId ?? docs[0]?.entryId ?? null;

  const matchKey = resolveMatchKey("ok-occ", caseNumber);

  let currentStage: ProjectStage;
  if (resolution.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution.resolution === "denied" || resolution.resolution === "dismissed") currentStage = "cancelled";
  else currentStage = "local_review";

  const projectType: ProjectType = "transmission";
  const fuelType: FuelType = "transmission";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Oklahoma Corporation Commission's High Voltage Transmission Line Siting Act Certificate of Authority (COA) docket records (Public Utility Docket case type).",
    "OCC does not publish a case \"Status\" field; \"still waiting\" here is inferred from scanning every filed document for a Commission order whose own structured \"Order Type\" field is \"Final\" (not a procedural \"Motion\" order, which can also say \"granting\" without resolving the case) — see the ingestion module header for how this was calibrated against all 4 real cases filed under this docket type since 2022.",
    "This docket certificates the transmission facility itself, not necessarily the generation/storage asset it may serve (e.g. a storage project's own dedicated tie-line) — see the ingestion module header.",
    "No structured or free-text capacity (MW/kV) field exists in this docket source, so capacity is never populated for Oklahoma projects.",
  ];
  if (county) {
    dataQualityNoteParts.push(`Public notice for this docket was published in ${county} County, Oklahoma, per the filename of a filed publication affidavit — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (OK OCC Case ${caseNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "OK",
    county,
    capacityValue: null,
    capacityUnit: null,
    applicationFiledDate: filedDate,
    dateConfidence: "approximate",
    currentStatus: `Oklahoma OCC PUD Case ${caseNumber}: ${resolution.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a High Voltage Transmission Certificate of Authority from the Oklahoma Corporation Commission — PUD Case No. ${caseNumber}, filed by ${applicant}`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `OK OCC PUD Case No. ${caseNumber}`,
        url: sourceEntryId
          ? `${BASE_URL}/DocView.aspx?id=${sourceEntryId}&dbid=0&repo=${REPO_NAME}`
          : `${BASE_URL}/Search.aspx?dbid=0&repo=${REPO_NAME}`,
      },
    ],
    externalIds: { okOcc: caseNumber },
  };
}

export async function ingestOkOccDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const broadDocs = await searchByRelief();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const byCase = new Map<string, WebLinkDocument[]>();
  for (const doc of broadDocs) {
    const caseNumber = deriveCaseNumber(doc);
    if (!caseNumber) continue;
    if (!byCase.has(caseNumber)) byCase.set(caseNumber, []);
    byCase.get(caseNumber)!.push(doc);
  }

  const candidates: Candidate[] = selectWithRotation(
    [...byCase.entries()]
      .map(([caseNumber, docs]) => {
        const dates = docs.map((d) => d.creationDate).filter((d): d is Date => d != null);
        const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
        return { caseNumber, earliestDate };
      })
      .filter((c) => c.earliestDate == null || c.earliestDate >= cutoff)
      .sort((a, b) => (b.earliestDate?.getTime() ?? 0) - (a.earliestDate?.getTime() ?? 0)),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      // Re-fetches the full per-case document set rather than reusing the
      // broad query's results — guards against the broad query's endIdx
      // cap and against a future order document that doesn't happen to
      // carry the same Relief Types tag as its case's opening filing.
      const docs = await searchByCaseNumber(candidate.caseNumber);
      const resolution = determineResolution(docs);
      const normalized = normalizeCase(candidate.caseNumber, docs, resolution);
      if (normalized) toUpsert.push(normalized);
    } catch (err) {
      errors.push({ matchKey: candidate.caseNumber, message: String(err) });
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
    candidateDocuments: broadDocs.length,
    realCaseCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestOkOccDockets()
    .then((summary) => {
      console.log(
        `Oklahoma OCC High Voltage Transmission COA docket ingestion complete: ${summary.candidateDocuments} documents scanned, ` +
          `${summary.realCaseCandidates} real docket candidates within the ${LOOKBACK_YEARS}-year lookback, ` +
          `upserted ${summary.upserted}, removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
