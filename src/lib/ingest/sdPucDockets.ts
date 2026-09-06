// South Dakota Public Utilities Commission (PUC) Energy Conversion and
// Transmission Facility permit docket ingestion — one of several states
// built in parallel in the per-state series started with vaSccDockets.ts
// (see that file's header for the overall rationale). Confirmed by hand
// 2026-08-25 via real GET requests (Node's own `fetch`) against the live
// puc.sd.gov site — no assumption below was taken from documentation or
// training-data memory alone.
//
// SCOPING: South Dakota's real construction gate for large generation and
// transmission facilities is SDCL Title 49, Chapter 41B (the "Energy
// Conversion and Transmission Facilities" siting act), confirmed live by
// the real docket captions found (see below) rather than by reading the
// statute text through a third party (multiple attempts to fetch SD's own
// statute site and Justia's mirror both returned empty/JS-shell responses
// during this module's research — the docket captions themselves already
// name the exact real permit types, so this module scopes off of them
// directly). SD's PUC has no dedicated "siting" docket category — these
// permits are filed under the same "Electric" docket series
// (puc.sd.gov/Dockets/Electric/<year>/) as ordinary rate cases, tariff
// filings, and economic-development reports, one flat docket-number
// sequence ("EL<YY>-<NNN>") per year, the same shape as this series'
// Alabama/Arkansas flat-sequence states. Confirmed real, live construction-
// permit captions found while sampling 2018-2026 (see CONTENT_RE):
//   - "Permit to Construct a WAPA North Bend to Pratt 230kV Transmission
//     Line" (EL24-011)
//   - "Facility Permit for a 345-kV Transmission Facility and Associated
//     Facilities" (EL24-015)
//   - "Permit for an Energy Conversion Facility" (EL26-014, EL24-026(intent
//     only, see EXCLUDE_RE), EL18-xxx)
//   - "Permit to Construct and Operate the North Bend Wind Project in Hyde
//     County and Hughes County, South Dakota" (EL21-018)
//   - "Facility Permit to Construct a 230 kV Transmission Line and
//     Associated Facilities" (EL19-006)
// Real yield across the 8 sampled years (2018-2026 inclusive, one GET per
// year against the Electric category index) was thin but consistent —
// roughly 1-4 real candidates per year, never zero across any two-year
// stretch — the same "thin but real, worth a standing weekly check"
// population shape as nePrbDockets.ts/tnTpucDockets.ts in this series, not
// a zero-yield source.
//
// STALE STATUS BADGE — a real, confirmed bug in SD PUC's own site, found
// during this module's verification step: each docket's own detail page
// (puc.sd.gov/Dockets/Electric/<year>/EL<YY>-<NNN>.aspx) prints a top-of-
// page "Pending" / "Closed: <date>" badge that is NOT reliably kept current
// — EL21-018 (the North Bend Wind Project permit) still shows "Pending" in
// that badge as of 2026-08-25, despite its own "Orders:" list on the same
// page showing a real 01/10/23 "Order Granting Joint Motion for Approval of
// Settlement Stipulation; Order Granting Permit to Construct Facility" (the
// project has since been built and is filing monthly construction reports
// as of this writing). The per-YEAR docket-list page's own Pending/Closed
// column is therefore NOT trusted here at all for resolution status — this
// module instead fetches every real candidate's own detail page and scans
// its "Orders:" section for real grant/deny/withdraw order language (see
// GRANT_RE/DENY_RE/WITHDRAW_RE), the only place this source's data is
// actually kept current.
//
// LOCATION: unlike Vermont's town-only captions elsewhere in this series,
// SD's own docket captions name the county (or counties, for a line that
// crosses more than one) directly in the caption text — e.g. "in Hyde
// County and Hughes County, South Dakota" — extracted here with a plain
// "<Name> County" scan rather than a hardcoded whitelist, since the
// source's own text already labels it explicitly as a county.
//
// Real per-candidate timing: one GET per sampled year (8 total) plus one
// GET per real candidate's detail page (roughly 15-25 across the sampled
// years) — well under a minute end-to-end, negligible against the 300s
// cron budget.
//
// HEARING/MEETING CALENDAR: SD PUC has no separate technical-hearing
// process the way CT CSC or VT PUC do — the three commissioners themselves
// take up (and, per the docket's own "Orders:" history, ultimately grant or
// deny) each pending matter at the Commission's own regular biweekly
// "Commission Meeting," confirmed live 2026-09-05 by reading a real posted
// agenda (puc.sd.gov/agendas/2026/0908.aspx: "South Dakota Public Utilities
// Commission Meeting, September 8, 2026, at 1:30 p.m. CDT," with the site's
// own text inviting docket participants to "participate in docket
// discussion at the Commission Meeting" by phone or in person) — this is SD
// PUC's own real, practical equivalent of a public hearing/comment-period
// date for this module's purposes, not a separate distinct event type.
// puc.sd.gov/agendas/{year}/default.aspx (a plain server-rendered index,
// separate from the docket system fetched above) hand-lists every
// Commission Meeting date for that year as a plain-text link ("<a
// href="0908.aspx">September 8, 2026, Agenda of Commission Meeting</a>") —
// the meeting date itself is right there in the index's own link text, no
// need to parse each agenda page's title separately. Only entries dated
// after "now" are fetched (see fetchUpcomingAgendaHearings); confirmed live
// this index only ever lists a meeting once its agenda has actually been
// posted (as of 2026-09-05, the index for 2026 ends at 0908.aspx, the very
// next meeting — there is no batch of not-yet-real placeholder future dates
// to accidentally fetch), so this stays cheap (typically 1-2 extra GETs)
// without any explicit cap. Each such agenda page lists every docket up for
// discussion that day as a plain `<a href="https://puc.sd.gov/Dockets/
// Electric/{year}/{docketNumber}.aspx"><strong>{docketNumber}</strong></a>`
// — the exact same "EL{YY}-{NNN}" docket-number format this module already
// matches on, confirmed live against real past agendas: EL26-014 (Crowned
// Ridge Energy Storage I, one of this module's own real tracked candidates)
// appeared on both the 2026-07-28 and 2026-08-11 agendas, proving this
// mechanism finds a real tracked candidate's real meeting date when one is
// actually scheduled. Matched back to a tracked candidate by that exact
// docket-number text, never by fuzzy name matching. Real, confirmed-live
// 2026-09-05: of this module's own real tracked candidate population, 0
// currently appear on the one agenda page posted at fetch time (2026/
// 0908.aspx, which only covered EL24-027 and EL26-024 — neither a real
// construction-permit candidate this module tracks) — a real, honest null
// result for this run, not a sign the mechanism doesn't work.
//
// Wired to Vercel Cron weekly (see vercel.json and
// src/app/api/cron/ingest-sd-puc/route.ts — left for the maintainer to
// finalize the schedule and route).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://puc.sd.gov/Dockets/Electric";
const USER_AGENT = "Mozilla/5.0 (compatible; WaitingForPowerBot/1.0)";

