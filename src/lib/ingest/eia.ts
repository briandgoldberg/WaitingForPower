// SUPERSEDED — see eia860mPlanned.ts. Confirmed live on 2026-08-14: this
// route's `status` facet only has OP/OS/SB/OA (already-built plants), and
// no EIA API v2 route anywhere exposes planned/proposed generators — that
// data only exists in the EIA-860M Excel workbook's "Planned" tab.
// ingestEia() below will return 0 rows if run with PROPOSED_STATUS_CODES as
// written. Left in place for its research value, not for running.
//
// EIA API v2 ingestion — the backbone list of proposed/planned U.S.
// generation projects (EIA-860/860M "Inventory of Operable Generators").
//
// Verified against the live API during development of this module:
//   GET https://api.eia.gov/v2/electricity/operating-generator-capacity/
//   (no key required for the metadata route) returned these real facets and
//   data columns, which this module relies on:
//
//   facets: stateid, sector, entityid, plantid, generatorid, unit,
//           technology, energy_source_code, prime_mover_code,
//           balancing_authority_code, status
//   data:   nameplate-capacity-mw, net-summer-capacity-mw,
//           net-winter-capacity-mw, operating-year-month,
//           planned-retirement-year-month, planned-derate-year-month,
//           planned-derate-summer-cap-mw, planned-uprate-year-month,
//           planned-uprate-summer-cap-mw, county, longitude, latitude
//
// Requires a free API key (EIA_API_KEY env var) — see .env.example and
// https://www.eia.gov/opendata/register.php
//
// OPEN QUESTION — status code list: EIA-860M's "Operating Status Code" for
// planned/proposed generators (P, L, T, U, V, TS, etc.) is documented in
// EIA's technical notes, not in the API's own facet metadata. The mapping
// below reflects the codes as documented historically; confirm against the
// current EIA-860M technical documentation before relying on it in
// production, since EIA has changed status codes before.
//
// Do not run this module — see the SUPERSEDED notice at the top of this
// file. Use eia860mPlanned.ts instead, which is what's actually wired into
// the weekly cron (src/app/api/cron/ingest-eia).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProject, type NormalizedProject } from "@/lib/ingest/common";

const EIA_BASE = "https://api.eia.gov/v2/electricity/operating-generator-capacity/data/";

// Planned/pre-operation status codes per EIA-860M technical notes (see
// OPEN QUESTION above — verify before production use).
const PROPOSED_STATUS_CODES = ["P", "L", "T", "U", "V", "TS"];

const ENERGY_SOURCE_TO_FUEL_TYPE: Record<string, FuelType> = {
  SUN: "solar",
  WND: "wind_onshore", // EIA doesn't distinguish onshore/offshore in this code alone;
  // offshore wind should be reclassified using `technology` ("Offshore Wind
  // Turbine") — see reclassifyFuelType() below.
  NG: "gas",
  NUC: "nuclear",
  WAT: "hydro",
  GEO: "geothermal",
  MWH: "storage",
  BAT: "storage",
};

function reclassifyFuelType(energySourceCode: string, technology: string): FuelType {
  if (/offshore/i.test(technology)) return "wind_offshore";
  if (/battery|storage/i.test(technology)) return "storage";
  return ENERGY_SOURCE_TO_FUEL_TYPE[energySourceCode] ?? "other";
}

function statusToStage(status: string): ProjectStage {
  if (["U", "V", "TS"].includes(status)) return "under_construction";
  // "agency_permitting" is a rough default for pre-construction planned
  // generators — EIA alone can't tell us whether the real bottleneck is
  // interconnection, NEPA, or something else. Cross-reference with the
  // Permitting Dashboard / LBNL Queued Up (or a manual override) to refine.
  return "agency_permitting";
}

interface EiaRecord {
  period: string;
  stateid: string;
  plantid: string;
  plantName: string;
  generatorid: string;
  technology: string;
  energy_source_code: string;
  status: string;
  county: string | null;
  latitude: string | null;
  longitude: string | null;
  "nameplate-capacity-mw": string | null;
}

async function fetchPage(apiKey: string, offset: number, length: number): Promise<EiaRecord[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "monthly",
    "sort[0][column]": "period",
    "sort[0][direction]": "desc",
    offset: String(offset),
    length: String(length),
  });
  PROPOSED_STATUS_CODES.forEach((code, i) => params.append(`facets[status][${i}]`, code));
  [
    "county",
    "latitude",
    "longitude",
    "nameplate-capacity-mw",
  ].forEach((col, i) => params.append(`data[${i}]`, col));

  const res = await fetch(`${EIA_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`EIA API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.response.data as EiaRecord[];
}

export function normalizeEiaRecord(r: EiaRecord): NormalizedProject {
  const matchKey = resolveMatchKey("eia", `${r.plantid}-${r.generatorid}`);
  const fuelType = reclassifyFuelType(r.energy_source_code, r.technology);
  const causeSlugs: CauseSlug[] = []; // see module header: EIA alone doesn't tell us why

  return {
    matchKey,
    name: `${r.plantName} (Unit ${r.generatorid})`,
    projectType: fuelType === "storage" ? "storage" : "generation",
    fuelType,
    lat: r.latitude ? Number(r.latitude) : null,
    lon: r.longitude ? Number(r.longitude) : null,
    state: r.stateid,
    county: r.county,
    capacityValue: r["nameplate-capacity-mw"] ? Number(r["nameplate-capacity-mw"]) : null,
    capacityUnit: "MW",
    applicationFiledDate: null, // EIA-860M doesn't publish an application-filed date, only planned in-service
    dateConfidence: "approximate",
    currentStatus: `EIA-860M status: ${r.status} (as of ${r.period})`,
    currentStage: statusToStage(r.status),
    causeSlugs,
    causeDetail:
      "Imported from EIA-860M generator inventory. Cause category not yet determined — cross-reference with the Permitting Dashboard, LBNL Queued Up, or a manual review before this project's delay can be attributed to a specific bottleneck.",
    dataQualityNote:
      "Capacity and status are from EIA-860M; no application-filed date is published by this source, so days/years waiting cannot be computed until one is added via manual override.",
    sources: [
      {
        label: "EIA-860M / operating-generator-capacity API",
        url: "https://www.eia.gov/electricity/data/eia860m/",
      },
    ],
    externalIds: { eia: `${r.plantid}-${r.generatorid}` },
  };
}

export async function ingestEia() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    throw new Error("EIA_API_KEY is not set — see .env.example");
  }

  let offset = 0;
  const pageSize = 2000;
  let total = 0;

  for (;;) {
    const rows = await fetchPage(apiKey, offset, pageSize);
    if (rows.length === 0) break;
    for (const row of rows) {
      await upsertNormalizedProject(normalizeEiaRecord(row));
      total += 1;
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }

  console.log(`EIA ingestion complete: upserted ${total} projects.`);
}

if (require.main === module) {
  ingestEia().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
