import {
  PROJECT_STAGE_BY_VALUE,
  STATUS_BUCKETS,
  statusBucketForProject,
  type FuelType,
  type ProjectStage,
  type ProjectType,
  type StatusBucket,
} from "@/lib/data/taxonomies";
import type { ProjectDTO } from "@/lib/types";
import { splitStateCodes, stateName } from "@/lib/data/usStates";

// Not a stored field — this site doesn't have one canonical "source" column
// per project (a project's `sources` array is label+url pairs meant for
// citation, and cross-source matching isn't automated, see
// src/lib/ingest/common.ts header). Derived here from each ingestion
// module's own stable `sources[].label` text so users can filter by which
// pipeline a project came from, without adding a new DB column for it.
export type SourceKey = "eia" | "permittingDashboard" | "lbnl" | "ornlHydro" | "eiaPipelines" | "other";

const SOURCE_LABEL_PATTERNS: [SourceKey, RegExp][] = [
  ["eia", /EIA-860M/i],
  ["permittingDashboard", /Federal Permitting Dashboard/i],
  ["lbnl", /LBNL Queued Up/i],
  ["ornlHydro", /ORNL HydroSource/i],
  ["eiaPipelines", /EIA Natural Gas Pipeline/i],
];

export function sourceKeyForProject(p: ProjectDTO): SourceKey {
  const label = p.sources[0]?.label ?? "";
  for (const [key, pattern] of SOURCE_LABEL_PATTERNS) {
    if (pattern.test(label)) return key;
  }
  return "other";
}

export const SOURCE_OPTIONS: { value: SourceKey; label: string }[] = [
  { value: "eia", label: "EIA-860M" },
  { value: "permittingDashboard", label: "Federal Permitting Dashboard" },
  { value: "lbnl", label: "LBNL interconnection queue" },
  { value: "ornlHydro", label: "ORNL hydropower relicensing" },
  { value: "eiaPipelines", label: "EIA pipeline projects" },
];

export interface FilterState {
  // Single-select, always set (never null) — unlike every other filter
  // below, there's no "no filter" state for Status; "in_permitting" IS
  // the default/no-op value, matching this site's original always-waiting
  // project set exactly. See DEFAULT_FILTERS.
  status: StatusBucket;
  minYearsWaiting: number | null; // e.g. 1, 3, 5 quick presets, or null = no minimum
  fuelTypes: FuelType[];
  projectTypes: ProjectType[];
  minCapacity: number | null; // e.g. 250, 500, 1000 MW quick presets, or null = no minimum
  stages: ProjectStage[];
  sourceKeys: SourceKey[];
  state: string | null; // USPS code, e.g. "CA", or null = all states
  // Free text from the source (e.g. LBNL's "Feasibility Study" / "System
  // Impact Study" / "Facilities Study") — not a fixed taxonomy like `stages`,
  // so options are built dynamically from whatever's actually present, same
  // as `state` above. Only ever set for interconnection-queue-sourced
  // projects (see interconnectionQueueStage in src/lib/types.ts).
  queueStages: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  status: "in_permitting",
  minYearsWaiting: null,
  fuelTypes: [],
  projectTypes: [],
  minCapacity: null,
  stages: [],
  sourceKeys: [],
  state: null,
  queueStages: [],
};

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.status !== DEFAULT_FILTERS.status ||
    f.minYearsWaiting != null ||
    f.fuelTypes.length > 0 ||
    f.projectTypes.length > 0 ||
    f.minCapacity != null ||
    f.stages.length > 0 ||
    f.sourceKeys.length > 0 ||
    f.state != null ||
    f.queueStages.length > 0
  );
}

export function matchesFilters(p: ProjectDTO, f: FilterState, opts: { ignoreStatus?: boolean } = {}): boolean {
  // ignoreStatus: used by queryProjects' allStatuses option (see
  // src/lib/queryProjects.ts) — the public API and MCP server need a way to
  // request every status bucket at once ("all"), which FilterState.status
  // itself can't represent (it's always exactly one bucket, by design, to
  // match the Explorer's own single-select status pills). The Explorer
  // never passes this — it always has one real status selected.
  if (!opts.ignoreStatus && statusBucketForProject(p.currentStage, p.noLongerReported) !== f.status) return false;
  if (f.minYearsWaiting != null) {
    if (p.yearsWaiting == null || p.yearsWaiting < f.minYearsWaiting) return false;
  }
  if (f.fuelTypes.length > 0 && !f.fuelTypes.includes(p.fuelType)) return false;
  if (f.projectTypes.length > 0 && !f.projectTypes.includes(p.projectType)) return false;
  if (f.minCapacity != null && (p.capacityValue == null || p.capacityValue < f.minCapacity)) return false;
  if (f.stages.length > 0 && !f.stages.includes(p.currentStage)) return false;
  if (f.sourceKeys.length > 0 && !f.sourceKeys.includes(sourceKeyForProject(p))) return false;
  if (f.state != null && !splitStateCodes(p.state).includes(f.state)) return false;
  if (f.queueStages.length > 0 && !f.queueStages.includes(p.interconnectionQueueStage ?? "")) return false;
  return true;
}

export interface FilterChip {
  key: string;
  label: string;
  onRemove: (f: FilterState) => FilterState;
}

export function buildChips(f: FilterState): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.status !== DEFAULT_FILTERS.status) {
    chips.push({
      key: "status",
      label: STATUS_BUCKETS.find((s) => s.value === f.status)?.label ?? f.status,
      onRemove: (state) => ({ ...state, status: DEFAULT_FILTERS.status }),
    });
  }
  if (f.minYearsWaiting != null) {
    chips.push({
      key: "minYears",
      label: `${f.minYearsWaiting}+ years waiting`,
      onRemove: (state) => ({ ...state, minYearsWaiting: null }),
    });
  }
  for (const ft of f.fuelTypes) {
    chips.push({
      key: `fuel-${ft}`,
      label: ft,
      onRemove: (state) => ({ ...state, fuelTypes: state.fuelTypes.filter((x) => x !== ft) }),
    });
  }
  for (const pt of f.projectTypes) {
    chips.push({
      key: `type-${pt}`,
      label: pt,
      onRemove: (state) => ({ ...state, projectTypes: state.projectTypes.filter((x) => x !== pt) }),
    });
  }
  if (f.minCapacity != null) {
    chips.push({
      key: "capacity",
      label: `${f.minCapacity.toLocaleString("en-US")}+ MW`,
      onRemove: (state) => ({ ...state, minCapacity: null }),
    });
  }
  for (const st of f.stages) {
    chips.push({
      key: `stage-${st}`,
      label: PROJECT_STAGE_BY_VALUE[st],
      onRemove: (state) => ({ ...state, stages: state.stages.filter((x) => x !== st) }),
    });
  }
  for (const sk of f.sourceKeys) {
    chips.push({
      key: `source-${sk}`,
      label: SOURCE_OPTIONS.find((o) => o.value === sk)?.label ?? sk,
      onRemove: (state) => ({ ...state, sourceKeys: state.sourceKeys.filter((x) => x !== sk) }),
    });
  }
  if (f.state != null) {
    chips.push({
      key: "state",
      label: stateName(f.state),
      onRemove: (state) => ({ ...state, state: null }),
    });
  }
  for (const qs of f.queueStages) {
    chips.push({
      key: `queueStage-${qs}`,
      label: qs,
      onRemove: (state) => ({ ...state, queueStages: state.queueStages.filter((x) => x !== qs) }),
    });
  }
  return chips;
}
