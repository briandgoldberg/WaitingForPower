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
