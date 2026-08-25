// Postal abbreviation -> full name, for the state filter. Project `state`
// fields are stored as USPS codes (see src/lib/ingest/*), sometimes as a
// comma-separated list for pipelines that span multiple states (e.g.
// "NY,CT,MA,RI") — see matchesFilters in src/lib/filters.ts for how a
// single-state filter matches against those.
export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  MX: "Mexico",
};

export function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}

// Splits a project's (possibly multi-state, e.g. "NY,CT,MA,RI" or "TX, MX")
// `state` field into individual USPS codes.
export function splitStateCodes(state: string | null): string[] {
  if (!state) return [];
  return state.split(",").map((s) => s.trim()).filter(Boolean);
}

// Approximate geographic center [lon, lat] of each state — used only to
// place multi-state pipeline projects (see eiaPipelineProjects.ts) on the
// map, since that source publishes a state list, not coordinates, and a
// single real site doesn't exist for a project spanning several states.
// Not precise enough for anything beyond "roughly where this is."
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.9023, 32.3182],
  AK: [-152.4044, 64.2008],
  AZ: [-111.0937, 34.0489],
  AR: [-92.3731, 34.9697],
  CA: [-119.4179, 36.7783],
  CO: [-105.7821, 39.5501],
  CT: [-72.7554, 41.6032],
  DE: [-75.5277, 38.9108],
  DC: [-77.0369, 38.9072],
  FL: [-81.5158, 27.6648],
  GA: [-82.9001, 32.1656],
  HI: [-155.5828, 19.8968],
  ID: [-114.742, 44.0682],
  IL: [-89.3985, 40.6331],
  IN: [-86.1349, 40.2672],
  IA: [-93.0977, 41.878],
  KS: [-98.4842, 39.0119],
  KY: [-84.27, 37.8393],
  LA: [-91.9623, 30.9843],
  ME: [-69.4455, 45.2538],
  MD: [-76.6413, 39.0458],
  MA: [-71.3824, 42.4072],
  MI: [-84.5361, 44.3148],
  MN: [-94.6859, 46.7296],
  MS: [-89.3985, 32.3547],
  MO: [-91.8318, 37.9643],
  MT: [-110.3626, 46.8797],
  NE: [-99.9018, 41.4925],
  NV: [-116.4194, 38.8026],
  NH: [-71.5724, 43.1939],
  NJ: [-74.4057, 40.0583],
  NM: [-106.0189, 34.5199],
  NY: [-74.9481, 42.9538],
  NC: [-79.0193, 35.7596],
  ND: [-101.002, 47.5515],
  OH: [-82.9071, 40.4173],
  OK: [-97.5164, 35.4676],
  OR: [-120.5542, 43.8041],
  PA: [-77.1945, 41.2033],
  RI: [-71.4774, 41.5801],
  SC: [-81.1637, 33.8361],
  SD: [-99.9018, 43.9695],
  TN: [-86.5804, 35.5175],
  TX: [-99.9018, 31.9686],
  UT: [-111.0937, 39.321],
  VT: [-72.5778, 44.5588],
  VA: [-78.6569, 37.4316],
  WA: [-120.7401, 47.7511],
  WV: [-80.4549, 38.5976],
  WI: [-89.6165, 43.7844],
  WY: [-107.2903, 43.076],
};

// Averages the center points of every state a multi-state project's `state`
// field lists (e.g. "NY,CT,MA,RI"), so the map can place one dot
// "in between" them rather than dropping the project entirely. Codes with
// no known centroid (e.g. "MX") are skipped rather than breaking the
// average. Returns null if none of the codes resolve, or if there's only
// one (this is meant for genuinely multi-state entries, not a substitute
// for real geocoding of single-state projects).
export function multiStateCentroid(state: string | null): [number, number] | null {
  const codes = splitStateCodes(state);
  if (codes.length < 2) return null;
  const points = codes.map((c) => STATE_CENTROIDS[c]).filter((p): p is [number, number] => p != null);
  if (points.length === 0) return null;
  const lon = points.reduce((sum, [lo]) => sum + lo, 0) / points.length;
  const lat = points.reduce((sum, [, la]) => sum + la, 0) / points.length;
  return [lon, lat];
}

