// Maine Department of Environmental Protection (DEP) Land Bureau permit
// ingestion — covering Site Location of Development Act ("Site Law", 38
// M.R.S. §§481-490) applications, plus the small number of related
// individual NRPA/wind-specific filings that share the same public data
// table — one of several states built in parallel in the per-state series
// started with vaSccDockets.ts (see that file's header for the overall
// rationale). Confirmed by hand 2026-08-24 via real GET requests (Node's own
// `fetch`) against the live maine.gov / gis.maine.gov sites — no assumption
// below was taken from documentation or training-data memory alone.
//
// WHY DEP, NOT PUC: the task brief for this module started from the hint
// that Maine's Public Utilities Commission (PUC) issues Certificates of
// Public Convenience and Necessity (CPCN) under 35-A M.R.S. §3132 — the same
// hint that turned out incomplete for Washington (WUTC vs EFSEC), Oregon
// (PUC vs EFSC), Massachusetts (DPU vs EFSB), Connecticut (PURA vs CSC), and
// New Hampshire (PUC-attached vs SEC). Checked here too, per this project's
// "confirm before guessing" rule, by reading §3132 directly
// (legislature.maine.gov/statutes/35-A/title35-Asec3132.html). Maine's
// version of this pattern is more of a SPLIT than a total misdirection:
// §3132's CPCN is real, but it applies ONLY to standalone transmission lines
// rated 100kV or higher, and it explicitly EXCLUDES "the construction of a
// generator interconnection transmission facility" — i.e. most new
// transmission built to connect a specific generator never touches PUC at
// all. More importantly, Maine deregulated electric generation in 2000
// (35-A M.R.S. ch. 32) — generation and storage facilities have NO PUC
// certificate requirement whatsoever in Maine, at any size. So a solar farm,
// wind farm, battery storage project, or gas plant — the bulk of what this
// site tracks — never appears in any PUC docket. The real, broad
// construction gate for those projects (and, since a 2023 amendment, for
// "high-impact" electric transmission lines too) is DEP's Site Location of
// Development Act: no development meeting Site Law's thresholds (>20 acres;
// certain structure/subdivision sizes; any offshore wind project ≥3MW; and,
// per P.L. 2023 ch. 448, high-impact transmission lines) may be constructed
// without a DEP-issued Site Law license. DEP's own Site Law page
// (maine.gov/dep/land/sitelaw/) confirms wind energy developments get a
// dedicated set of Site Law application sections (26-30, covering shadow
// flicker, tangible benefits, decommissioning, etc.) within the SAME
// licensing system, not a separate agency — so wind is covered here too,
// without needing a second source. The Maine Land Use Planning Commission
// (LUPC) was also checked: LUPC's role in unorganized territories is
// land-use/zoning approval (the local-government-equivalent layer), not a
// substitute for DEP's own environmental Site Law review, which DEP's own
// solar-decommissioning guidance confirms it still administers "in
// organized municipalities and unorganized/deorganized areas" alike when a
// project needs a Site Law permit. This module therefore ingests DEP's Land
// Bureau permit data, not a PUC docket search — hence the file name
// departing from the literal "me{Agency}Dockets" pattern, same kind of
// adaptation waEfsecFacilities.ts and azAccLineSiting.ts made for their own
// non-"dockets" sources. Maine PUC's own genuinely narrow §3132 CPCN
// authority (standalone, non-interconnection transmission ≥100kV) is a real
// but much smaller population, deliberately left out of THIS module's scope
// (known, accepted gap — a future module could add it the way MA's own
// DPU-Siting "Transmission Line" track was deliberately left out of
// maEfsbDockets.ts as a companion-filing duplicate risk).
//
// FETCHING: the public HTML page at
// maine.gov/dep/gis/datamaps/LAWB_Permits/index.html ("The Maine DEP Permits
// table... posted in real time... reflect[ing] the previous 3 years of
// activity") turned out to be a thin DataTables wrapper around a live
// ArcGIS FeatureServer table, confirmed by reading the page's own inline
// `$('#pubstable').DataTable({ajax: {url: ...}})` initializer:
//   GET https://gis.maine.gov/mapservices/rest/services/dep/Land_Licensing/
//       MapServer/6/query?where=<...>&outFields=*&f=pjson
// This is a genuine public ArcGIS REST endpoint — no auth, no CAPTCHA, no
// session, confirmed by hand with a bare Node `fetch()` and no special
// headers at all. `MapServer/6` ("MaineDEP_Land_License_Web_Table_MELS") is
// a Table (not a spatial layer — no lat/lon geometry is published for these
// records; a separate `MapServer/1` "Land Licensing Points" layer exists but
// is a wetland-impact/compensation dataset with entirely different fields,
// confirmed by hand not to correspond 1:1 with this table's applications).
// The table's own `maxRecordCount` is 12000 (confirmed via
// `MapServer/6?f=pjson`) against a real total population of 10,764 rows as
// of this writing, so a single query returns everything without
// server-side pagination in practice — this module still loops defensively
// via `resultOffset`/`exceededTransferLimit`, same practice as every other
// module in this series that pages a search result.
//
// SCOPING: this table is DEP's ENTIRE Land Bureau licensing history, not
// just energy — the vast majority of its 10,764 rows are ordinary NRPA/
// Stormwater/Site Law matters with nothing to do with energy (subdivisions,
// docks, driveways, shoreline stabilization, playgrounds, self-storage
// facilities). Two layers of filtering are used, confirmed against real
// data:
//   1. LICENSE_NUMBER prefix exclusion. Real prefixes observed (2026-08-24):
//      "L-" (a general Land Bureau license — covers Site Law, NRPA
//      individual, and Stormwater permits alike, confirmed NOT specific to
//      Site Law by itself: e.g. L-100691 is "Willard Beach Playground," not
//      an energy project), "PBR_ID-" (5,413 rows — Permit By Rule, Maine's
//      own lightweight EXEMPTION process for smaller qualifying activities;
//      DEP's own PBR page says an un-reviewed PBR notification is
//      "implicitly accepted" after 14-20 days — explicitly the kind of
//      "permit-exemption process" this project's brief says to exclude, not
//      a real construction gate), "MEG" (405 rows — confirmed by hand to be
//      an ancillary/companion filing category, not the underlying siting
//      certificate: one real example literally reads "Wind Energy Project -
//      MCGP NOI" [Maine Construction General Permit Notice of Intent — a
//      stormwater-discharge-during-construction registration], and several
//      others are the state's separate Solar Decommissioning Law license
//      (35-A M.R.S. §§3491-3496 — a financial-assurance filing required
//      for solar projects ≥3 acres, filed alongside or after the real Site
//      Law approval, confirmed by hand: MEG100380 "Hartland Solar Facility
//      Phase 1" shows a 5-day received-to-concluded turnaround, implausible
//      for a real environmental review but typical of a decommissioning-plan
//      sign-off), and "DA" (only 6 rows total across the whole table, all
//      residential-subdivision amendment filings in the real data checked —
//      excluded defensively, known small gap if a future energy project's
//      only record ever used this prefix). Only "L-"-prefixed and
//      not-yet-license-numbered (freshly received, LICENSE_NUMBER still
//      null) rows are kept.
//   2. Content filtering on PROJECT_DESCRIPTION (CONTENT_RE / EXCLUDE_RE,
//      see below) — the only way to separate a genuine solar/wind/storage/
//      transmission/gas project from the thousands of unrelated Land Bureau
//      matters sharing the same "L-" prefix, since PROJECT_DESCRIPTION is a
//      free-text field the applicant/agent wrote, same as every other
//      state's docket-caption text.
// Two real, confirmed-live false-positive classes found and excluded:
//   - `\bwind\b` alone false-positives on ordinary shoreline-erosion permits
//     ("wind driven waves," "severe storm... wind & waves caused...
//     erosion") that have nothing to do with wind energy. WIND_RE below
//     requires "wind" be immediately followed by turbine/energy/farm/power/
//     project, or "offshore wind" — confirmed this still matches both real
//     wind candidates found (Rumford's "Twin Energy Wind Project" and a real
//     Castine "FLOATING OFFSHORE WIND TURBINE" pilot deployment) while
//     dropping the erosion false positives. EXCLUDE_RE also drops riprap/
//     erosion/shoreline-stabilization language outright as a second layer.
//   - A residential "Garden shed with solar roof" (Gouldsboro) is real,
//     live, content-matching text ("solar") that is obviously not a
//     generation project — EXCLUDE_RE drops garden-shed/garage/rooftop/
//     residence/residential language for this reason (this exact row was
//     already resolved status "Completed" as of this writing so doesn't
//     affect the live candidate set, but is kept as a documented guard for
//     the next residential rooftop mention this system logs).
//
// STATUS: unlike most of this series (where a source's own "Status" field
// turned out unreliable, absent, or needed cross-checking against a second
// signal), Maine DEP's STATUS field here is a genuinely rich, structured
// enum — confirmed by hand via `returnDistinctValues=true`: 20 real observed
// values, cleanly separating "still pending" (Received, In Process, Locked
// for Review, Action Required) from a real spread of final dispositions
// (Completed / Completed - Implicitly Accepted; Denied; Cancelled; six
// distinct Withdrawn-* variants; eight distinct Returned-* variants). No
// filed-document cross-check was needed or is available (DEP's public table
// doesn't expose a per-application filing/order list the way MA/CT/NH/WV's
// docket systems do — see FUEL/PROJECT TYPE below). STATUS_TO_STAGE is
// exhaustive over exactly these 20 values and throws (caught per-candidate)
// on anything unrecognized, same defensive posture as
// waEfsecFacilities.ts's STATUS_TO_STAGE. "Completed" is trusted as a real
// approval (not just "administratively closed regardless of outcome")
// specifically because Denied/Cancelled/Withdrawn-*/Returned-* all exist as
// their OWN separate values — DEP already did the disposition-classification
// work this project's other states often had to reconstruct by hand from
// prose. "Completed - Implicitly Accepted" (DEP's own term for the PBR
// implicit-acceptance path — see SCOPING) is kept in the map for
// completeness but should never actually fire here since PBR_ID-prefixed
// rows are excluded before STATUS is even consulted.
//
// VANISHED-CANDIDATE FIX: applied, defensively, even though this module's
// own fetch is NOT scoped to "active/open only" the way the WV/CT/TN/CA bug
// class the project brief warns about was — every run fetches ALL matching
// rows regardless of STATUS (open or resolved alike) and lets STATUS_TO_STAGE
// classify each one, the same "search everything, let STATUS scanning do the
// work" shape nhSecDockets.ts uses, which is what makes NH's own module
// correctly NOT need this fix. Maine DOES need it anyway, for a different,
// source-specific reason: DEP's own permits page states outright that it
// "reflect[s] the previous 3 years of activity" (confirmed live: the
// oldest RECEIVED_DATE across the whole 10,764-row table is 2023-08-25,
// almost exactly 3 years before this module was written) — i.e. this is a
// ROLLING retention window, not a durable archive (superseded 2026-08-25).
// A Site Law application that stayed genuinely "In Process" for longer
// than 3 years (not implausible for a large, contested project) could in
// principle age out of this window and simply stop being returned by ANY
// query against this table, open or resolved, without this module ever
// seeing a resolving STATUS for it. Originally fixed by pushing a
// resolved stub (guessing currentStage="cancelled") for any
// previously-tracked "me-dep:" matchKey no longer present in this run's
// full survivor list, so common.ts would delete it. That fix is now
// itself superseded: common.ts no longer deletes resolved-stage projects
// (they're kept and surfaced through the frontend's Status filter), so
// guessing "cancelled" for an aged-out project would mean permanently
// mislabeling it — it's at least as likely to have been approved — in a
// bucket real users can now see. A project that ages out of the window is
// therefore left untouched, not guessed into a resolved stage.
//
// FUEL/PROJECT TYPE & CAPACITY: no second per-candidate request is made at
// all (a real efficiency win vs. most of this series — DEP's one table
// query already returns name/status/date/description for every row, unlike
// MA/CT/NH/WV which all need a second per-docket fetch for this data).
// Fuel/type/capacity are parsed from PROJECT_DESCRIPTION alone, same
// regex-over-prose approach as nyDpsDockets.ts/maEfsbDockets.ts. Real,
// confirmed-live gotcha: capacity is frequently written with NO leading
// digit before the decimal point — "GIRI SEBASCO SOLAR LLC" reads exactly
// ".999 MW AC SOLAR ENERGY PROJECT" (not "0.999") — a capacity regex
// requiring at least one digit before an optional decimal point silently
// missed this real row when first tried; CAPACITY_RE below explicitly
// alternates a bare `.\d+` branch to catch it.
//
// DUPLICATE/MULTI-ROW GOTCHA: this table is not one-row-per-physical-project.
// Two distinct duplication patterns were found and handled, plus one that
// is a known, accepted gap:
//   1. The exact same LICENSE_NUMBER/ATS_NUMBER pair sometimes appears twice
//      with identical everything except TAX_MAP_MAP_NUMBER/TAX_MAP_LOT_NUMBER
//      (one row null, one populated) — confirmed live (L-100556, Searsport).
//      Handled by deduplicating on a single key.
//   2. The SAME LICENSE_NUMBER can carry more than one ATS_NUMBER
//      sub-transaction simultaneously "In Process" (confirmed live:
//      L-029246 "15B Old South Rd Solar LLC" has both a "downsized project"
//      amendment ATS row and a "construction of a 1 MW community solar
//      garden" ATS row open at once). Deduplicated by keying on
//      LICENSE_NUMBER when one is assigned (falling back to ATS_NUMBER only
//      for not-yet-license-numbered rows), keeping the most recently
//      RECEIVED_DATE row per key as the representative record.
//   3. Known, accepted gap, NOT deduplicated (same shape as maEfsbDockets.ts
//      leaving standalone DPU-Siting "Transmission Line" petitions
//      uncorrelated with their EFSB companion): a single physical project
//      can legitimately have TWO separate, uncorrelated LICENSE_NUMBER/
//      ATS_NUMBER identities in this table at once — confirmed live,
//      "Perennial Stelladoro Solar LLC" (Manchester) has both L-100488 (a
//      licensed Site Law application) and a separate not-yet-licensed
//      ATS row (HQJ-E2F1-J42AK, its own NRPA stream-crossing review) — with
//      DIFFERENT internal GIS_OBJECTID values, so no reliable shared key
//      exists to merge them automatically. This project's own
//      cross-source-identity policy (see common.ts) is to never guess a
//      merge; a human can add a manualOverrides.csv row for a specific case
//      like this if it's confirmed to be worth collapsing into one site
//      entry.
//
// LOCATION: TOWN is a genuine structured field here (unlike most of this
// series, which has to regex-extract a town/county out of free-text prose)
// — but it is a MUNICIPALITY, not a county; Maine DEP's own table does not
// publish county at all. Recorded in this project's `county` field anyway
// (title-cased for display consistency, since raw values are inconsistently
// ALL-CAPS or Title Case across rows), same field-reuse maEfsbDockets.ts and
// ctCscDockets.ts both document for their own town-not-county sources,
// flagged in dataQualityNote. Building/maintaining a full ~500-municipality
// Maine town-to-county lookup table was considered and rejected as
// disproportionate effort for this module (Maine's own 16-county whitelist,
// per the task brief's own suggestion, applies to extracting a county name
// mentioned in free text — not to inferring an unstated county from a town
// name, which is a fundamentally different, much larger lookup problem).
//
// Wired to Vercel Cron weekly (see vercel.json and
// src/app/api/cron/ingest-me-dep/route.ts). Real full-population timing
// measured 2026-08-24 against the live shared DB: one ArcGIS table query
// (988 raw content-matched rows before prefix/exclude filtering) plus the
// vanished-candidate DB diff — no per-candidate HTTP requests at all — took
// well under 5 seconds end to end, comfortably inside the 300s cron budget.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const QUERY_URL = "https://gis.maine.gov/mapservices/rest/services/dep/Land_Licensing/MapServer/6/query";
// Public, human-readable page this data is embedded in (the ArcGIS endpoint
// itself is JSON-only) — see module header FETCHING.
const TABLE_PAGE_URL = "https://www.maine.gov/dep/gis/datamaps/LAWB_Permits/index.html";

