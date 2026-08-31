// California Energy Commission (CEC) power plant siting docket ingestion —
// one of several states built in parallel in the per-state series started
// with vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23/24 via real requests against the live
// apps.cpuc.ca.gov, www.energy.ca.gov, and efiling.energy.ca.gov sites (plus
// one real-browser session against apps.cpuc.ca.gov to rule out a
// client-side-only explanation) — no assumption below was taken from
// documentation or training-data memory alone.
//
// SCOPING — CPUC was tried first and ruled out, CEC was confirmed to work:
// California splits energy-project siting authority across two agencies.
// The CPUC issues Certificates of Public Convenience and Necessity (CPCN)
// for utility distribution/some transmission work, but CEC has EXCLUSIVE
// jurisdiction to certify (a) thermal power plants 50 MW or larger via the
// traditional "Application for Certification" (AFC) process (Warren-Alquist
// Act, Pub. Res. Code §25500 et seq.), and, since AB 205 (2022)/AB 209, (b)
// solar/wind plants ≥50MW, storage facilities ≥200 MWh, their gen-tie
// transmission lines, and qualifying clean-energy manufacturing facilities
// via a streamlined "Opt-In" certification process — CEC certification is
// "in lieu of" any other state/local permit for these facilities. Given
// nearly every large solar/wind/storage project built in California today
// files as an Opt-In case rather than through CPUC, CEC (not CPUC) is this
// state's real construction/siting gate for generation and storage — see
// the real live population below, all filed 2023-2026.
//
//   1. CPUC's own "Proceeding Information Search" (apps.cpuc.ca.gov/apex,
//      Oracle APEX application 401) was tried first and is NOT usable as a
//      plain-fetch() source, confirmed two independent ways:
//        a. Replaying the search button's own apex.submit({request:
//           'P1_SEARCH'}) as a raw POST to /apex/wwv_flow.accept (matching
//           every hidden field in the rendered form, a real session cookie,
//           and a same-session p_instance/p_page_submission_id pair) DOES
//           get redirected to the results page (401:5), but the item values
//           (P1_PROCEEDING_NUM, P1_DESCRIPTION, P1_FILED_DATE_L, ...) are
//           silently NOT persisted into session state — a follow-up GET of
//           page 1 in the same session shows every search field still
//           blank, and the "results" page returns APEX's literal unfiltered
//           default view ("1 - 100 of 12,131" — i.e. every proceeding this
//           system has ever logged, complaints and rate cases included, not
//           a certificate-type-filtered set).
//        b. To rule out a curl-specific quirk (missing browser fingerprint,
//           wrong header set, etc.), the same search was replayed in a real
//           Chromium session (this repo's Browser tool) — filling the
//           Description field with "certificate of public convenience and
//           necessity" and clicking the real Search button. The network
//           panel shows the click did NOT reach the wwv_flow.accept
//           postback endpoint at all in that run; instead it fired two
//           unrelated wwv_flow.ajax calls (a page-load privacy-link
//           Dynamic Action) and then a plain GET back to
//           `f?p=401:1::::::` with a brand-new session ("p=401:1:0" —
//           session id "0" means "start a new session"), losing the typed
//           value. A second attempt using only the simplest field
//           (Proceeding Number = "A2608") reproduced the same behavior.
//           This is consistent with page-level Dynamic Action / client-side
//           validation logic that isn't discoverable from the static HTML
//           alone (no CAPTCHA, no login wall, no rate-limit error — just an
//           APEX app whose real submit path a plain fetch()-based module
//           cannot reliably reproduce). Per this project's standing
//           guidance on fragile SPA-only interfaces with no plain-HTTP path
//           (see AGENTS.md), CPUC's Proceeding Information Search is
//           correctly deferred here, not forced.
//   2. CEC, by contrast, is a plain server-rendered Drupal site
//      (www.energy.ca.gov) backing onto an ASP.NET WebForms docket-document
//      system (efiling.energy.ca.gov) — no auth, no CAPTCHA, no JS
//      execution required for either read path:
//        a. www.energy.ca.gov/proceedings/power-plant-listing is a Drupal
//           "power_plant" content-type View with a real GET-based exposed
//           filter form (`field_project_type_value`,
//           `field_project_status_value` — both plain HTML <input
//           type="radio" name="...">, POSTs nothing, GET-only). Confirmed
//           live: `?field_project_type_value=AFC&field_project_status_value
//           =Under_Review` returns exactly the 3 real still-pending AFC
//           projects (Black Rock/Elmore North/Morton Bay Geothermal, all
//           23-AFC-0x), matching a from-scratch full unfiltered scan of all
//           139 listed power plants done independently as a cross-check.
//        b. Each power plant's own detail page
//           (www.energy.ca.gov/powerplant/{category}/{slug}) has a
//           structured "at a glance" `<dl>` block — Project Owner, Docket
//           Number, Capacity, Location, Technology, Project Status, Project
//           Type — server-rendered, no auth.
//        c. Each docket's full filing history is one plain GET away at
//           efiling.energy.ca.gov/Lists/DocketLog.aspx?docketnumber={id} —
//           an ASP.NET WebForms page with a real __VIEWSTATE, but the
//           default (unsorted) view of the filings GridView renders every
//           row unpaginated on first load with no postback needed (23-AFC-01
//           returned all 388 of its real filings, oldest 4/18/2023, in one
//           GET — no `pager` control was found in the rendered HTML at any
//           row count seen in this population).
//
// The real, confirmed candidate population (SCOPING continued): CEC's own
// docket-number prefix already separates project types cleanly — AFC
// (`YY-AFC-NN`, traditional ≥50MW thermal/geothermal/solar-thermal) and OPT
// (`YY-OPT-NN`, AB205 Opt-In). This module covers ONLY those two — CEC's own
// "Filter by Proceeding Type" facet also lists SPPE (Small Power Plant
// Exemption — a narrower, faster EXEMPTION-from-full-review track for
// smaller facilities, mostly backup generators at data centers in the real
// population; confirmed live 2026-08-24 that 4 of the 14 real "Under
// Review" listings are SPPE backup-generator/data-center cases, not siting
// cases for a named generation/transmission/storage project in this site's
// sense), EP (Emergency Peaker), TPG (Temporary Power Generators), BSS (a
// single legacy one-off docket prefix, "Battery Storage System", predating
// Opt-In's own BSS-eligible track), and SRR (Strategic Reliability
// Reserve) — none of these is the real construction/siting GATE the way
// AFC/Opt-In are, so all are excluded, matching this series' MO
// PSC/UT PSC precedent of excluding an exemption/fast-track process from an
// otherwise-similar full-review docket type. A `92-AFC-02P` "Pipeline"
// sub-docket (a companion filing under an already-resolved 1992 AFC, not
// its own power-plant listing) was also found live and is naturally
// excluded since it has no independent Project Type/Status of its own on
// the listing page.
//
// STATUS: CEC's own "Project Status" field is, unusually for this series,
// the accurate, actively-maintained ground truth — real values spot-checked
// against actual docket filing histories (not just trusted at face value,
// per this series' standing skepticism of self-reported status fields):
// Darden Clean Energy Project (23-OPT-02) correctly reads "Compliance -
// Construction" (already approved, now in post-certification construction
// monitoring — resolved); Fountain Wind Project (23-OPT-01) correctly reads
// "Denied", and its docket log's own document titles include a real "Project
// Permit Denial" filing; Morton Bay Geothermal Project (23-AFC-01) reads
// "Under Review", and a full scan of that docket's own 388 real filings
// (oldest 4/18/2023) found no "Final Decision"/"Commission Decision"/denial
// document — only a procedural "Preliminary Decision of Compliance (PDOC)"
// (an air-district compliance sub-step, not CEC's own siting decision) and
// an "Approved Jurisdictional Determination Request" (whether CEC has
// jurisdiction at all, not whether the project is approved).
// This module treats CEC's own listing-page "Project Status" as the primary
// signal (server-side `?field_project_status_value=Under_Review` /
// `Suspended_Proceedings` filters ARE the candidate query) and additionally
// re-scans each candidate's own docket log for a qualifying resolution
// filing as a belt-and-suspenders check (same spirit as MO PSC/UT PSC's
// distrust of a bare status field) in case a status update lags a real
// decision on some future project. Running that check against the full real
// live population (not just the two spot-checked dockets above) caught a
// real false positive: Elmore North Geothermal Project's own docket
// (23-AFC-02, genuinely still "Under Review") contains a filing titled
// "Notice Of Decision By The ICAPCD To Issue A Determination Of Compliance
// To Elmore North Geothermal, LLC" — ICAPCD is Imperial County's own local
// Air Pollution Control District, not the CEC; its unrelated local
// air-permit "Notice of Decision" is not a Commission siting decision. An
// earlier version of RESOLUTION_TITLE_RE included a bare "notice of
// decision" alternative and matched this, which would have wrongly deleted
// a real still-waiting project the very first time this module ran against
// the live population. RESOLUTION_TITLE_RE below keeps only phrases with a
// directly-confirmed real CEC-issued final-action example ("Final
// Decision"/"Commission Decision"/"Project Permit Denial", each anchored at
// the start of the title so a real near-miss like "Communication from CEC
// Staff on Proposed Final Decision" — which contains the substring "final
// decision" without being one — doesn't also false-positive).
// "Suspended Proceedings" is CEC's own distinct status for a docket
// formally paused (found live: Morton Bay Geothermal's own docket includes
// a real "Joint Order Partially Granting Applicants' Motion to Suspend and
// Further Orders", 3/20/2025 — but note Morton Bay's own LISTING status is
// still "Under Review", not "Suspended Proceedings", meaning CEC's
// "Suspended Proceedings" status bucket is reserved for a different,
// stronger form of suspension than an in-docket motion order like this one
// — 0 real candidates carried "Suspended Proceedings" as of 2026-08-24, but
// this module still queries it since a suspended-not-decided project is
// still "waiting," not resolved, and excluding the bucket would silently
// drop such a project the day one exists).
//
// FUEL/PROJECT TYPE & CAPACITY: Capacity is free text on every real project
// found ("250 megawatts, 1,000 megawatt-hours", "1,150 MW (9,200 MWh)",
// "90.7-megawatts, 362.8 megawatt-hours", "1,150 megawatts (MW) PV / 1,150
// MW, 4,600 MW-hours storage", "77 MW (Net)") — CAPACITY_MW_RE below takes
// the first MW figure (the generation/power rating) and explicitly excludes
// an adjacent MWh/megawatt-hour(s) storage-energy figure via a negative
// lookahead, confirmed against all 10 real "Under Review"/"Suspended
// Proceedings" candidates including the hyphen-glued "90.7-megawatts" typo
// form. Only the MW figure is captured; a co-located MWh storage figure is
// not (matches this series' practice of not inventing a second capacity
// field). Fuel/technology comes from the project's own name/Technology
// field: "Battery Storage System" (project type storage, no further fuel
// subtype), and "Steam Turbine" for the current geothermal AFC population
// specifically identified as geothermal by name (all 3 real 23-AFC-0x
// projects are named "... Geothermal Project") rather than by the
// Technology field alone, which just says "Steam Turbine" and doesn't by
// itself distinguish geothermal from a gas- or solar-thermal steam plant —
// FUEL_KEYWORDS below checks the combined project name + Technology text.
// LOCATION/COUNTY: CEC's own "Location" field is inconsistent — usually "X
// County" or "X County, California" but real gotcha found live: Compass
// Energy Storage Project's Location reads "San Juan Capistrano" (a city,
// not a county) with no county named at all. Per this series' standing
// lesson (Maryland's greedy county regex bug — see moPscDockets.ts-adjacent
// modules' headers), this module does NOT attempt a free-form "word(s)
// before County" regex; CA_COUNTIES below is a hardcoded whitelist of all
// 58 real California county names, and a project's Location text is
// searched for one of them followed by "County" — Compass's city-only
// Location correctly yields no match (county left null) rather than a
// guess.
//
// Both listing-facet fetches (2 project types x 2 statuses = 4 requests)
// plus one detail-page fetch and one docket-log fetch per real candidate
// (10 real candidates as of 2026-08-24) comfortably clears the 300s cron
// budget with room to spare — MAX_CANDIDATES is set well above the current
// real population, not capped down to it.
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): `?field_
// project_status_value=Under_Review`/`Suspended_Proceedings` IS the
// candidate query — once CEC's own listing marks a project "Denied",
// "Compliance - Construction", or any other resolved status, it simply
// stops appearing in `allCandidates` on every future run, never reaching
// this module's own docket-log resolution check at all. Originally fixed
// by pushing a resolved stub (guessing currentStage="cancelled") for any
// previously-tracked ca-cec matchKey no longer in this run's listed set,
// so common.ts would delete it. That fix is now itself superseded:
// common.ts no longer deletes resolved-stage projects (they're kept and
// surfaced through the frontend's Status filter), so guessing "cancelled"
// for a project that dropped off the listing would mean permanently
// mislabeling it — it's at least as likely to have been approved
// ("Compliance - Construction" is itself an approved status) — in a
// bucket real users can now see. A project that drops off the listing is
// therefore left untouched, not guessed into a resolved stage.
//
// Wired to Vercel Cron weekly, 06:30 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-ca-cec/route.ts). Real timing measured
// 2026-08-24 against the live shared DB: a full run against the real
// population (10 candidates) completed in ~20s, comfortably inside the
// 300s cron budget.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const SITE_BASE_URL = "https://www.energy.ca.gov";
const EFILING_BASE_URL = "https://efiling.energy.ca.gov";

