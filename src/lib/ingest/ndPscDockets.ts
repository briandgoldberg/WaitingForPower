// North Dakota Public Service Commission (PSC) Energy Conversion and
// Transmission Facility siting permit ingestion — one of several states
// built in parallel in the per-state series started with vaSccDockets.ts
// (see that file's header for the overall rationale). Confirmed by hand
// 2026-08-25 via real GET/POST requests (Node's own `fetch`) against the
// live apps.psc.nd.gov site — no assumption below was taken from
// documentation or training-data memory alone.
//
// SCOPING: unlike the WA/OR/MA/CT/NH/RI split found elsewhere in this
// series, North Dakota's PSC genuinely is its own real siting authority —
// confirmed live via its own case-search form, which exposes a real,
// structured `caseTypeCode="Siting Application"` (under
// `jurisdictionId="PU"`, "Public Utilities") with a `caseCategoryCode` of
// "Electric" or "Pipeline" on real filed cases. This lines up with N.D.C.C.
// Ch. 49-22 (the Energy Conversion and Transmission Facility Siting Act),
// which requires a Certificate of Corridor Compatibility and a Route
// Permit before construction. Only "Electric" and "Pipeline" categories
// are ingested — confirmed live to be the only two real category values
// this case type uses.
//
// FETCHING: apps.psc.nd.gov/cases is a plain POST-form search
// (pscasesearch), no auth, no CAPTCHA. `caseYear` narrows results to one
// filing year at a time — confirmed live to work cleanly (e.g. caseYear=26
// returns exactly the 8 real 2026 siting-application cases). Broader
// filters were tried and rejected: `filedFromDate` triggers a real
// server-side 500 (confirmed live, several format variants tried, all
// failed identically) and the site's own GET-based `pagepscs?page=N`
// pagination did not carry search-result state across requests in testing
// (returned zero rows on page 2 even with the search POST's session cookie
// forwarded) — the caseYear loop sidesteps both problems entirely, same
// per-year-loop shape as sdPucDockets.ts in this series.
//
// STALE/UNRELIABLE "Date Closed" FIELD — a real, confirmed finding, the
// same class of bug found in sdPucDockets.ts and documented for LPSC
// (laPscDockets.ts): a case's own "Date Closed" field on its detail page is
// NOT a reliable signal that a case is still pending. PU-14-853 (filed
// 2014, 72 docket entries) and PU-24-079 (filed 2024, a real granted-and-
// reissued certificate order dated 2024-04-29) both show a blank
// "Date Closed" despite one having a real, confirmed final Commission
// Order. This module therefore ignores "Date Closed"/caseStatusCode
// entirely for resolution purposes and instead scans each candidate's own
// docket-entry list for a real "Order" entry (Type="Order", filed by the
// Public Service Commission itself) — the only place this source's real
// resolution status lives.
//
// ORDER PDF PARSING — a first for this series: ND's own docket entries
// link to a real PDF order document (predictable-looking but not
// guessable path, e.g. .../webdocs/case/24-0079/020-010.pdf — confirmed
// the docket-ENTRY's own detail page, not the case page, is what reveals
// the real file path), and the "Order" docket-entry description text
// itself is NOT descriptive enough to tell grant from denial (it's
// typically the literal word "Order"). This module fetches that PDF (via
// the `pdf-parse` package — new to this project, added specifically for
// this module; confirmed introduces no new `npm audit` findings beyond
// this project's pre-existing xlsx/prisma advisories) and scans its real
// extracted text for disposition language. Real confirmed phrasings
// (PU-24-079's real 2024-04-29 order, a certificate-transfer grant): "...
// is approved." followed by "... are issued to <Entity>." — see
// GRANT_RE/DENY_RE/DISMISS_RE below, which also cover the more standard
// "IT IS ORDERED that the Application ... is granted/denied" phrasing this
// project's other order-scanning modules (wvPscDockets.ts, etc.) have
// found elsewhere, on the assumption ND uses similar boilerplate for a
// fresh new-facility grant/denial even though the one order fetched during
// this module's research happened to be a certificate-transfer matter, not
// a first-time siting grant. Flagged as based on one confirmed real
// example plus a reasonable generalization, not an exhaustive sample —
// same "confirmed one real case, documented the basis, iterate later if
// wrong" convention this series already uses elsewhere (see
// vtPucDockets.ts's own REAL REGEX GOTCHA note).
//
// EXCLUDED: cases whose own Description contains "Transfer" — a real,
// confirmed pattern (PU-24-079: "Joint Consolidated Application for
// Transfer of Certificates of Corridor Compatibility and Route Permits")
// for moving an ALREADY-ISSUED certificate to a new owner, not a new
// facility awaiting its first siting decision — same exclusion rationale
// as vtPucDockets.ts's amendment-petition exclusion.
//
// LOCATION: real descriptions consistently end with a county reference —
// e.g. "230 kV Transmission Line - McHenry and Ward Cntys", "Little
// Missouri Gas Plant Expansion - McKenzie", "Agassiz Transmission Line &
// Substation - Cass Cty" — extracted here with a plain "- <Name(s)>
// Cty/Cntys/County/Counties" scan.
//
// SCOPE WINDOW: real siting-application cases go back to at least 2014
// (the earliest sampled), but this module only scans the last 5 filing
// years (see YEARS_TO_SCAN) — a case that old has almost certainly long
// since resolved one way or another, and re-verifying it would cost a real
// case-detail fetch (plus, for many, an order-PDF fetch) for zero "still
// relevant" benefit. A case that ages out of this window is left at its
// last-known real stage, not guessed into a resolved one — same convention
// as every other module in this series post-2026-08-25 (see common.ts).
//
// Wired to Vercel Cron weekly (see vercel.json and
// src/app/api/cron/ingest-nd-psc/route.ts — left for the maintainer to
// finalize the schedule and route).