// Comfortably above the current real survivor population (~210 rows, open
// and resolved combined, after prefix+content filtering — see module header
// SCOPING) — this module makes no per-candidate HTTP requests at all, so a
// generous cap costs nothing.
export const MAX_CANDIDATES = 500;
const PAGE_SIZE = 2000;

// Broad net, confirmed against real data to comfortably contain every real
// energy candidate while still cutting the ~10,764-row full table down to a
// manageable size server-side — see module header SCOPING. Re-verified
// client-side by CONTENT_RE below rather than trusted alone.
const CONTENT_KEYWORDS = [
  "solar",
  "photovoltaic",
  "wind",
  "battery",
  "energy storage",
  "bess",
  "transmission",
  "substation",
  "natural gas",
  "biomass",
  "hydroelectric",
  "landfill gas",
  "LNG",
  "liquefied natural gas",
  "megawatt",
  "generat",
];

interface DepRecord {
  GIS_OBJECTID: string | null;
  ATS_NUMBER: string;
  LICENSE_NUMBER: string | null;
  TOWN: string | null;
  APPLICANT_NAME: string | null;
  PROJECT_DESCRIPTION: string | null;
  STATUS: string;
  RECEIVED_DATE: string | null;
}

function buildWhereClause(): string {
  const contentOr = CONTENT_KEYWORDS.map((k) => `UPPER(PROJECT_DESCRIPTION) LIKE UPPER('%${k}%')`).join(" OR ");
  // Excludes PBR/MEG/DA-prefixed rows server-side too (see module header
  // SCOPING) — purely a payload-size optimization; EXCLUDED_LICENSE_PREFIX_RE
  // below re-checks the same thing client-side rather than trusting this
  // alone, same "never trust a loose LIKE alone" practice as every other
  // module in this series.
  return `(${contentOr}) AND NOT (LICENSE_NUMBER LIKE 'PBR%' OR LICENSE_NUMBER LIKE 'MEG%' OR LICENSE_NUMBER LIKE 'DA%')`;
}

