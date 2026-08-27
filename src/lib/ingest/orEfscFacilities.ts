// Oregon Energy Facility Siting Council (EFSC) facility site-certification
// ingestion — thirteenth state in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23.
//
// WHY EFSC, NOT PUC: the task brief for this module started from the same
// hint every prior state did — check the state's main utility commission
// (here, the Oregon Public Utility Commission, apps.puc.state.or.us/edockets)
// before assuming it's the right authority. Confirmed by hand: OPUC's
// eDockets search does return real "PCN" (Public Convenience and Necessity)
// dockets (e.g. PCN 5, PCN 8), but these are all decades old (the sampled
// ones are from the 1960s-80s) and OPUC's own site describes PCN dockets as
// covering a utility's *service territory* certification, not power-plant/
// transmission-line siting. Oregon's real facility-siting authority for
// generation, storage, and transmission — the equivalent of every other
// state's CPCN process — is vested by ORS 469.300 in the Energy Facility
// Siting Council (EFSC), administered by the Oregon Department of Energy
// (ODOE), exactly the pattern azAccLineSiting.ts/waEfsecFacilities.ts
// already established for AZ/WA. So this module ingests ODOE's EFSC
// facility list, not an OPUC docket search — hence the non-"Dockets" file
// name, same adaptation those two modules made.
//
// FETCHING: www.oregon.gov/energy/facilities/Pages/facilities-under-efsc.aspx
// is the human-facing page, but it's an ASP.NET/SharePoint 2016 page whose
// facility table is rendered client-side by a Knockout.js
// "data-tables-web-part" widget that reads a SharePoint list named
// "Facilities" — there's no server-rendered HTML table to regex over. That
// underlying SharePoint list, however, is exposed through SharePoint's own
// classic REST API with NO auth or session required (confirmed anonymous:
// `_spPageContextInfo.isAnonymousUser` is `true` on the page, and the API
// itself returns real data with a bare unauthenticated GET):
//   GET https://www.oregon.gov/energy/facilities/_api/web/lists/
//       getbytitle('facilities')/items?$top=500
// GOTCHA #1 (confirmed by hand): this endpoint defaults to returning an
// Atom XML feed (`content-type: application/atom+xml`), NOT JSON — a plain
// `fetch()` with only a User-Agent header (this series' usual minimal
// header set) gets XML back. The header `Accept:
// application/json;odata=verbose` must be sent explicitly, at which point
// the response becomes a clean `{"d":{"results":[...]}}` JSON payload with
// every field this module needs already structured (Title, Code,
// Facility_x0020_Type, Description [capacity, as free but consistently
// formatted text like "199 MW" or "320-kilovolts"], Location [county/ies],
// Status, Status_x0020_details [free-text narrative — see STATUS below],
// Certificate_x0020_holder [applicant], Page_x0020_URL). Confirmed
// 2026-08-23: a single `$top=500` request returns Oregon's entire
// EFSC-jurisdiction facility history (97 items, `__next` absent, i.e. no
// further pages) in one HTTP call — this module still follows `__next` in
// a loop for safety in case the list grows past the page-size threshold,
// but as of writing it never actually needs to.
// GOTCHA #2 — the one genuine consequence of this API-first approach: since
// every field this module needs is already present in that single list
// response, there is NO per-candidate detail fetch at all (unlike every
// other module in this series, which fetches a per-candidate detail page).
// That means the usual ~250ms per-candidate politeness delay has nothing to
// delay between — it's intentionally omitted here, not forgotten.
//
// STATUS — the sharpest "don't trust the obvious field" case in this whole
// series so far, and unlike WA EFSEC's module (where the structured status
// field turned out to be the trustworthy one), here BOTH structured status
// fields are demonstrably unreliable, confirmed against real, independently
// checkable facilities:
//   - The plain `Status` field (a Choice column, exposed on the page as
//     "Status2") is frequently stale. Real example: Golden Hills Wind
//     Project (facility Id 75) has `Status: "Approved"`, but its own
//     `Status_x0020_details` narrative says "Operating: The facility
//     commenced commercial operation on April 29, 2022." Perennial Wind
//     Chaser Station (Id 91) similarly reads `Status: "Approved"` while its
//     narrative says the Council terminated its site certificate in 2022.
//     Boardman Solar Energy Facility (Id 128) reads `Status: "Approved"`
//     while its narrative says "Site Certificate terminated March 22,
//     2024." All three are just never-updated leftovers from whenever the
//     facility was first approved.
//   - A second, separate lookup field (`Status:Title`, JSON key
//     `Status_x003a_TitleId`, resolving against a companion SharePoint list
//     literally named "Facility Status") is more current on average but
//     still wrong often enough not to trust alone: Boardman to Hemingway
//     Transmission Line (Id 71) resolves to "Approved" via this lookup, but
//     its narrative opens "Approved/Under Construction" — actually under
//     construction, a fact the lookup field misses. Jordan Cove Energy
//     Project (Id 133) has this lookup field entirely null despite having a
//     real, confirmable resolution ("Withdrawn," per its narrative).
//     A systematic cross-check confirmed by hand 2026-08-23: comparing both
//     structured fields against each other across all 97 facilities found
//     37 disagreements (over a third), and every spot-checked disagreement
//     (10 facilities, cited above and below) was resolved correctly by the
//     free-text narrative and incorrectly by at least one structured field.
//   - The reliable signal is instead `Status_x0020_details` — a free-text
//     narrative ODOE staff keep genuinely current (every real disagreement
//     found traces back to a structured field nobody bothered to update
//     when the narrative was revised). Every real narrative observed opens
//     with a short status clause before its first period — "Under Review.",
//     "Terminated.", "Withdrawn.", "Approved/Under Construction.",
//     "Operating: ...", "Under Review/Decommissioned.", etc. — followed by
//     a dated prose account of what actually happened. This module parses
//     that leading clause as the real status signal, not either structured
//     field.
//   - HTML-STRIPPING GOTCHA (confirmed by hand on Carty Generating Station,
//     Id 74): naively stripping tags to "" instead of " " glues adjacent
//     text across a `<br>`/`<div>` boundary into one run-on word — Carty's
//     raw narrative is "Under Review/Operating​<br>On February 16,
//     2024 the Department received..."; stripping tags to "" produces
//     "...OperatingOn February..." with no word boundary, which would make
//     a naive `\bOperating\b` keyword check silently fail to match and
//     misclassify this amendment-review facility as a genuine pending
//     candidate. `stripHtml` below replaces tags (and the stray U+200B
//     zero-width space some entries contain) with a single space, not
//     nothing, specifically to avoid this.
//   - AMENDMENT-REVIEW EXCLUSION: several facilities carry a leading clause
//     combining "Under Review" with an already-resolved keyword —
//     "Under Review/Operating" (Carty Generating Station, Klamath
//     Cogeneration Project), "Approved/Under Review" (Nolin Hills Wind
//     Power Project) — confirmed by reading their narratives in full: in
//     every case this is a pending Request for Amendment (RFA/pRFA) to a
//     facility that already has an operating site certificate, not an
//     original site-certificate application still awaiting its first
//     decision. Same exclusion this series already established for
//     amendment/transfer petitions in nyDpsDockets.ts's `EXCLUDE_RE`. A
//     candidate is only real here if its leading clause contains
//     "Under Review" and/or "Proposed" *and* contains none of the
//     already-resolved keywords (Approved, Operating, Under Construction,
//     Terminated, Decommissioned, Exempt, Withdrawn, Transitioned,
//     Temporarily Shut Down) — see RESOLVED_KEYWORDS_RE/PENDING_KEYWORDS_RE.
//     As of 2026-08-23 that leaves 12 real candidates (of 97 total
//     facilities): Cascade Renewable Transmission System, Muddy Creek
//     Energy Park, Yellow Rosebush Energy Center, Umatilla-Morrow County
//     Connect Project, Speedway Energy Facility, Buckley Solar Facility,
//     Deschutes Solar and Battery Energy Storage System Facility, Sunrise
//     Solar and Storage Projects, Heppner Wind Project, Saddle Butte Energy
//     Facility, Klamath Falls Energy Center, Big River Energy Facility.
//     (Notably, Boardman Coal Plant's leading clause is "Under
//     Review/Decommissioned" — a pending review of an already-terminated
//     facility's decommissioning, correctly excluded by the same logic.)
//     Cascade Renewable Transmission System's own narrative also confirms
//     its site boundary crosses into Washington and its review is being
//     coordinated with WA EFSEC — the same body waEfsecFacilities.ts
//     ingests — a real cross-state overlap, not a data error.
//
// FUEL/PROJECT TYPE & CAPACITY: `Facility_x0020_Type` and `Description` are
// both structured (not regex-guessed from prose) — Description is
// consistently formatted as e.g. "199 MW", "1,000 MW", or, for transmission
// lines, a voltage like "320-kilovolts"/"230 kV" (capacityUnit "kV" for
// those, same convention ilIccDockets.ts established for transmission
// voltage). One facility among current candidates (Big River Energy
// Facility, Facility_x0020_Type "Wind/Solar") is a genuine multi-technology
// project (its own applicant entities are literally "Big River Wind Power
// Project LLC, Big River Solar Park LLC, and Big River Energy Storage
// LLC"); classified by primary technology (wind checked before solar) same
// as this series' established hybrid-project convention, flagged in
// dataQualityNote. No current candidate exercises the non-renewable
// Facility_x0020_Type values (Natural Gas Plant, Coal Plant, Cogeneration
// Plant, Biomass/Biodiesel/Ethanol, Nuclear Reactor, etc.) since none of
// those are presently in "Under Review"/"Proposed" status, but
// inferFuelType/inferProjectType still map them defensively (best-effort,
// e.g. Coal Plant and biofuel types fall back to fuelType "other" since
// taxonomies.ts has no coal/biofuel value) rather than throwing, in case a
// future run encounters one.
//
// Filed date: no structured "date received" field exists (only
// `Date_x0020_Terminated`, populated for resolved facilities) — parsed
// instead from the first "Month DD, YYYY" date mentioned in the narrative,
// which in every candidate observed is the ODOE-received date of the NOI or
// (p)ASC that opened the review ("On February 27, 2026, the Oregon
// Department of Energy received a preliminary Application for a Site
// Certificate..."). Exact day is always given, so dateConfidence "exact"
// (unlike WA EFSEC's month/year-only dates).
//
// Wired to Vercel Cron weekly, 00:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-or-efsc/route.ts) — real run timing measured
// 2026-08-23: the entire ingestion (one bulk list fetch, zero per-candidate
// requests, DB upserts for the current 12 candidates) completed in a few
// seconds, nowhere close to the 300s cron budget.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const SITE_BASE = "https://www.oregon.gov/energy/facilities";
const API_BASE = `${SITE_BASE}/_api/web/lists/getbytitle('facilities')/items`;
const PAGE_BASE = `${SITE_BASE}/Pages`;

