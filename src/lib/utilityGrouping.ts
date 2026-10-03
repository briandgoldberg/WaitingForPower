// Preview-only grouping logic for /test1 — groups tracked projects by
// utility service territory (EIA-861 county-to-utility data) instead of by
// state. See src/app/test1/page.tsx for the known imprecision (a county
// often lists several utilities; a project is counted under every utility
// on file for its county, not the one specific utility that actually
// serves its exact site).
import type { ProjectDTO } from "@/lib/types";
import territoryData from "@/lib/data/utilityServiceTerritory.json";

const TERRITORY: Record<string, string[]> = territoryData;

export interface UtilityGroup {
  utility: string;
  // Slugs only, not full project objects — a project lands in several
  // utility groups whenever its county lists several utilities, and
  // embedding the full object per group duplicated the same heavy records
  // repeatedly (ballooned this page's hydration payload to 13MB+ before
  // this was slugs). The caller looks these up against the one shared
  // `projects` array instead.
  projectSlugs: string[];
  count: number;
  totalCapacityMw: number;
  totalInvestment: number;
  // Centroid of this utility's own tracked projects (not its whole real
  // service territory) — just enough to place one map marker per utility.
  lat: number;
  lon: number;
}

export function groupProjectsByUtility(projects: ProjectDTO[]): UtilityGroup[] {
  const byUtility = new Map<string, ProjectDTO[]>();
  for (const p of projects) {
    if (!p.state || !p.county) continue;
    for (const stateCode of p.state.split(",").map((s) => s.trim())) {
      for (const countyName of p.county.split(",").map((c) => c.trim())) {
        const key = `${stateCode.toUpperCase()}|${countyName.toUpperCase()}`;
        const utilities = TERRITORY[key];
        if (!utilities) continue;
        for (const utility of utilities) {
          const list = byUtility.get(utility) ?? [];
          if (!list.some((x) => x.slug === p.slug)) list.push(p);
          byUtility.set(utility, list);
        }
      }
    }
  }

  return [...byUtility.entries()]
    .map(([utility, list]) => {
      const withCoords = list.filter((p) => p.lat != null && p.lon != null);
      const lat = withCoords.length > 0 ? withCoords.reduce((s, p) => s + p.lat!, 0) / withCoords.length : 39;
      const lon = withCoords.length > 0 ? withCoords.reduce((s, p) => s + p.lon!, 0) / withCoords.length : -98;
      return {
        utility,
        projectSlugs: list.map((p) => p.slug),
        count: list.length,
        totalCapacityMw: list.reduce((s, p) => (p.capacityUnit === "MW" && p.capacityValue != null ? s + p.capacityValue : s), 0),
        totalInvestment: list.reduce((s, p) => s + (p.investmentWaiting.applicable ? (p.investmentWaiting.estimatedUsd ?? 0) : 0), 0),
        lat,
        lon,
      };
    })
    .filter((u) => u.count >= 3) // drop tiny single-project municipal utilities — too noisy for this preview
    .sort((a, b) => b.count - a.count);
}

// One synthetic marker per utility, reusing the real Map component as-is —
// filled with every ProjectDTO field it doesn't need (null/empty) so the
// type checks without a cast. Clicking a marker's popup link goes nowhere
// real yet (no /utility/[slug] page exists) — preview only.
export function utilityMarkerProjects(groups: UtilityGroup[]): ProjectDTO[] {
  return groups.map((g, i) => ({
    id: `utility-${i}`,
    slug: `utility-${i}`,
    name: g.utility,
    projectType: "generation",
    fuelType: "other",
    lat: g.lat,
    lon: g.lon,
    state: null,
    county: null,
    capacityValue: g.totalCapacityMw,
    capacityUnit: "MW",
    applicationFiledDate: null,
    dateConfidence: "approximate",
    applicant: null,
    expectedOnlineDate: null,
    expectedOnlineDateConfidence: null,
    currentStatus: `${g.count} projects waiting in this service territory`,
    currentStage: "agency_permitting",
    resolutionDate: null,
    resolutionDateConfidence: null,
    noLongerReported: false,
    causeSlugs: [],
    causeDetail: "",
    isAggregateExample: true,
    estimatedMwDelayed: null,
    verificationStatus: "verified",
    dataQualityNote: null,
    interconnectionQueueStage: null,
    networkUpgradeCostUsd: null,
    poiCostUsd: null,
    balancingAuthority: null,
    ownerSector: null,
    netSummerCapacityMw: null,
    netWinterCapacityMw: null,
    primeMoverCode: null,
    queueCluster: null,
    pointOfInterconnection: null,
    hearingDetailsLink: null,
    reviewStep: null,
    reviewStepAt: null,
    commentDeadline: null,
    sources: [],
    milestones: [],
    statusHistory: [],
    hearings: [],
    opposition: [],
    daysWaiting: null,
    yearsWaiting: null,
    investmentWaiting: { applicable: false },
  }));
}