async function fetchAllRecords(): Promise<DepRecord[]> {
  const where = buildWhereClause();
  const all: DepRecord[] = [];
  let offset = 0;
  for (;;) {
    const url =
      `${QUERY_URL}?where=${encodeURIComponent(where)}&outFields=GIS_OBJECTID,ATS_NUMBER,LICENSE_NUMBER,TOWN,APPLICANT_NAME,PROJECT_DESCRIPTION,STATUS,RECEIVED_DATE` +
      `&f=pjson&resultRecordCount=${PAGE_SIZE}&resultOffset=${offset}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ME DEP request failed (${res.status}): ${url}`);
    const text = await res.text();
    let parsed: { features?: { attributes: DepRecord }[]; exceededTransferLimit?: boolean; error?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        "ME DEP Land_Licensing query response wasn't valid JSON — the ArcGIS endpoint shape likely changed. Check fetchAllRecords in src/lib/ingest/meDepSiteLawPermits.ts against a fresh response.",
      );
    }
    if (parsed.error || !Array.isArray(parsed.features)) {
      throw new Error(`ME DEP Land_Licensing query returned an error or unexpected shape: ${text.slice(0, 500)}`);
    }
    all.push(...parsed.features.map((f) => f.attributes));
    if (!parsed.exceededTransferLimit && parsed.features.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  if (all.length === 0) {
    throw new Error(
      "ME DEP Land_Licensing query matched zero rows at all — the ArcGIS endpoint shape likely changed. Check buildWhereClause/fetchAllRecords in src/lib/ingest/meDepSiteLawPermits.ts against a fresh response.",
    );
  }
  return all;
}