// See module header SCOPING — real candidates were found across every
// sampled year 2018-2026. Scanning the last 9 years (current year back
// through 8 prior) each run keeps this bounded while covering the real
// observed population; a candidate resolved further back than that has
// long since dropped out of "still waiting" relevance anyway.
const YEARS_TO_SCAN = 9;
export const MAX_CANDIDATES = 120;
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
    .replace(/&ldquo;|&#8220;/g, "“")
    .replace(/&rdquo;|&#8221;/g, "”")
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&mdash;|&#8212;|–/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!res.ok) {
    throw new Error(`SD PUC request failed (${res.status}): ${url}`);
  }
  return res.text();
}

// See module header HEARING/MEETING CALENDAR. A separate site section
// (puc.sd.gov/agendas/, not puc.sd.gov/Dockets/ above) hand-lists every
// Commission Meeting date for a given year as a plain link — confirmed live
// 2026-09-05 against a real puc.sd.gov/agendas/2026/default.aspx response.
const AGENDA_BASE_URL = "https://puc.sd.gov/agendas";
const AGENDA_INDEX_RE = /<a href="([^"]+\.aspx)">([A-Za-z]+ \d{1,2}, \d{4}),[^<]*Agenda of Commission Meeting<\/a>/g;
// Confirmed live 2026-09-05 against real posted agenda pages (e.g.
// 2026/0908.aspx) — each docket up for discussion that day is a plain
// anchor whose href is this exact absolute URL shape and whose own link
// text is the docket number.
const AGENDA_DOCKET_RE = /<a href="https:\/\/puc\.sd\.gov\/Dockets\/Electric\/\d{4}\/(EL\d{2}-\d{3})\.aspx"><strong>\1<\/strong><\/a>/g;