// Comfortably above the current 12-real-candidate count (of 97 total
// facilities ever tracked) — see module header FETCHING for why no
// date-based lookback is needed (the whole list is one cheap request).
export const MAX_CANDIDATES = 40;

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  // GOTCHA #1 (see module header): this endpoint returns Atom XML by
  // default. The odata=verbose Accept header is required to get JSON.
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json;odata=verbose",
    },
  });
  if (!res.ok) throw new Error(`OR EFSC request failed (${res.status}): ${url}`);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `OR EFSC response wasn't valid JSON (got content-type other than odata=verbose JSON?) — check fetchJson in src/lib/ingest/orEfscFacilities.ts against a fresh response. URL: ${url}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || !("d" in parsed)) {
    throw new Error(
      `OR EFSC response was JSON but missing the expected "d" wrapper — the endpoint shape likely changed. Check fetchJson in src/lib/ingest/orEfscFacilities.ts. URL: ${url}`,
    );
  }
  return parsed as Record<string, unknown>;
}

interface RawFacility {
  Id: number;
  Title: string;
  Code: string | null;
  Facility_x0020_Type: string | null;
  Description: string | null;
  Location: string | null;
  Status_x0020_details: string | null;
  Details: string | null;
  Certificate_x0020_holder: string | null;
  Page_x0020_URL: string | null;
}

async function fetchAllFacilities(): Promise<RawFacility[]> {
  const fields = [
    "Id",
    "Title",
    "Code",
    "Facility_x0020_Type",
    "Description",
    "Location",
    "Status_x0020_details",
    "Details",
    "Certificate_x0020_holder",
    "Page_x0020_URL",
  ].join(",");
  let url: string | null = `${API_BASE}?$top=500&$select=${fields}`;
  const all: RawFacility[] = [];
  // Follows `__next` defensively in case the list ever grows past one page
  // — confirmed 2026-08-23 that a single $top=500 request already returns
  // every facility (97 items, no __next present), see module header.
  while (url) {
    const body = await fetchJson(url);
    const d = body.d as { results?: unknown; __next?: string } | undefined;
    if (!d || !Array.isArray(d.results)) {
      throw new Error(
        "OR EFSC list response's d.results wasn't an array — the endpoint shape likely changed. Check fetchAllFacilities in src/lib/ingest/orEfscFacilities.ts.",
      );
    }
    all.push(...(d.results as RawFacility[]));
    url = typeof d.__next === "string" ? d.__next : null;
  }
  if (all.length === 0) {
    throw new Error(
      "OR EFSC facilities list returned zero items — check fetchAllFacilities in src/lib/ingest/orEfscFacilities.ts against a fresh response.",
    );
  }
  return all;
}

// Replaces tags (and the stray U+200B zero-width space some entries
// contain) with a space rather than nothing, specifically to avoid gluing
// adjacent text across a <br>/<div> boundary into one run-on word — see
// module header GOTCHA #2 (Carty Generating Station's real
// "Operating​<br>On February..." would otherwise strip to
// "OperatingOn February...", breaking a \bOperating\b keyword match.
function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/​/g, " ")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/&#58;/g, ":")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// See module header STATUS. Facilities already fully resolved one way or
// another (approved/operating/under construction/terminated/decommissioned/
// exempt/withdrawn/transitioned/shut down) are excluded even when "Under
// Review" also appears in the same leading clause, since that combination
// means a pending *amendment* to an already-certificated facility, not an
// original site-certificate application still awaiting its first decision.
const RESOLVED_KEYWORDS_RE =
  /\b(Approved|Operating|Under Construction|Terminated|Decommissioned|Exempt|Withdrawn|Transitioned|Temporarily Shut Down|Notice of Intent to Terminate)\b/i;
const PENDING_KEYWORDS_RE = /\b(Under Review|Proposed)\b/i;

function isPendingCandidate(statusDetailsHtml: string | null): boolean {
  const text = stripHtml(statusDetailsHtml);
  const m = /^([^.]{0,80})\./.exec(text);
  const lead = m ? m[1] : text.slice(0, 80);
  return PENDING_KEYWORDS_RE.test(lead) && !RESOLVED_KEYWORDS_RE.test(lead);
}

const MONTH_DATE_RE =
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/;

// The first "Month DD, YYYY" date in the narrative is, in every real
// candidate observed, the date ODOE received the NOI/(p)ASC that opened the
// review — see module header. No structured "date received" field exists.
function extractFiledDate(statusDetailsHtml: string | null): Date | null {
  const text = stripHtml(statusDetailsHtml);
  const m = MONTH_DATE_RE.exec(text);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface Capacity {
  value: number | null;
  unit: string | null;
}

// Description is structured, consistently formatted free text — e.g.
// "199 MW", "1,000 MW", or (transmission lines) "320-kilovolts"/"230 kV".
// capacityUnit "kV" for transmission voltage, same convention
// ilIccDockets.ts established.
function parseCapacity(description: string | null): Capacity {
  if (!description) return { value: null, unit: null };
  const m = /([\d,]+(?:\.\d+)?)\s*-?\s*(megawatts?|MW|kilovolts?|kV)\b/i.exec(description);
  if (!m) return { value: null, unit: null };
  const value = Number(m[1].replace(/,/g, ""));
  const unit = m[2].toLowerCase().startsWith("k") ? "kV" : "MW";
  return { value: Number.isFinite(value) ? value : null, unit };
}

// See module header FUEL/PROJECT TYPE & CAPACITY. Checked in this order so
// a multi-technology facility (e.g. "Wind/Solar") is identified by its
// primary generation technology. Non-renewable types aren't exercised by
// any current candidate but are still mapped defensively (best-effort, not
// thrown) in case a future run encounters one.
function inferProjectType(facilityType: string | null): ProjectType {
  const t = (facilityType ?? "").toLowerCase();
  if (t.includes("transmission")) return "transmission";
  if (t.includes("pipeline")) return "pipeline";
  return "generation";
}

function inferFuelType(facilityType: string | null): FuelType {
  const t = (facilityType ?? "").toLowerCase();
  if (t.includes("transmission")) return "transmission";
  if (t.includes("wind")) return "wind_onshore";
  if (t.includes("solar")) return "solar";
  if (t.includes("nuclear")) return "nuclear";
  if (t.includes("pipeline")) return "pipeline";
  if (t.includes("natural gas") || t.includes("cogeneration") || t.includes("steam turbine")) return "gas";
  // Coal and biofuel (ethanol/biodiesel/biomass/"renewable fuels") types
  // have no matching taxonomies.ts value — best-effort "other" per the
  // project's own fallback convention, not confirmed against a real
  // current candidate (none currently exercise this path).
  return "other";
}

// OR EFSC's own Location field can list more than one county (e.g. Cascade
// Renewable Transmission System: "Wasco County, Hood River County,
// Multnomah County, Klickitat County, Skamania County, Clark County" — the
// last three are actually Washington counties, since that facility's site
// boundary crosses the Columbia River; kept as-is rather than dropped,
// since it's a real cross-state fact, not a data error, per module header).
function cleanCounties(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .split(",")
    .map((c) => c.trim().replace(/\s+County$/i, ""))
    .filter(Boolean)
    .join(", ");
}

function normalizeFacility(facility: RawFacility): NormalizedProject {
  const sourceId = String(facility.Id);
  const matchKey = resolveMatchKey("or-efsc", sourceId);

  const projectType = inferProjectType(facility.Facility_x0020_Type);
  const fuelType = inferFuelType(facility.Facility_x0020_Type);
  const capacity = parseCapacity(facility.Description);
  const county = cleanCounties(facility.Location);
  const filedDate = extractFiledDate(facility.Status_x0020_details);
  const statusText = stripHtml(facility.Status_x0020_details);
  const statusLead = (/^([^.]{0,80})\./.exec(statusText)?.[1] ?? statusText.slice(0, 80)).trim();
  const holder = facility.Certificate_x0020_holder?.trim() || null;
  const detailsText = stripHtml(facility.Details);

  const currentStage: ProjectStage = "local_review";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Oregon Department of Energy's Energy Facility Siting Council (EFSC) facility list via its public SharePoint REST API (the human-facing page renders the same data client-side via JavaScript), not the Oregon Public Utility Commission — OPUC's own eDockets \"PCN\" (Public Convenience and Necessity) dockets cover utility service-territory certification, not generation/storage/transmission facility siting; that authority sits with EFSC under ORS 469.300 instead.",
    'Neither of this source\'s two structured status fields was trusted at face value — both were checked against real, independently confirmable facilities and found stale/wrong often enough (e.g. Golden Hills Wind Project and Perennial Wind Chaser Station both show "Approved" in the plain Status field despite being Operating/Terminated respectively). This project\'s real, current status signal is a free-text narrative field instead; see the ingestion module header for the full check, including how a pending-amendment-to-an-already-certificated-facility case (same status wording as a genuine pending application) is distinguished and excluded.',
  ];
  if (filedDate != null) {
    dataQualityNoteParts.push(
      "Filed date is parsed from the first date mentioned in that status narrative (the date ODOE received the Notice of Intent or Application for Site Certificate) — not a separately structured field.",
    );
  }
  if (capacity.value != null) {
    dataQualityNoteParts.push(
      `Capacity figure (${capacity.unit}) is ODOE's own published figure for this facility, not independently verified.`,
    );
  }
  if ((facility.Facility_x0020_Type ?? "").includes("/")) {
    dataQualityNoteParts.push(
      `This is a multi-technology facility (ODOE's own type category: "${facility.Facility_x0020_Type}"); classified here by its primary generation technology.`,
    );
  }
  if (fuelType === "other" && projectType === "generation") {
    dataQualityNoteParts.push(
      `Fuel/technology type "${facility.Facility_x0020_Type ?? "unknown"}" has no matching taxonomy value on this site — recorded as "other."`,
    );
  }
  if (county) {
    const countyWord = county.includes(",") ? "Counties" : "County";
    dataQualityNoteParts.push(`Located in ${county} ${countyWord}, Oregon, per ODOE's facility record — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  const pageUrl = facility.Page_x0020_URL ? `${PAGE_BASE}/${facility.Page_x0020_URL}` : `${SITE_BASE}/Pages/facilities-under-efsc.aspx`;

  return {
    matchKey,
    name: `${facility.Title.trim()} (OR EFSC)`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "OR",
    county,
    capacityValue: capacity.value,
    capacityUnit: capacity.unit,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `OR EFSC status: ${statusLead}${holder ? ` — applicant ${holder}` : ""}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a site certificate decision from the Oregon Energy Facility Siting Council, administered by the Oregon Department of Energy — ${facility.Title}${detailsText ? `, "${detailsText.slice(0, 300)}"` : ""}`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `OR EFSC Facility Page: ${facility.Title}`,
        url: pageUrl,
      },
    ],
    externalIds: { orEfsc: sourceId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  pendingCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestOrEfscFacilities(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allFacilities = await fetchAllFacilities();

  const candidates = allFacilities
    .filter((f) => isPendingCandidate(f.Status_x0020_details))
    .slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      toUpsert.push(normalizeFacility(candidate));
    } catch (err) {
      errors.push({ matchKey: String(candidate.Id), message: String(err) });
    }
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allFacilities.length,
    pendingCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestOrEfscFacilities()
    .then((summary) => {
      console.log(
        `Oregon EFSC facility ingestion complete: ${summary.candidatesFound} total facilities, ` +
          `${summary.pendingCandidates} pending original-site-certificate candidates, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