// See module header SCOPING — client-side re-check of the server-side
// prefix exclusion.
const EXCLUDED_LICENSE_PREFIX_RE = /^(PBR|MEG|DA)/i;

// See module header SCOPING for both false-positive classes these were
// calibrated against.
const CONTENT_RE =
  /\bsolar\b|\bphotovoltaic\b|\bwind\s+(?:turbine|energy|farm|power|project)\b|\boffshore\s+wind\b|\bbattery\b|\benergy storage\b|\bbess\b|\btransmission\b|\bsubstation\b|\bnatural gas\b|\bbiomass\b|\bhydroelectric\b|\blandfill gas\b|\bLNG\b|\bliquefied natural gas\b/i;

const EXCLUDE_RE =
  /\bself[- ]storage\b|\bstormwater\b|\bdredg\w*\b|\bpaving\b|\bsubdivision\b|\bplayground\b|\bpier\b|\bdock\b|\bdriveway\b|\bfoundation\b|\bparking\b|\briprap\b|\berosion\b|\bshore(?:line)?\s+(?:stabilization|protection|frontage)\b|\bgarden shed\b|\bgarage\b|\brooftop\b|\bresidence\b|\bresidential\b/i;

function isRealCandidate(r: DepRecord): boolean {
  if (EXCLUDED_LICENSE_PREFIX_RE.test(r.LICENSE_NUMBER ?? "")) return false;
  const desc = r.PROJECT_DESCRIPTION ?? "";
  return CONTENT_RE.test(desc) && !EXCLUDE_RE.test(desc);
}

