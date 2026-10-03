// Groups tracked projects by utility service territory (EIA-861
// county-to-utility data) instead of by state — powers the Project/Service
// Area toggle on /projects and /state/[code], and /utility/[slug] itself.
// Known imprecision: a county often lists several utilities, and a project
// is counted under every utility on file for its county, not the one
// specific utility that actually serves its exact site.
import type { ProjectDTO } from "@/lib/types";
import territoryData from "@/lib/data/utilityServiceTerritory.json";

const TERRITORY: Record<string, string[]> = territoryData;

// Stable, URL-safe id for a utility's own page (src/app/utility/[slug]) —
// derived from the name rather than an index, so it doesn't shift if the
// territory data's utility list is re-sorted or re-filtered later.
export function slugifyUtility(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface UtilityGroup {
  utility: string;
  slug: string;
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

export function groupProjectsByUtility(projects: ProjectDTO[], opts: { minCount?: number } = {}): UtilityGroup[] {
  const minCount = opts.minCount ?? 3;
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
        slug: slugifyUtility(utility),
        projectSlugs: list.map((p) => p.slug),
        count: list.length,
        totalCapacityMw: list.reduce((s, p) => (p.capacityUnit === "MW" && p.capacityValue != null ? s + p.capacityValue : s), 0),
        totalInvestment: list.reduce((s, p) => s + (p.investmentWaiting.applicable ? (p.investmentWaiting.estimatedUsd ?? 0) : 0), 0),
        lat,
        lon,
      };
    })
    .filter((u) => u.count >= minCount) // drop tiny municipal utilities below the caller's noise floor
    .sort((a, b) => b.count - a.count);
}

// One synthetic marker per utility, reusing the real Map component as-is —
// filled with every ProjectDTO field it doesn't need (null/empty) so the
// type checks without a cast. The marker's own popup still links to
// /project/{slug} (Map's one hardcoded link target), which doesn't resolve
// for this synthetic slug — the real "view this utility" link lives outside
// the map, in the service-area list/accordion's "Full page" links instead.
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
