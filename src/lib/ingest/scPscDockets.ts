// South Carolina Public Service Commission (PSC) docket ingestion — fifth
// state in the per-state series started with vaSccDockets.ts (see that
// file's header for the overall rationale). Confirmed by hand 2026-08-23.
//
// FETCHING: dms.psc.sc.gov's public Docket Management System is a plain
// server-rendered ASP.NET MVC site — no auth, no session/CSRF token, and (a
// nice change from North Carolina's equivalent system) no bot-defense in
// front of it. Two endpoints:
//   - Search: /Web/Dockets/Search?Summary=<term>&NumberType=<n>&StartDate=
//     MM/DD/YYYY&EndDate=MM/DD/YYYY returns an HTML table of matching
//     dockets (docket number + full caption + party list). NumberType is
//     SC's own docket-suffix code, not a free enum — confirmed against the
//     search form's real <option> list: 5001 = "E" (electric, SC's
//     equivalent of TX's UtilityType=E). This module always passes 5001.
//   - Detail: /Web/Dockets/Detail/{internal id} (the id in each search
//     result's href, NOT the public docket number) returns Opened
//     date/Status/Industry plus several tabs, one of which
//     (id="detail-tabs-2") is a full Orders table for that docket — see
//     STATUS below. Already-fetched with the single detail request, no
//     separate call needed.
// No HTML-parsing dependency added, same discipline as this series'
// other regex-based sources — each extractor throws if the expected
// structure isn't found.
//
// SCOPING: SC's actual statutory name for what other states call a CPCN is
// longer — a "Certificate of Environmental Compatibility and Public
// Convenience and Necessity" (S.C. Code Ann. § 58-33-10 et seq., "Siting of
// Major Utility Facilities"). Confirmed 2026-08-23 by hand: searching
// Summary for the full phrase "Certificates of Public Convenience and
// Necessity" server-side returns almost nothing (2 hits over 4.5 years) —
// most real captions use the longer "…Environmental Compatibility and
// Public Convenience and Necessity…" form, and a few use "Certificate" vs.
// "Certificates" inconsistently, so a server-side exact-phrase search
// silently misses most of what it's looking for. Instead this module does
// the same broad-keyword-then-own-regex pattern as Texas/Colorado: search
// Summary for the single word "certificate" (NumberType=5001, an 8-year
// lookback), then filter locally with CECPCN_RE, which does catch the real
// applications — confirmed against a real 36-candidate batch, 28 of which
// were genuine siting-certificate applications; the rest were unrelated
// dockets (e.g. a declaratory-order petition about certificate
// *requirements*, not an application) correctly excluded.
//
// STATUS: the Detail page's own "Status" field is useless — confirmed
// 2026-08-23 that it reads "Open" even on a docket whose certificate was
// granted years ago (2022-93-E, granted via an amended 2026 order, still
// shows Status="Open"). The real signal is the Orders tab
// (id="detail-tabs-2", part of the same detail-page fetch, no extra
// request): each order has its own summary text, and a granting/denying/
// dismissing order's title reliably says so close to the word "granting" /
// "denying" / "dismissing". GRANT_RE requires "certificate(s)" within ~30
// characters of "granting" specifically to avoid a false match on
// procedural orders like "Order Granting Motion to Withdraw as Counsel" —
// those also mention "a Certificate of..." later in the same string (every
// order's summary repeats the docket's full caption after a dash), just far
// enough away that the tight window correctly excludes it. Verified against
// three real dockets before shipping: 2026-30-E (granted, matches), 2022-
// 93-E (granted via an amended order buried among 26 total orders,
// matches), 2026-192-E (freshly filed, no orders yet, correctly finds no
// signal and is left active).
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields — SC's captions are
// unusually descriptive and consistent, though ("Application of X for a
// [certificate] for the Construction and Operation of a 100 MW Solar
// Facility in Y County, South Carolina..."), so keyword/regex extraction
// from the caption text is fairly reliable, same approach and same caveats
// as Texas.
//
// Wired to Vercel Cron weekly, 20:00 UTC Sundays (see vercel.json and
// src/app/api/cron/ingest-sc-psc/route.ts) — a real run's timing was
// measured (34 candidates, ~35s) before scheduling this. Also
// politeness-delayed between per-candidate detail requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://dms.psc.sc.gov";
const NUMBER_TYPE_ELECTRIC = "5001";