// Single-state centroid fallback for a project with a known state but no
// real lat/lon and no county-level fallback available (e.g. a state PUC
// docket source with no structured location field — see vaSccDockets.ts).
// A coarse, deliberately-obvious approximation, not a substitute for real
// geocoding — Map.tsx renders it with the same dashed-marker treatment as
// multiStateCentroid above.
export function stateCentroid(state: string | null): [number, number] | null {
  const codes = splitStateCodes(state);
  if (codes.length !== 1) return null;
  return STATE_CENTROIDS[codes[0]] ?? null;
}

// County-level centroid fallback, one tier more precise than stateCentroid
// above — for the many state PUC/PSC docket sources across this project's
// ingest/ series that publish a county name in free caption text but no
// FIPS code, lat/lon, or street address (e.g. arPscDockets.ts's `county`
// field). countyCentroidsByName.json is generated from the same U.S. Census
// Bureau 2025 Gazetteer county file as countyCentroids.json (confirmed by
// cross-checking several FIPS/name pairs resolve to the same coordinates),
// but re-keyed by "<USPS state>|<normalized county name>" instead of FIPS,
// since these sources never have a FIPS code to look up in the first place
// — see countyCentroids.json's own comment (in lbnlQueuedUp.ts) for why
// that one is FIPS-keyed instead. Normalization strips the trailing
// "County"/"Parish"/"Borough"/"Census Area"/"Municipality"/etc. type word,
// uppercases, and strips punctuation, so callers can pass a county name in
// whatever casing/spelling their source's caption text used (e.g. "St.
// Francis", "ST FRANCIS", and "st francis county" all normalize the same
// way). Six real name collisions nationwide (independent cities that share
// a base name with a same-state county, e.g. Virginia's Fairfax/Franklin/
// Richmond/Roanoke, plus Baltimore MD and St. Louis MO) are resolved in the
// generated data by keeping the county/parish/borough entry, not the city
// one — a deliberate, documented choice, not an accident of file order.
// Same coarse-approximation caveat as stateCentroid: a real county center,
// not the project's actual site.
import countyCentroidsByNameData from "@/lib/data/countyCentroidsByName.json";
const COUNTY_CENTROIDS_BY_NAME = countyCentroidsByNameData as unknown as Record<string, [number, number]>;

const COUNTY_SUFFIX_WORDS = new Set([
  "COUNTY",
  "PARISH",
  "BOROUGH",
  "MUNICIPALITY",
  "MUNICIPIO",
  "REGION",
  "AREA",
  "CITY",
]);

function normalizeCountyName(raw: string): string {
  let words = raw.toUpperCase().trim().split(/\s+/);
  if (words.length >= 2 && words[words.length - 1] === "AREA" && words[words.length - 2] === "CENSUS") {
    words = words.slice(0, -2);
  } else if (
    words.length >= 3 &&
    words[words.length - 1] === "BOROUGH" &&
    words[words.length - 2] === "AND" &&
    words[words.length - 3] === "CITY"
  ) {
    words = words.slice(0, -3);
  } else if (words.length >= 2 && COUNTY_SUFFIX_WORDS.has(words[words.length - 1])) {
    words = words.slice(0, -1);
  }
  return words
    .join(" ")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function countyCentroid(state: string | null, county: string | null): [number, number] | null {
  const codes = splitStateCodes(state);
  if (codes.length !== 1 || !county) return null;
  const key = `${codes[0]}|${normalizeCountyName(county)}`;
  const hit = COUNTY_CENTROIDS_BY_NAME[key];
  // Stored as [lat, lon] (Census Gazetteer column order); this module's
  // other centroid functions return [lon, lat], matching Map.tsx's usage —
  // flip here rather than in the generated data file.
  return hit ? [hit[1], hit[0]] : null;
}
