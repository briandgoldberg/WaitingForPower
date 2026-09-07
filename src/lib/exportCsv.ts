// Flattens ProjectDTO into a spreadsheet-friendly CSV for the bulk export
// endpoint (src/app/api/export/route.ts) — deliberately NOT the same shape
// as the JSON export: milestones/hearings/sources are nested arrays that
// don't flatten into one CSV row without either repeating the parent row
// per child (misleading row counts) or losing structure, so they're
// summarized here (counts, a joined source list) rather than either of
// those. A caller who needs full nested detail should use
// ?format=json instead, not treat the CSV as a lossless mirror of it.

import type { ProjectDTO } from "@/lib/types";

const COLUMNS: { header: string; get: (p: ProjectDTO) => string | number | boolean | null }[] = [
  { header: "slug", get: (p) => p.slug },
  { header: "name", get: (p) => p.name },
  { header: "project_type", get: (p) => p.projectType },
  { header: "fuel_type", get: (p) => p.fuelType },
  { header: "state", get: (p) => p.state },
  { header: "county", get: (p) => p.county },
  { header: "lat", get: (p) => p.lat },
  { header: "lon", get: (p) => p.lon },
  { header: "capacity_value", get: (p) => p.capacityValue },
  { header: "capacity_unit", get: (p) => p.capacityUnit },
  { header: "current_stage", get: (p) => p.currentStage },
  { header: "current_status", get: (p) => p.currentStatus },
  { header: "no_longer_reported", get: (p) => p.noLongerReported },
  { header: "cause_slugs", get: (p) => p.causeSlugs.join(";") },
  { header: "cause_detail", get: (p) => p.causeDetail },
  { header: "applicant", get: (p) => p.applicant },
  { header: "owner_sector", get: (p) => p.ownerSector },
  { header: "balancing_authority", get: (p) => p.balancingAuthority },
  { header: "point_of_interconnection", get: (p) => p.pointOfInterconnection },
  { header: "queue_cluster", get: (p) => p.queueCluster },
  { header: "network_upgrade_cost_usd", get: (p) => p.networkUpgradeCostUsd },
  { header: "poi_cost_usd", get: (p) => p.poiCostUsd },
  { header: "application_filed_date", get: (p) => p.applicationFiledDate },
  { header: "date_confidence", get: (p) => p.dateConfidence },
  { header: "expected_online_date", get: (p) => p.expectedOnlineDate },
  { header: "days_waiting", get: (p) => p.daysWaiting },
  { header: "years_waiting", get: (p) => p.yearsWaiting },
  { header: "investment_waiting_usd", get: (p) => p.investmentWaiting.estimatedUsd ?? null },
  { header: "verification_status", get: (p) => p.verificationStatus },
  { header: "data_quality_note", get: (p) => p.dataQualityNote },
  { header: "green_votes", get: (p) => p.greenVotes },
  { header: "red_votes", get: (p) => p.redVotes },
  { header: "milestone_count", get: (p) => p.milestones.length },
  { header: "hearing_count", get: (p) => p.hearings.length },
  { header: "sources", get: (p) => p.sources.map((s) => `${s.label} (${s.url})`).join(";") },
];

function csvCell(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function projectsToCsv(projects: ProjectDTO[]): string {
  const header = COLUMNS.map((c) => csvCell(c.header)).join(",");
  const rows = projects.map((p) => COLUMNS.map((c) => csvCell(c.get(p))).join(","));
  return [header, ...rows].join("\n") + "\n";
}