// See module header DUPLICATE/MULTI-ROW GOTCHA. LICENSE_NUMBER is preferred
// as the dedup key (stable once assigned, and confirmed to correlate
// multiple ATS_NUMBER sub-transactions for the same license); ATS_NUMBER is
// the fallback for not-yet-license-numbered rows.
function dedupeKey(r: DepRecord): string {
  return r.LICENSE_NUMBER ?? r.ATS_NUMBER;
}

function dedupeRecords(records: DepRecord[]): DepRecord[] {
  const byKey = new Map<string, DepRecord>();
  for (const r of records) {
    const key = dedupeKey(r);
    const existing = byKey.get(key);
    if (!existing || (r.RECEIVED_DATE ?? "") > (existing.RECEIVED_DATE ?? "")) byKey.set(key, r);
  }
  return [...byKey.values()];
}

// Exhaustive over the 20 real STATUS values observed live 2026-08-24 (via
// `returnDistinctValues=true`) — see module header STATUS. An unmapped 21st
// value throws (caught per-candidate) rather than silently guessing, same
// defensive posture as waEfsecFacilities.ts's STATUS_TO_STAGE.
const STATUS_TO_STAGE: Record<string, ProjectStage> = {
  Received: "local_review",
  "In Process": "local_review",
  "Locked for Review": "local_review",
  "Action Required": "local_review",
  Completed: "approved_awaiting_construction",
  "Completed - Implicitly Accepted": "approved_awaiting_construction",
  Denied: "cancelled",
  Cancelled: "cancelled",
  Withdrawn: "cancelled",
  "Withdrawn - Requested by Applicant": "cancelled",
  "Withdrawn - Failure to Respond to Correction Request": "cancelled",
  "Withdrawn - No Authority": "cancelled",
  Returned: "cancelled",
  "Returned - Entry Error": "cancelled",
  "Returned - Failure to Respond to Correction Request": "cancelled",
  "Returned - Existing Violation": "cancelled",
  "Returned - Project Not Eligible for PBR": "cancelled",
  "Returned - Incomplete for Acceptance": "cancelled",
  "Returned - Deficient": "cancelled",
  "Returned - Jurisdiction Waived": "cancelled",
};