// Each real agenda page's own opening block names the meeting's physical
// room right after the date/time line — confirmed live 2026-09-05 against
// three real 2026 agenda pages (0728.aspx, 0811.aspx, 0908.aspx), all
// identically "Room 413, Capitol Building <br /> Pierre, South Dakota"
// between the "at <time> CDT" line and the closing </strong>. Same page
// already fetched for AGENDA_DOCKET_RE above, no extra request.
const AGENDA_LOCATION_RE = /at\s+[\d:]+\s*[ap]\.m\.[^<]*<br\s*\/>\s*([\s\S]*?)<\/strong>/i;

function parseAgendaLocation(html: string): string | null {
  const m = AGENDA_LOCATION_RE.exec(html);
  if (!m) return null;
  const location = decodeHtmlEntities(m[1]);
  return location.length > 0 ? location : null;
}

interface UpcomingAgendaHearing {
  date: Date;
  link: string;
  location: string | null;
}

async function fetchUpcomingAgendaHearings(): Promise<Map<string, UpcomingAgendaHearing[]>> {
  const now = Date.now();
  const currentYear = new Date().getFullYear();
  const map = new Map<string, UpcomingAgendaHearing[]>();

  for (const year of [currentYear, currentYear + 1]) {
    let indexHtml: string;
    try {
      indexHtml = await fetchText(`${AGENDA_BASE_URL}/${year}/default.aspx`);
    } catch {
      continue; // next year's index folder may not exist yet — not an error
    }
    const futureAgendaUrls: { url: string; date: Date }[] = [];
    for (const m of indexHtml.matchAll(AGENDA_INDEX_RE)) {
      const [, href, dateText] = m;
      const date = new Date(dateText);
      if (Number.isNaN(date.getTime()) || date.getTime() <= now) continue;
      futureAgendaUrls.push({ url: `${AGENDA_BASE_URL}/${year}/${href}`, date });
    }
    for (const { url, date } of futureAgendaUrls) {
      await sleep(REQUEST_DELAY_MS);
      let agendaHtml: string;
      try {
        agendaHtml = await fetchText(url);
      } catch {
        continue;
      }
      const location = parseAgendaLocation(agendaHtml);
      for (const m of agendaHtml.matchAll(AGENDA_DOCKET_RE)) {
        const docketNumber = m[1];
        const arr = map.get(docketNumber) ?? [];
        if (!arr.some((h) => h.date.getTime() === date.getTime())) arr.push({ date, link: url, location });
        map.set(docketNumber, arr);
      }
    }
  }
  return map;
}

interface DocketListing {
  docketNumber: string;
  year: string;
  rawTitleHtml: string;
  rawTitle: string;
  filedDate: Date | null;
}

// Confirmed live 2026-08-25 against real Electric/<year>/default.aspx
// responses — see module header SCOPING for a real sample entry.
const LISTING_RE =
  /<p><a href="(EL\d{2}-\d{3})\.aspx">\1\s*[-–—]\s*([\s\S]*?)<\/a>[\s\S]*?Date Filed:\s*(\d{2}\/\d{2}\/\d{2})/g;

function parseYearListing(html: string, year: string): DocketListing[] {
  const out: DocketListing[] = [];
  for (const m of html.matchAll(LISTING_RE)) {
    const [, docketNumber, rawTitleHtml, filedRaw] = m;
    const rawTitle = decodeHtmlEntities(rawTitleHtml);
    const [mm, dd, yy] = filedRaw.split("/").map(Number);
    const filedDate = mm && dd && yy != null ? new Date(2000 + yy, mm - 1, dd) : null;
    out.push({
      docketNumber,
      year,
      rawTitleHtml,
      rawTitle,
      filedDate: filedDate && !Number.isNaN(filedDate.getTime()) ? filedDate : null,
    });
  }
  return out;
}

// See module header SCOPING — the four real, confirmed phrasings this
// source's own construction-permit captions use.
const CONTENT_RE = /permit (?:to|for) construct|facility permit|permit for an energy conversion facility/i;

// "Notification/Notice of Intent to Apply for a Permit" is a real,
// confirmed pre-filing notice (EL24-021, EL24-026, EL25-038 — both
// phrasings observed live) — not yet an actual application, matching this
// project's "only real applications" convention.
const EXCLUDE_RE = /(?:notification|notice) of intent/i;

// See module header STALE STATUS BADGE — scanned against each candidate's
// own "Orders:" section text, confirmed live against EL21-018's real
// 01/10/23 grant order.
const GRANT_RE = /order granting[\s\S]{0,120}?(?:permit|facility permit)/i;
const DENY_RE = /order denying[\s\S]{0,120}?permit/i;
const WITHDRAW_RE = /order (?:granting[\s\S]{0,40}?motion to )?(?:dismiss|withdraw)/i;