import { PDFParse } from "pdf-parse";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://apps.psc.nd.gov/cases";
const USER_AGENT = "Mozilla/5.0 (compatible; WaitingForPowerBot/1.0)";
const CASE_TYPE_CODE = "Siting Application            "; // real value, trailing spaces confirmed live

// See module header SCOPE WINDOW. Real measured timing 2026-08-25: 47 real
// candidates (each needing a case-detail fetch and, for resolved ones, an
// additional docket-entry fetch + order-PDF fetch/parse) took ~157s
// end-to-end — the per-candidate detail+order-PDF path is the most
// expensive of any module in this series. MAX_CANDIDATES is capped well
// below the real ~140/candidates-per-300s-budget ceiling that timing
// implies, not left at this series' usual generous headroom, specifically
// to stay safely under the 300s Vercel cron budget as the real population
// grows.
const YEARS_TO_SCAN = 5;
export const MAX_CANDIDATES = 70;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function postForm(path: string, params: Record<string, string>): Promise<string> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT, Accept: "text/html" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`ND PSC POST ${path} failed (${res.status})`);
  return res.text();
}

async function getPage(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!res.ok) throw new Error(`ND PSC GET ${path} failed (${res.status})`);
  return res.text();
}

interface CaseListing {
  getId: string;
  getId2: string;
  caseNumber: string;
  description: string;
  category: string;
  entities: string[];
  filedDate: Date | null;
}

// Confirmed live 2026-08-25 against real pscasesearch results-table rows.
const ROW_RE =
  /<strong class="nowrap"><a href="pscasedetail\?getId=(\d+)&getId2=(\d+)"[^>]*>(PU-\d+-\d+)<\/a><\/strong><br \/>\s*<small><strong>([^<]*)<\/strong><\/small>\s*<\/td>\s*<td>\s*Siting Application\s*<br \/><small><strong>([^<]*)<\/strong><\/small>\s*<\/td>\s*<td>\s*<ul>([\s\S]*?)<\/ul>\s*<\/td>\s*<td class="center">\d+<\/td>\s*<td>([^<]*)<\/td>/g;

function parseSearchResults(html: string): CaseListing[] {
  const out: CaseListing[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    const [, getId, getId2, caseNumber, descriptionRaw, category, entitiesHtml, filedRaw] = m;
    const entities = [...entitiesHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)]
      .map((e) => decodeHtmlEntities(e[1]))
      .filter((e) => e.length > 0);
    const [yy, mm, dd] = filedRaw.trim().split(".").map(Number);
    const filedDate = yy && mm && dd ? new Date(yy, mm - 1, dd) : null;
    out.push({
      getId,
      getId2,
      caseNumber,
      description: decodeHtmlEntities(descriptionRaw),
      category: category.trim(),
      entities,
      filedDate: filedDate && !Number.isNaN(filedDate.getTime()) ? filedDate : null,
    });
  }
  return out;
}

async function searchYear(year: string): Promise<CaseListing[]> {
  const html = await postForm("pscasesearch", {
    jurisdictionId: "PU",
    caseTypeCode: CASE_TYPE_CODE,
    caseYear: year,
    search: "Search",
  });
  return parseSearchResults(html);
}

// Real category values confirmed live on actual case data — "Electric" and
// "Pipeline" only; anything else (not observed) is out of scope for this
// site's project taxonomy.
const CATEGORY_ALLOWLIST = new Set(["Electric", "Pipeline"]);

// See module header EXCLUDED.
const TRANSFER_RE = /\btransfer\b/i;

interface DocketEntry {
  getId3: string;
  type: string;
}