export const MAX_CANDIDATES = 100;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as every other module in this series, not a full HTML-entity
// library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

// See module header SCOPING: only these two CEC docket-prefix families are
// the real construction/siting gate for a named project.
const PROJECT_TYPE_FACETS = ["AFC", "Optin"] as const;
// See module header STATUS: both mean "still waiting," neither is resolved.
const PROJECT_STATUS_FACETS = ["Under_Review", "Suspended_Proceedings"] as const;

interface ListingCandidate {
  href: string;
  title: string;
}

// Confirmed live 2026-08-24 against the real
// /proceedings/power-plant-listing?field_project_type_value=...&field_project_status_value=...
// response — a Drupal Views GET-based exposed filter, no auth, no
// postback needed. Row shape: `<a href="/powerplant/{category}/{slug}"
// hreflang="en">{Title}</a>` inside each `views-row`.
const LISTING_ROW_RE = /href="(\/powerplant\/[^"]+)" hreflang="en">([^<]+)</g;

async function fetchListingCandidates(): Promise<ListingCandidate[]> {
  const seen = new Map<string, ListingCandidate>();
  for (const projectType of PROJECT_TYPE_FACETS) {
    for (const projectStatus of PROJECT_STATUS_FACETS) {
      const url = `${SITE_BASE_URL}/proceedings/power-plant-listing?field_project_type_value=${projectType}&field_project_status_value=${projectStatus}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`CEC power plant listing request failed (${res.status}) for ${projectType}/${projectStatus}`);
      }
      const html = await res.text();
      for (const m of html.matchAll(LISTING_ROW_RE)) {
        const href = m[1];
        if (!seen.has(href)) {
          seen.set(href, { href, title: stripTags(m[2]) });
        }
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }
  return [...seen.values()];
}

interface DetailInfo {
  owner: string | null;
  docketNumber: string | null;
  capacityText: string | null;
  location: string | null;
  technology: string | null;
  projectStatusText: string | null;
  projectTypeText: string | null;
}

// See module header FETCHING: the "at a glance" `<dl>` block on each power
// plant's own detail page, confirmed live 2026-08-23/24 across 139 real
// pages.
function extractDtDd(html: string, label: string): string | null {
  const re = new RegExp(`<dt>${label}</dt>\\s*<dd>([\\s\\S]*?)</dd>`, "i");
  const m = re.exec(html);
  return m ? stripTags(m[1]) : null;
}

async function fetchDetail(href: string): Promise<DetailInfo> {
  const res = await fetch(`${SITE_BASE_URL}${href}`);
  if (!res.ok) throw new Error(`CEC power plant detail request failed (${res.status}) for ${href}`);
  const html = await res.text();
  return {
    owner: extractDtDd(html, "Project Owner"),
    docketNumber: extractDtDd(html, "Docket Number"),
    capacityText: extractDtDd(html, "Capacity"),
    location: extractDtDd(html, "Location"),
    technology: extractDtDd(html, "Technology"),
    projectStatusText: extractDtDd(html, "Project Status"),
    projectTypeText: extractDtDd(html, "Project Type"),
  };
}

interface DocketFiling {
  date: Date | null;
  title: string;
}

function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Confirmed live 2026-08-24 against the real
// efiling.energy.ca.gov/Lists/DocketLog.aspx?docketnumber={id} response's
// `#MainContent_grdFilings` GridView — one row per filing, "Docketed Date"
// then "Document Title" (the title itself is the first text inside a
// `<strong>` tag in the cell; a docket may also carry a plain-text
// description line after it, not captured here). Real gotcha caught by
// testing against 23-AFC-01's own full 388-row filing history: a plain
// substring match of `<strong><a...>` alone only matched 365 of 388 real
// rows — 23 real rows (e.g. TN 253335, "Figure DRR 9d-1 Injection Wells and
// Formations") are sub-exhibit attachments with a bare `<strong>Title
// </strong>` and NO wrapping `<a>` link at all (no PDF to link to). The
// `<a>` is now optional so both forms match — confirmed this recovers all
// 388/388 real rows.
const FILING_ROW_RE =
  /<td>\d+<\/td><td>([^<]*)<\/td><td[^>]*>\s*<span[^>]*><strong>(?:<a[^>]*>)?([^<]*)</g;

async function fetchDocketFilings(docketNumber: string): Promise<DocketFiling[]> {
  const url = `${EFILING_BASE_URL}/Lists/DocketLog.aspx?docketnumber=${encodeURIComponent(docketNumber)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CEC docket log request failed (${res.status}) for ${docketNumber}`);
  const html = await res.text();
  const filings: DocketFiling[] = [];
  for (const m of html.matchAll(FILING_ROW_RE)) {
    filings.push({ date: parseMDY(decodeHtmlEntities(m[1])), title: stripTags(m[2]) });
  }
  if (filings.length === 0) {
    throw new Error(
      `CEC docket log for ${docketNumber} returned zero parsed filing rows — the GridView row structure likely changed. Check FILING_ROW_RE in src/lib/ingest/caCecDockets.ts against a fresh response.`,
    );
  }
  return filings;
}

// See module header STATUS: a belt-and-suspenders re-check of each
// candidate's own filing titles, anchored (not a bare substring match) so a
// real "Communication from CEC Staff on Proposed Final Decision"-style
// near-miss doesn't false-positive. Real false positive caught by running
// this check against the actual live population (not just the single
// Morton Bay/Willow Rock spot-checks done while designing it): Elmore North
// Geothermal's own real docket (23-AFC-02, still genuinely "Under Review")
// contains "Notice Of Decision By The ICAPCD To Issue A Determination Of
// Compliance To Elmore North Geothermal, LLC" — ICAPCD is Imperial County's
// own local Air Pollution Control District, not the CEC; its own unrelated
// air-permit "Notice of Decision" is not a Commission siting decision at
// all. An earlier version of this regex included a bare "notice of
// decision" alternative (modeled on Willow Rock's real "Notice of
// Availability of...Proposed Decision"-adjacent corpus) which matched this
// false positive and would have wrongly deleted a real still-waiting
// project from the site. "notice of decision" was removed entirely rather
// than patched to also require "commission"/"CEC" (no real CEC-issued
// example of that exact phrase was found in this project's own corpus to
// confirm a safe pattern against) — only phrases with a directly-confirmed
// real CEC final-action example are kept.
const RESOLUTION_TITLE_RE =
  /^(\*{0,3}\s*)?(commission (order and )?final decision|commission decision|final decision|project permit denial)\b/i;
const DENIAL_TITLE_RE = /\border denying\b/i;

interface ResolutionCheck {
  resolved: boolean;
  denied: boolean;
  earliestDate: Date | null;
}

function checkDocketResolution(filings: DocketFiling[]): ResolutionCheck {
  let earliestDate: Date | null = null;
  let resolved = false;
  let denied = false;
  for (const f of filings) {
    if (f.date && (earliestDate === null || f.date < earliestDate)) earliestDate = f.date;
    if (RESOLUTION_TITLE_RE.test(f.title) || DENIAL_TITLE_RE.test(f.title)) {
      resolved = true;
      if (DENIAL_TITLE_RE.test(f.title) || /denial/i.test(f.title)) denied = true;
    }
  }
  return { resolved, denied, earliestDate };
}

// See module header FUEL/PROJECT TYPE & CAPACITY: takes the first MW
// figure, explicitly excluding an adjacent MWh/megawatt-hour(s) storage
// figure via the negative lookahead.
const CAPACITY_MW_RE = /([\d,]+(?:\.\d+)?)\s*-?\s*(?:MW|megawatts?)(?!\s?-?\s?[Hh])/i;

function extractCapacityMw(capacityText: string | null): number | null {
  if (!capacityText) return null;
  const m = CAPACITY_MW_RE.exec(capacityText);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// See module header LOCATION/COUNTY: hardcoded whitelist of all 58 real
// California counties, per this series' standing lesson against a
// free-form "word(s) before County" regex.
const CA_COUNTIES = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa",
  "Contra Costa", "Del Norte", "El Dorado", "Fresno", "Glenn", "Humboldt",
  "Imperial", "Inyo", "Kern", "Kings", "Lake", "Lassen", "Los Angeles",
  "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc", "Mono",
  "Monterey", "Napa", "Nevada", "Orange", "Placer", "Plumas", "Riverside",
  "Sacramento", "San Benito", "San Bernardino", "San Diego",
  "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo",
  "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta", "Sierra",
  "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama",
  "Trinity", "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba",
];

function extractCounty(location: string | null): string | null {
  if (!location) return null;
  for (const county of CA_COUNTIES) {
    const re = new RegExp(`\\b${county.replace(/ /g, "\\s+")}\\s+County\\b`, "i");
    if (re.test(location)) return county;
  }
  return null;
}

// See module header FUEL/PROJECT TYPE & CAPACITY.
const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bgeothermal\b/i, "geothermal"],
  [/\bsolar\b|photovoltaic/i, "solar"],
  [/\bwind\b/i, "wind_onshore"],
  [/natural gas|gas[- ]fired|combined cycle|simple cycle|combustion turbine/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
];

function inferProjectTypeAndFuel(
  title: string,
  technology: string | null,
): { projectType: ProjectType; fuelType: FuelType } {
  const combined = `${title} ${technology ?? ""}`;
  const isStorage = /\bbattery\b|\bstorage\b/i.test(combined);
  const fuelMatch = FUEL_KEYWORDS.find(([re]) => re.test(combined));
  if (fuelMatch) {
    // A hybrid generation+storage project (e.g. "Solar Photovoltaic (PV) +
    // Battery Energy Storage") is classified by its generation technology,
    // matching moPscDockets.ts's precedent of picking the primary
    // technology rather than inventing a hybrid ProjectType value.
    return { projectType: "generation", fuelType: fuelMatch[1] };
  }
  if (isStorage) return { projectType: "storage", fuelType: "storage" };
  if (/\btransmission\b|\bsubstation\b|\bswitchyard\b|kilo-?volt|\bkv\b/i.test(combined)) {
    return { projectType: "transmission", fuelType: "transmission" };
  }
  return { projectType: "generation", fuelType: "other" };
}

function normalizeCandidate(
  candidate: ListingCandidate,
  detail: DetailInfo,
  resolution: ResolutionCheck,
): NormalizedProject | null {
  if (!detail.docketNumber) return null;

  // Belt-and-suspenders override — see module header STATUS. Neither branch
  // was hit against the real 2026-08-24 population, but both are handled
  // explicitly rather than silently trusting the listing-page status.
  const currentStage: ProjectStage = resolution.resolved
    ? resolution.denied
      ? "cancelled"
      : "approved_awaiting_construction"
    : "local_review";

  const matchKey = resolveMatchKey("ca-cec", detail.docketNumber);
  const { projectType, fuelType } = inferProjectTypeAndFuel(candidate.title, detail.technology);
  const capacityValue = extractCapacityMw(detail.capacityText);
  const county = extractCounty(detail.location);

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the California Energy Commission's power plant licensing docket system — an Application for Certification (AFC, traditional ≥50MW thermal/geothermal siting process) or Opt-In certification (AB 205, streamlined ≥50MW solar/wind or ≥200MWh storage siting process).",
    "CEC's own \"Project Status\" field on its power plant listing page is used as the primary still-waiting signal, cross-checked against the docket's own filing history for a Final Decision/Commission Decision/denial document — see the ingestion module header for how this was calibrated against real dockets.",
  ];
  if (detail.projectStatusText && detail.projectStatusText.toLowerCase().includes("suspend")) {
    dataQualityNoteParts.push("This docket's proceedings are currently formally suspended (paused), per CEC's own listing — still not resolved, but not under active review either.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the project's name or CEC's own \"Technology\" field.");
  }
  if (capacityValue === null) {
    dataQualityNoteParts.push("Capacity could not be parsed from CEC's free-text Capacity field.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, California, per CEC's own Location field — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No county could be confidently determined from CEC's own Location field (which is not always a county name), and no structured coordinates are published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: candidate.title,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "CA",
    county,
    capacityValue,
    capacityUnit: capacityValue !== null ? "MW" : null,
    applicationFiledDate: resolution.earliestDate,
    dateConfidence: "exact",
    currentStatus: `CEC Docket ${detail.docketNumber}: ${detail.projectStatusText ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on California Energy Commission certification — Docket ${detail.docketNumber}${detail.projectTypeText ? ` (${detail.projectTypeText})` : ""}, "${candidate.title}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `CEC Docket ${detail.docketNumber}`,
        url: `${EFILING_BASE_URL}/Lists/DocketLog.aspx?docketnumber=${encodeURIComponent(detail.docketNumber)}`,
      },
      {
        label: candidate.title,
        url: `${SITE_BASE_URL}${candidate.href}`,
      },
    ],
    externalIds: { caCec: detail.docketNumber },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestCaCecDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allCandidates = await fetchListingCandidates();
  const candidates = selectWithRotation(allCandidates, maxCandidates, ROTATING_RECENT_SLOTS);

  const rotatingTier = new Set(candidates.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const detail = await fetchDetail(candidate.href);
      await sleep(REQUEST_DELAY_MS);
      if (!detail.docketNumber) {
        errors.push({ matchKey: candidate.href, message: "No Docket Number found on detail page" });
        continue;
      }
      const filings = await fetchDocketFilings(detail.docketNumber);
      const resolution = checkDocketResolution(filings);
      const normalized = normalizeCandidate(candidate, detail, resolution);
      if (normalized) {
        toUpsert.push(normalized);
        if (rotatingTier.has(candidate)) rotatingMatchKeys.add(normalized.matchKey);
      }
    } catch (err) {
      errors.push({ matchKey: candidate.href, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a project CEC
  // marks resolved (or reclassified out of the listing query entirely) is
  // deliberately left untouched now, not guessed into a resolved stage —
  // see the header for why.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allCandidates.length,
    realApplicationCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestCaCecDockets()
    .then((summary) => {
      console.log(
        `California CEC docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.realApplicationCandidates} real AFC/Opt-In applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
