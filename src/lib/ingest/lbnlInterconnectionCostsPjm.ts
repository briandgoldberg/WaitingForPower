// Joins LBNL's separate PJM interconnection-cost-analysis dataset onto
// already-tracked LBNL Queued Up projects, splitting the site's single
// networkUpgradeCostUsd figure into its point-of-interconnection (POI) and
// network-upgrade cost components — see schema.prisma's poiCostUsd/
// networkUpgradeCostUsd comments and README.md's "Interconnection queue
// detail" section.
//
// SOURCE: https://emp.lbl.gov/publications/interconnection-cost-analysis-pjm
// links to the real data file (confirmed live 2026-09-04):
// https://eta-publications.lbl.gov/sites/default/files/pjm_costs_2022_clean_data.xlsx
// — a 3-sheet workbook ("introduction", "data", "codebook"). The "data"
// sheet's real header row (row 0, no offset needed — unlike lbnlQueuedUp.ts's
// own workbook) is: Project #, Queue Date, State, Transmission Owner, Study
// Type, Study Date, Service Type, Fuel, Nameplate MW, Request Status,
// Withdrawn Date, Actual In Service Date, $2022 POI Cost/kW, $2022 Network
// Cost/kW, $2022 Total Cost/kW. Costs are real $2022/kW (GDP-deflated), not
// a total dollar figure — multiplied by Nameplate MW x 1000 below to match
// how Project.networkUpgradeCostUsd/poiCostUsd are documented.
//
// NOT a periodically-republished current file like EIA-860M or LBNL Queued
// Up itself — this is a fixed historical analysis (through 2022), so there's
// no predictable "latest edition" URL pattern to walk and no landing-page
// scrape (confirmed 2026-09-04: emp.lbl.gov/interconnection_costs renders its
// file list via a client-side Drupal Views AJAX call, not present in the
// initial HTML — unlike the /queues page lbnlQueuedUp.ts scrapes). The URL
// below is simply the one confirmed working; if LBNL republishes a newer
// edition under a different filename, this constant needs a manual update.
//
// JOIN: "Project #" is the same q_id LBNL Queued Up itself publishes for
// every PJM row — entity is always the fixed string "PJM Interconnection"
// for PJM's entire footprint in that dataset (confirmed: "A03" appears as
// both q_id in Queued Up and Project # here). resolveMatchKey("lbnl",
// `PJM Interconnection-${projectNum}`) reconstructs the exact matchKey
// lbnlQueuedUp.ts would already have created that project under.
//
// UPDATE-ONLY: this module never creates a Project row — it only enriches
// an LBNL Queued Up row already ingested by that module. A cost-file row
// whose matchKey doesn't resolve to an existing project (already resolved
// and cleaned up, or a legacy pre-matchKey row not yet self-healed — see
// common.ts's LEGACY-ROW FALLBACK) is skipped and counted separately, not
// treated as an error. Coverage against currently-active queue entries is
// expected to be sparse either way — most rows in this cost study are
// long-since-operational or withdrawn projects (see README.md).

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";

const DATA_FILE_URL = "https://eta-publications.lbl.gov/sites/default/files/pjm_costs_2022_clean_data.xlsx";
const SHEET_NAME = "data";
const ENTITY = "PJM Interconnection";

// Same caution LBNL's own docs give — see README.md's existing
// networkUpgradeCostUsd note.
const COST_CAVEAT =
  "Interconnection cost figures (POI and network upgrade) are preliminary estimates from LBNL's PJM interconnection cost-analysis research, expressed in real $2022/kW — not a live or final figure.";

function appendCaveat(existing: string | null): string {
  if (existing && existing.includes(COST_CAVEAT)) return existing;
  return existing ? `${existing} ${COST_CAVEAT}` : COST_CAVEAT;
}

interface CostRow {
  "Project #": string | number | null;
  "Nameplate MW": number | null;
  "$2022 POI Cost/kW": number | null;
  "$2022 Network Cost/kW": number | null;
}

export function parseWorkbookBuffer(buf: Buffer): CostRow[] {
  const workbook = XLSX.read(buf, { type: "buffer" });
  if (!workbook.SheetNames.includes(SHEET_NAME)) {
    throw new Error(`Could not find a "${SHEET_NAME}" sheet. Sheets in this workbook: ${workbook.SheetNames.join(", ")}`);
  }
  return XLSX.utils.sheet_to_json<CostRow>(workbook.Sheets[SHEET_NAME], { defval: null });
}

export function parseWorkbook(filePath: string): CostRow[] {
  return parseWorkbookBuffer(readFileSync(filePath));
}

export interface IngestSummary {
  matched: number;
  skippedNoMatchingProject: number;
  skippedNoCostData: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestPjmInterconnectionCostsBuffer(buf: Buffer): Promise<IngestSummary> {
  const rows = parseWorkbookBuffer(buf);
  let matched = 0;
  let skippedNoMatchingProject = 0;
  let skippedNoCostData = 0;
  const errors: { matchKey: string; message: string }[] = [];

  for (const row of rows) {
    const projectNum = row["Project #"];
    if (projectNum == null || projectNum === "") continue;
    const matchKey = resolveMatchKey("lbnl", `${ENTITY}-${projectNum}`);

    const nameplateMw = Number(row["Nameplate MW"]);
    const poiCostPerKw = Number(row["$2022 POI Cost/kW"]);
    const networkCostPerKw = Number(row["$2022 Network Cost/kW"]);
    if (!Number.isFinite(nameplateMw) || (!Number.isFinite(poiCostPerKw) && !Number.isFinite(networkCostPerKw))) {
      skippedNoCostData += 1;
      continue;
    }

    try {
      const existing = await prisma.project.findUnique({ where: { matchKey }, select: { id: true, dataQualityNote: true } });
      if (!existing) {
        skippedNoMatchingProject += 1;
        continue;
      }
      await prisma.project.update({
        where: { id: existing.id },
        data: {
          poiCostUsd: Number.isFinite(poiCostPerKw) ? poiCostPerKw * nameplateMw * 1000 : undefined,
          networkUpgradeCostUsd: Number.isFinite(networkCostPerKw) ? networkCostPerKw * nameplateMw * 1000 : undefined,
          dataQualityNote: appendCaveat(existing.dataQualityNote),
        },
      });
      matched += 1;
    } catch (err) {
      errors.push({ matchKey, message: String(err) });
    }
  }

  return { matched, skippedNoMatchingProject, skippedNoCostData, errors };
}

export async function fetchAndIngestPjmInterconnectionCosts(): Promise<IngestSummary> {
  const res = await fetch(DATA_FILE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Failed to download ${DATA_FILE_URL}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return ingestPjmInterconnectionCostsBuffer(buf);
}

if (require.main === module) {
  const filePath = process.argv[2];
  const run = filePath
    ? ingestPjmInterconnectionCostsBuffer(readFileSync(filePath))
    : fetchAndIngestPjmInterconnectionCosts();
  run
    .then((summary) => {
      console.log(
        `PJM interconnection cost ingestion complete: matched ${summary.matched} projects ` +
          `(${summary.skippedNoMatchingProject} skipped — no matching tracked project, ` +
          `${summary.skippedNoCostData} skipped — no usable cost data, ${summary.errors.length} errors).`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