async function fetchOrdersSectionText(year: string, docketNumber: string): Promise<string> {
  const url = `${BASE_URL}/${year}/${docketNumber}.aspx`;
  const html = await fetchText(url);
  const ordersMatch = /Orders:<\/strong>([\s\S]*?)(?:<p><strong>|<\/div>\s*<\/div>)/i.exec(html);
  return ordersMatch ? decodeHtmlEntities(ordersMatch[1]) : "";
}

function resolveStage(ordersText: string): ProjectStage {
  if (GRANT_RE.test(ordersText)) return "approved_awaiting_construction";
  if (DENY_RE.test(ordersText) || WITHDRAW_RE.test(ordersText)) return "cancelled";
  return "local_review";
}

// See module header LOCATION. SD's own titles render in an inconsistent
// title-case that capitalizes prepositions/articles ("...In Haakon County,
// South Dakota" — confirmed live, EL25-029), so a plain "<Capitalized
// word(s)> County" scan over-captures the leading "In". COUNTY_STOPWORDS
// strips those off the front of a raw match rather than tightening the
// regex itself, since the same stopword can legitimately also be part of a
// real county's OWN second word in other states' captions (not observed
// for SD's real county list, but not assumed impossible either).
const COUNTY_RE = /\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s+County\b/g;
const COUNTY_STOPWORDS = new Set(["In", "The", "A", "An", "Of", "By", "For", "And", "To"]);

function extractCounties(title: string): string[] {
  const counties: string[] = [];
  for (const m of title.matchAll(COUNTY_RE)) {
    const words = m[1].split(" ").filter((w) => !COUNTY_STOPWORDS.has(w));
    const name = words.join(" ").trim();
    if (name.length > 0 && !counties.includes(name)) counties.push(name);
  }
  return counties;
}

const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b|\bkv\b/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;
const WIND_RE = /\bwind\b/i;
const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const GAS_RE = /\bnatural gas\b|\bgas[- ]fired\b|\bcombined[- ]cycle\b/i;
const HYDRO_RE = /\bhydro/i;

function inferProjectType(text: string): ProjectType {
  if (TRANSMISSION_RE.test(text)) return "transmission";
  if (STORAGE_RE.test(text)) return "storage";
  return "generation";
}