const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b/i;
const LNG_RE = /\bliquefied natural gas\b|\bLNG\b/i;
const STORAGE_RE = /\bbattery\b|\benergy storage\b|\bbess\b/i;
const WIND_RE = /\bwind\s+(?:turbine|energy|farm|power|project)\b|\boffshore\s+wind\b/i;
const OFFSHORE_RE = /\boffshore\b/i;
const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const GAS_RE = /\bnatural gas\b|\bgas[- ]fired\b|\bcombined[- ]cycle\b/i;
const HYDRO_RE = /\bhydro/i;
const BIOMASS_RE = /\bbiomass\b|\blandfill gas\b/i;

// See module header FUEL/PROJECT TYPE & CAPACITY. TRANSMISSION/STORAGE are
// only treated as the primary project type when no generation technology is
// also present (matching waEfsecFacilities.ts's own priority ordering) —
// e.g. a solar project whose description also mentions its own substation
// or battery-storage equipment is still a "generation" project, not
// reclassified as "transmission" or "storage".
function inferProjectType(desc: string): ProjectType {
  if (LNG_RE.test(desc)) return "lng";
  if (TRANSMISSION_RE.test(desc) && !SOLAR_RE.test(desc) && !WIND_RE.test(desc)) return "transmission";
  if (STORAGE_RE.test(desc) && !SOLAR_RE.test(desc) && !WIND_RE.test(desc) && !GAS_RE.test(desc)) return "storage";
  return "generation";
}