// Confirmed live 2026-08-25 against real pscasedetail docket-entry rows.
const DOCKET_ENTRY_RE =
  /<a href="psdocketdetail\?getId=\d+&getId2=\d+&getId3=(\d+)"[^>]*>[^<]*<\/a>\s*<br \/><strong><small>([^<]*)<\/small><\/strong>/g;

function parseDocketEntries(html: string): DocketEntry[] {
  return [...html.matchAll(DOCKET_ENTRY_RE)].map((m) => ({ getId3: m[1], type: m[2].trim() }));
}

const PDF_LINK_RE = /href="(https:\/\/www\.psc\.nd\.gov\/webdocs\/[^"\s]+\.pdf)/i;

async function findOrderPdfUrl(getId: string, getId2: string, getId3: string): Promise<string | null> {
  const html = await getPage(`psdocketdetail?getId=${getId}&getId2=${getId2}&getId3=${getId3}`);
  const m = PDF_LINK_RE.exec(html);
  return m ? m[1] : null;
}

// See module header ORDER PDF PARSING — one confirmed real example
// ("... is approved." / "... are issued to <Entity>.") plus the more
// standard "IT IS ORDERED that ... is granted/denied" boilerplate this
// series' other order-scanning modules have found in sibling states.
const GRANT_RE = /\bis (?:hereby )?(?:approved|granted)\b|\bare issued to\b|\bcertificate[^.]{0,80}(?:is|are) issued\b/i;
const DENY_RE = /\bis (?:hereby )?denied\b|\bapplication is denied\b/i;
const DISMISS_RE = /\bis (?:hereby )?dismissed\b|\bis (?:hereby )?withdrawn\b/i;