export const MAX_CANDIDATES = 100;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
const LOOKBACK_YEARS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as txPuctDockets.ts, not a full HTML-entity library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&sect;/g, "§")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

interface DocketSearchResult {
  docketId: number;
  docketNumber: string;
  caption: string;
}

const SEARCH_ROW_RE =
  /<a class="detailNumber" href="\/Web\/Dockets\/Detail\/(\d+)">([^<]+)<\/a>[\s\S]{0,200}?<span><strong>([\s\S]*?)<\/strong>/g;

export function parseSearchResults(html: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(SEARCH_ROW_RE)) {
    results.push({
      docketId: Number(m[1]),
      docketNumber: decodeHtmlEntities(m[2]),
      caption: decodeHtmlEntities(m[3]),
    });
  }
  if (results.length === 0 && /Docket Search Result/.test(html)) {
    throw new Error(
      "SC PSC search returned a results page but parseSearchResults matched zero rows — the table structure likely changed. Check SEARCH_ROW_RE in src/lib/ingest/scPscDockets.ts against a fresh response.",
    );
  }
  return results;
}

interface DocketDetail {
  openedDate: Date | null;
  resolution: "granted" | "denied" | "dismissed" | null;
}

const OPENED_RE =
  /<label class="control-label" for="Opened">Opened<\/label>[\s\S]{0,80}?<div class="col-md-offset-1">\s*([^<]+?)\s*<\/div>/;

// Tight window (0-30 chars) so it can't reach across an order's dash-
// separated docket-caption restatement to a "Certificate" that appears for
// an unrelated reason (e.g. "Order Granting Motion to Withdraw as Counsel -
// Application of X for a Certificate of..." — ~15 words apart, safely
// excluded). See module header STATUS section.
const GRANT_RE = /\bgranting\b[\s\S]{0,30}\bcertificates?\b/i;
const DENY_RE = /\bdenying\b[\s\S]{0,60}\bcertificates?\b/i;
const DISMISS_RE = /\bdismissing\b[\s\S]{0,60}\b(application|docket|petition)\b/i;

export function parseDetail(html: string): DocketDetail {
  const openedM = OPENED_RE.exec(html);
  const openedDate = openedM ? parseLongDate(decodeHtmlEntities(openedM[1])) : null;

  const tabStart = html.indexOf('id="detail-tabs-2"');
  const tabEnd = tabStart >= 0 ? html.indexOf('id="detail-tabs-3"', tabStart) : -1;
  if (tabStart < 0 || tabEnd < 0) {
    throw new Error(
      "SC PSC detail page didn't contain the expected Orders tab (id=\"detail-tabs-2\") — the page structure likely changed. Check parseDetail in src/lib/ingest/scPscDockets.ts against a fresh response.",
    );
  }
  const ordersSection = html.slice(tabStart, tabEnd);
  const orderSummaries = [...ordersSection.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => decodeHtmlEntities(m[1]));

  let resolution: DocketDetail["resolution"] = null;
  for (const summary of orderSummaries) {
    if (GRANT_RE.test(summary)) {
      resolution = "granted";
      break;
    }
    if (DENY_RE.test(summary)) {
      resolution = "denied";
      break;
    }
    if (DISMISS_RE.test(summary)) {
      resolution = "dismissed";
      break;
    }
  }

  return { openedDate, resolution };
}