function inferFuelType(text: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  if (WIND_RE.test(text)) return "wind_onshore";
  if (SOLAR_RE.test(text)) return "solar";
  if (GAS_RE.test(text)) return "gas";
  if (HYDRO_RE.test(text)) return "hydro";
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

// Real captions consistently bold the applicant's own name(s) with
// <strong> — confirmed live across every sampled caption (single-applicant
// and multi-applicant, e.g. EL25-028's "<strong>Western Minnesota
// Municipal Power Agency </strong>and<strong> Missouri River Energy
// Services</strong>") — a more reliable signal than parsing the
// surrounding free-text phrasing, which varies ("for a Permit", "for
// Energy Facility Permits of a...", etc.) more than the site's own bolding
// convention does.
const STRONG_RE = /<strong>([\s\S]*?)<\/strong>/g;

function extractApplicant(rawTitleHtml: string): string | null {
  const names = [...rawTitleHtml.matchAll(STRONG_RE)]
    .map((m) => decodeHtmlEntities(m[1]).replace(/,$/, "").replace(/'s$/, "").trim())
    .filter((n) => n.length > 0 && !/^notice$/i.test(n));
  if (names.length === 0) return null;
  return names.join(" and ");
}

async function normalizeCandidate(
  listing: DocketListing,
  upcomingAgendaHearings: Map<string, UpcomingAgendaHearing[]>,
): Promise<NormalizedProject> {
  await sleep(REQUEST_DELAY_MS);
  const ordersText = await fetchOrdersSectionText(listing.year, listing.docketNumber);
  const currentStage = resolveStage(ordersText);

  const matchKey = resolveMatchKey("sd-puc", listing.docketNumber);
  const projectType = inferProjectType(listing.rawTitle);
  const fuelType = inferFuelType(listing.rawTitle, projectType);
  const { value: capacityValue, unit: capacityUnit } = extractCapacity(listing.rawTitle);
  const counties = extractCounties(listing.rawTitle);
  const applicant = extractApplicant(listing.rawTitleHtml);
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];
  const hearings = upcomingAgendaHearings.get(listing.docketNumber) ?? [];

  const dataQualityNoteParts: string[] = [
    "Sourced from the South Dakota Public Utilities Commission's public docket pages, scoped to Energy Conversion and Transmission Facility permit applications (SDCL 49-41B) filed in the Electric docket series — see the ingestion module header for the real caption phrasings this is scoped to.",
    "\"Still waiting\" vs. resolved here is determined by scanning this docket's own \"Orders:\" list for real grant/deny/withdraw order language, not by the docket page's own Pending/Closed status badge — that badge was confirmed live to go stale after a real grant (see the ingestion module header). A docket with no grant/deny/withdraw order yet is treated as still pending.",
  ];
  if (capacityUnit === "kV") {
    dataQualityNoteParts.push("Capacity shown is the transmission line's voltage rating (kV), not a MW capacity figure — this source does not publish line MW ratings.");
  }
  if (counties.length > 0) {
    const word = counties.length > 1 ? "Counties" : "County";
    dataQualityNoteParts.push(`Located in ${counties.join(" and ")} ${word}, South Dakota, per the docket's own caption text.`);
  } else {
    dataQualityNoteParts.push("No county is named in the docket's own caption text; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: applicant ? `${applicant} (SD PUC ${listing.docketNumber})` : `SD PUC Docket ${listing.docketNumber}`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "SD",
    county: counties[0] ?? null,
    capacityValue,
    capacityUnit,
    applicationFiledDate: listing.filedDate,
    dateConfidence: "exact",
    applicant,
    currentStatus: `SD PUC Docket ${listing.docketNumber}: ${currentStage === "local_review" ? "Pending" : currentStage}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on an Energy Conversion/Transmission Facility permit from the South Dakota Public Utilities Commission, pursuant to SDCL 49-41B — Docket No. ${listing.docketNumber}, "${listing.rawTitle.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    hearingDetailsLink: hearings.length > 0 ? hearings[0].link : null,
    hearings: hearings.map((h) => ({ date: h.date, endDate: null, label: null, location: h.location })),
    sources: [
      {
        label: `SD PUC Docket No. ${listing.docketNumber}`,
        url: `${BASE_URL}/${listing.year}/${listing.docketNumber}.aspx`,
      },
    ],
    externalIds: { sdPuc: listing.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestSdPucDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const currentYear = new Date().getFullYear();
  const errors: { matchKey: string; message: string }[] = [];
  const allListings: DocketListing[] = [];

  for (let i = 0; i < YEARS_TO_SCAN; i++) {
    const year = String(currentYear - i);
    try {
      const html = await fetchText(`${BASE_URL}/${year}/default.aspx`);
      allListings.push(...parseYearListing(html, year));
    } catch (err) {
      errors.push({ matchKey: `sd-puc:year-${year}`, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (allListings.length === 0) {
    throw new Error(
      "SD PUC Electric docket listing matched zero rows across every sampled year — the page structure likely changed. Check LISTING_RE/parseYearListing in src/lib/ingest/sdPucDockets.ts against a fresh response.",
    );
  }

  const candidates = allListings.filter((l) => CONTENT_RE.test(l.rawTitle) && !EXCLUDE_RE.test(l.rawTitle));

  const realApplications = selectWithRotation(candidates, maxCandidates, ROTATING_RECENT_SLOTS);
  const rotatingTier = new Set(realApplications.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  // A failure here shouldn't block the whole ingestion run over a feature
  // this supplementary — degrades to "no hearing data this run."
  const upcomingAgendaHearings = await fetchUpcomingAgendaHearings().catch(() => new Map<string, UpcomingAgendaHearing[]>());

  const toUpsert: NormalizedProject[] = [];
  for (const listing of realApplications) {
    try {
      const normalized = await normalizeCandidate(listing, upcomingAgendaHearings);
      toUpsert.push(normalized);
      if (rotatingTier.has(listing)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: listing.docketNumber, message: String(err) });
    }
  }

  // See module header VANISHED-CANDIDATE FIX equivalent: a docket that ages
  // out of the YEARS_TO_SCAN window is left untouched at its last-known
  // real stage, not guessed into a resolved one — same convention as every
  // other module in this series post-2026-08-25 (see common.ts).

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
  ingestSdPucDockets()
    .then((summary) => {
      const elapsedMs = Date.now() - started;
      console.log(
        `South Dakota PUC docket ingestion complete: ${summary.candidatesFound} docket entries scanned, ` +
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