async function resolveStageFromOrders(getId: string, getId2: string, entries: DocketEntry[]): Promise<ProjectStage> {
  const orderEntries = entries.filter((e) => e.type.toLowerCase() === "order");
  if (orderEntries.length === 0) return "local_review";

  // Most recent order (highest docket sequence number) governs.
  const latest = orderEntries.reduce((a, b) => (Number(b.getId3) > Number(a.getId3) ? b : a));
  await sleep(REQUEST_DELAY_MS);
  const pdfUrl = await findOrderPdfUrl(getId, getId2, latest.getId3);
  if (!pdfUrl) return "local_review";

  await sleep(REQUEST_DELAY_MS);
  const res = await fetch(pdfUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return "local_review";
  const buf = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();

  if (DENY_RE.test(text) || DISMISS_RE.test(text)) return "cancelled";
  if (GRANT_RE.test(text)) return "approved_awaiting_construction";
  return "local_review";
}

const COUNTY_RE = /-\s*([A-Z][a-zA-Z]+(?:\s(?:and|&)\s[A-Z][a-zA-Z]+)*)\s+Ct(?:y|ys|ies)?\.?$|-\s*([A-Z][a-zA-Z]+(?:\s(?:and|&)\s[A-Z][a-zA-Z]+)*)\s+Count(?:y|ies)\.?$/i;

function extractCounties(description: string): string[] {
  const m = COUNTY_RE.exec(description.trim());
  if (!m) return [];
  const raw = m[1] ?? m[2] ?? "";
  return raw.split(/\s+(?:and|&)\s+/i).map((s) => s.trim()).filter(Boolean);
}

const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b|\bkv\b/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;
const WIND_RE = /\bwind\b/i;
const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const GAS_RE = /\bnatural gas\b|\bgas[- ]fired\b|\bcombined[- ]cycle\b/i;
const HYDRO_RE = /\bhydro/i;

function inferProjectType(category: string, description: string): ProjectType {
  if (category === "Pipeline") return "pipeline";
  if (TRANSMISSION_RE.test(description)) return "transmission";
  if (STORAGE_RE.test(description)) return "storage";
  return "generation";
}

function inferFuelType(category: string, description: string, projectType: ProjectType): FuelType {
  if (projectType === "pipeline") return "gas";
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  if (WIND_RE.test(description)) return "wind_onshore";
  if (SOLAR_RE.test(description)) return "solar";
  if (GAS_RE.test(description)) return "gas";
  if (HYDRO_RE.test(description)) return "hydro";
  return "other";
}

const CAPACITY_MW_RE = /([\d,]+(?:\.\d+)?)\s*(?:MW|megawatts?)\b/i;
const CAPACITY_KV_RE = /([\d,]+(?:\.\d+)?)\s*[- ]?kV\b/i;

function extractCapacity(text: string): { value: number | null; unit: string | null } {
  const mw = CAPACITY_MW_RE.exec(text);
  if (mw) {
    const value = Number(mw[1].replace(/,/g, ""));
    return Number.isFinite(value) ? { value, unit: "MW" } : { value: null, unit: null };
  }
  const kv = CAPACITY_KV_RE.exec(text);
  if (kv) {
    const value = Number(kv[1].replace(/,/g, ""));
    return Number.isFinite(value) ? { value, unit: "kV" } : { value: null, unit: null };
  }
  return { value: null, unit: null };
}

async function normalizeCandidate(listing: CaseListing): Promise<NormalizedProject> {
  await sleep(REQUEST_DELAY_MS);
  const detailHtml = await getPage(`pscasedetail?getId=${listing.getId}&getId2=${listing.getId2}`);
  const entries = parseDocketEntries(detailHtml);
  const currentStage = await resolveStageFromOrders(listing.getId, listing.getId2, entries);

  const matchKey = resolveMatchKey("nd-psc", listing.caseNumber);
  const projectType = inferProjectType(listing.category, listing.description);
  const fuelType = inferFuelType(listing.category, listing.description, projectType);
  const { value: capacityValue, unit: capacityUnit } = extractCapacity(listing.description);
  const counties = extractCounties(listing.description);
  const applicant = listing.entities.length > 0 ? listing.entities.join(" and ") : null;
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the North Dakota Public Service Commission's public case search, scoped to Energy Conversion and Transmission Facility siting applications (N.D.C.C. Ch. 49-22) — see the ingestion module header for why the ND PSC (unlike several sibling states in this series) really is the direct siting authority.",
    "\"Still waiting\" vs. resolved here is determined by scanning this case's own docket entries for a real Commission \"Order\" entry and, when found, parsing that order's own PDF text for grant/deny/dismiss language — not by this case's own \"Date Closed\" field, which was confirmed live to stay blank even after a real grant order. See the ingestion module header for the real confirmed example.",
  ];
  if (capacityUnit === "kV") {
    dataQualityNoteParts.push("Capacity shown is the transmission line's voltage rating (kV), not a MW capacity figure — this source does not publish line MW ratings.");
  }
  if (counties.length > 0) {
    const word = counties.length > 1 ? "Counties" : "County";
    dataQualityNoteParts.push(`Located in ${counties.join(" and ")} ${word}, North Dakota, per the case's own description text.`);
  } else {
    dataQualityNoteParts.push("No county is named in the case's own description text; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: applicant ? `${applicant} (ND PSC ${listing.caseNumber})` : `ND PSC Case ${listing.caseNumber}`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "ND",
    county: counties[0] ?? null,
    capacityValue,
    capacityUnit,
    applicationFiledDate: listing.filedDate,
    dateConfidence: "exact",
    currentStatus: `ND PSC Case ${listing.caseNumber}: ${currentStage === "local_review" ? "Pending (no order yet)" : currentStage}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on an Energy Conversion/Transmission Facility siting permit from the North Dakota Public Service Commission, pursuant to N.D.C.C. Ch. 49-22 — Case No. ${listing.caseNumber}, "${listing.description.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `ND PSC Case No. ${listing.caseNumber}`,
        url: `${BASE_URL}/pscasedetail?getId=${listing.getId}&getId2=${listing.getId2}`,
      },
    ],
    externalIds: { ndPsc: listing.caseNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestNdPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const currentYear = new Date().getFullYear();
  const errors: { matchKey: string; message: string }[] = [];
  const allListings: CaseListing[] = [];

  for (let i = 0; i < YEARS_TO_SCAN; i++) {
    const yy = String((currentYear - i) % 100).padStart(2, "0");
    try {
      const listings = await searchYear(yy);
      allListings.push(...listings);
    } catch (err) {
      errors.push({ matchKey: `nd-psc:year-20${yy}`, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (allListings.length === 0) {
    throw new Error(
      "ND PSC Siting Application search matched zero rows across every sampled year — the page structure likely changed. Check ROW_RE/parseSearchResults in src/lib/ingest/ndPscDockets.ts against a fresh response.",
    );
  }

  const candidates = allListings.filter(
    (l) => CATEGORY_ALLOWLIST.has(l.category) && !TRANSFER_RE.test(l.description),
  );

  const selected = selectWithRotation(candidates, maxCandidates, ROTATING_RECENT_SLOTS);
  const rotatingTier = new Set(selected.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  for (const listing of selected) {
    try {
      const normalized = await normalizeCandidate(listing);
      toUpsert.push(normalized);
      if (rotatingTier.has(listing)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: listing.caseNumber, message: String(err) });
    }
  }

  // See module header SCOPE WINDOW: a case that ages out of the
  // YEARS_TO_SCAN window is left untouched at its last-known real stage,
  // not guessed into a resolved one — same convention as every other
  // module in this series post-2026-08-25 (see common.ts).

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allListings.length,
    realApplicationCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  const started = Date.now();
  ingestNdPscDockets()
    .then((summary) => {
      const elapsedMs = Date.now() - started;
      console.log(
        `North Dakota PSC docket ingestion complete: ${summary.candidatesFound} siting cases scanned, ` +
          `${summary.realApplicationCandidates} real permit applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors. (${elapsedMs}ms)`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