// "Monday, January 26, 2026" — day name is redundant and JS's native Date
// parser handles this format reliably once it's stripped, avoiding any
// ambiguity between locale-dependent parsing quirks.
function parseLongDate(raw: string): Date | null {
  const stripped = raw.replace(/^[A-Za-z]+,\s*/, "");
  const d = new Date(stripped);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SC PSC request failed (${res.status}): ${url}`);
  return res.text();
}

async function searchCandidates(): Promise<DocketSearchResult[]> {
  const from = new Date();
  from.setFullYear(from.getFullYear() - LOOKBACK_YEARS);
  const url =
    `${BASE_URL}/Web/Dockets/Search?Summary=${encodeURIComponent("certificate")}&NumberType=${NUMBER_TYPE_ELECTRIC}` +
    `&StartDate=${formatDate(from)}&EndDate=${formatDate(new Date())}`;
  const html = await fetchText(url);
  return parseSearchResults(html);
}

async function fetchDetail(docketId: number): Promise<DocketDetail> {
  const html = await fetchText(`${BASE_URL}/Web/Dockets/Detail/${docketId}`);
  return parseDetail(html);
}

// SC's real statutory certificate name — see module header SCOPING. Applied
// against the caption text fetched from search results, not the (also
// unreliable — see STATUS) Status field.
const CECPCN_RE = /certificates?\s+of\s+environmental\s+compatibility\s+and\s+public\s+convenience\s+and\s+necessity/i;

// A real siting-certificate *application* always opens "Application of ..."
// or "Joint Application of ...". Confirmed 2026-08-23: two false positives
// in a real batch — a "Petition ... for an Expedited Decision and Issuance
// of [a Certificate]" and a "Petition ... for Declaratory Order Finding
// That a Certificate ... [is/isn't required]" — both matched CECPCN_RE
// because they mention the certificate phrase while arguing *about* it, not
// applying for one. Required together with CECPCN_RE, not in place of it.
const APPLICATION_RE = /^(?:joint\s+)?application\s+of\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(battery|storage|bess)\b/i, "storage"],
  [/\b(combined cycle|combustion turbine|natural gas)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
];

// Checked before any fuel keyword, same reasoning as txPuctDockets.ts: a
// transmission line's own route/substation names shouldn't be misread as a
// generation fuel.
const TRANSMISSION_RE = /\b(transmission|kv line|kv lines|switching station|substation)\b/i;
const STORAGE_RE = /\bbattery energy storage\b|\bbess\b/i;

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
  const m = /\bin\s+([A-Z][A-Za-z.'\s]*?)\s+Count(?:y|ies),?\s+South\s+Carolina/i.exec(caption);
  return m ? m[1].trim() : null;
}

function extractApplicant(caption: string): string {
  const m = /^(?:Joint )?Application of (?:the )?(.+?)\s+for\s+a\s+Certificate/i.exec(caption);
  return m ? m[1].trim() : caption.slice(0, 80);
}

function normalizeDocket(search: DocketSearchResult, detail: DocketDetail): NormalizedProject {
  const matchKey = resolveMatchKey("sc-psc", search.docketNumber);
  const projectType = inferProjectType(search.caption);
  const fuelType = inferFuelType(search.caption, projectType);
  const capacityMw = extractCapacityMw(search.caption);
  const county = extractCounty(search.caption);
  const applicant = extractApplicant(search.caption);

  let currentStage: ProjectStage;
  if (detail.resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (detail.resolution === "denied" || detail.resolution === "dismissed") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the South Carolina Public Service Commission's public Docket Management System.",
    'The docket\'s own "Status" field is not reliable (observed to read "Open" even on long-granted dockets); "still waiting" here is inferred from scanning the docket\'s Orders tab for a granting/denying/dismissing order — see the ingestion module header for how this was calibrated.',
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket caption text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, South Carolina, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (SC PSC Docket ${search.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "SC",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: detail.openedDate,
    dateConfidence: "exact",
    applicant,
    currentStatus: `South Carolina PSC docket ${search.docketNumber}: ${detail.resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Environmental Compatibility and Public Convenience and Necessity from the South Carolina Public Service Commission — Docket No. ${search.docketNumber}, "${search.caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `SC PSC Docket No. ${search.docketNumber}`,
        url: `${BASE_URL}/Web/Dockets/Detail/${search.docketId}`,
      },
    ],
    externalIds: { scPsc: search.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  cecpcnCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestScPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allCandidates = await searchCandidates();
  const candidates = selectWithRotation(
    allCandidates.filter((c) => CECPCN_RE.test(c.caption) && APPLICATION_RE.test(c.caption)),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );

  const rotatingTier = new Set(candidates.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const detail = await fetchDetail(candidate.docketId);
      const normalized = normalizeDocket(candidate, detail);
      toUpsert.push(normalized);
      if (rotatingTier.has(candidate)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: candidate.docketNumber, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allCandidates.length,
    cecpcnCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestScPscDockets()
    .then((summary) => {
      console.log(
        `South Carolina PSC docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.cecpcnCandidates} real siting-certificate applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