function inferFuelType(desc: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "lng") return "lng";
  if (projectType === "storage") return "storage";
  if (WIND_RE.test(desc)) return OFFSHORE_RE.test(desc) ? "wind_offshore" : "wind_onshore";
  if (SOLAR_RE.test(desc)) return "solar";
  if (GAS_RE.test(desc)) return "gas";
  if (HYDRO_RE.test(desc)) return "hydro";
  // Maine has no native FuelType category for biomass/landfill-gas
  // generation — mapped to "other", same treatment ctCscDockets.ts gives
  // fuel-cell/waste-to-energy generation.
  if (BIOMASS_RE.test(desc)) return "other";
  return "other";
}

// See module header FUEL/PROJECT TYPE & CAPACITY for the real ".999 MW"
// (no leading digit) gotcha this alternation exists to catch.
const CAPACITY_RE = /(\d[\d,]*\.\d+|\.\d+|\d[\d,]*)\s*MW\b/i;

function extractCapacityMw(desc: string): number | null {
  const m = CAPACITY_RE.exec(desc);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function titleCaseTown(raw: string | null): string | null {
  if (!raw || raw.trim().length === 0) return null;
  return raw
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function parseReceivedDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeRecord(r: DepRecord): NormalizedProject {
  const sourceId = r.LICENSE_NUMBER ?? r.ATS_NUMBER;
  const matchKey = resolveMatchKey("me-dep", sourceId);

  const desc = r.PROJECT_DESCRIPTION ?? "";
  const applicant = r.APPLICANT_NAME?.trim() || "Unknown applicant";
  const town = titleCaseTown(r.TOWN);

  const currentStage = STATUS_TO_STAGE[r.STATUS];
  if (!currentStage) {
    throw new Error(
      `ME DEP record ${sourceId} has an unrecognized STATUS "${r.STATUS}" — STATUS_TO_STAGE in src/lib/ingest/meDepSiteLawPermits.ts needs updating.`,
    );
  }

  const projectType = inferProjectType(desc);
  const fuelType = inferFuelType(desc, projectType);
  const capacityMw = extractCapacityMw(desc);
  const filedDate = parseReceivedDate(r.RECEIVED_DATE);

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    'Sourced from the Maine Department of Environmental Protection (DEP)\'s public Land Bureau permit records — not the Public Utilities Commission (PUC). Maine deregulated electric generation in 2000, so generation and storage projects need no PUC certificate at any size, and PUC\'s own Certificate of Public Convenience and Necessity under 35-A M.R.S. §3132 covers only standalone (non-interconnection) transmission lines ≥100kV. DEP\'s Site Location of Development Act ("Site Law") is the real broad construction gate for generation, storage, and (since a 2023 amendment) high-impact transmission projects in Maine. See the ingestion module header for the full comparison.',
    'This source\'s permit table mixes Site Law applications together with every other kind of DEP Land Bureau permit (subdivisions, docks, driveways, shoreline stabilization, and more); candidates here are filtered to rows whose own project description mentions a generation/storage/transmission technology, with a lightweight "Permit By Rule" (an exemption process) and ancillary decommissioning/stormwater-general-permit filing excluded as not themselves a siting application. See the ingestion module header for details.',
    "Fuel/technology and capacity are parsed from this record's own free-text project description (the only project-detail text this source publishes in structured form), not a structured field — not independently verified against the underlying application materials.",
  ];
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from this record's project description.");
  }
  if (town) {
    dataQualityNoteParts.push(`Located in the Town of ${town}, Maine, per DEP's own record — this is a municipality, not a county (DEP's own data does not publish county); no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }
  dataQualityNoteParts.push(
    "This source's own permit table is a rolling window reflecting only the previous ~3 years of DEP Land Bureau activity, not a durable archive — a project that stayed pending for longer than that could in principle age out of what this source returns. See the ingestion module header VANISHED-CANDIDATE FIX for how this is guarded against.",
  );

  return {
    matchKey,
    name: `${applicant} — ${desc.slice(0, 80)} (ME DEP ${sourceId})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "ME",
    county: town,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: filedDate,
    dateConfidence: "exact",
    currentStatus: `ME DEP ${sourceId}: ${r.STATUS}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Site Location of Development ("Site Law") permit (or related DEP Land Bureau license) from the Maine Department of Environmental Protection — ${sourceId}, "${desc.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `ME DEP Land Bureau Permit ${sourceId}`,
        url: TABLE_PAGE_URL,
      },
    ],
    externalIds: { meDep: sourceId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestMeDepSiteLawPermits(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allRecords = await fetchAllRecords();

  const realCandidates = dedupeRecords(allRecords.filter(isRealCandidate)).slice(0, maxCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const record of realCandidates) {
    try {
      toUpsert.push(normalizeRecord(record));
    } catch (err) {
      errors.push({ matchKey: record.LICENSE_NUMBER ?? record.ATS_NUMBER, message: String(err) });
    }
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a project that
  // ages out of DEP's own ~3-year permit table is deliberately left
  // untouched now, not guessed into a resolved stage — see the header
  // for why.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = realCandidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allRecords.length,
    realApplicationCandidates: realCandidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  const started = Date.now();
  ingestMeDepSiteLawPermits()
    .then((summary) => {
      const elapsedMs = Date.now() - started;
      console.log(
        `Maine DEP Land Bureau permit ingestion complete: ${summary.candidatesFound} raw content-matched rows, ` +
          `${summary.realApplicationCandidates} real deduplicated energy candidates, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors. (${elapsedMs}ms)`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
