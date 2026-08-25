import type { AggregateStats } from "@/lib/types";
import type { ProjectDTO } from "@/lib/types";
import { RESOLVED_STAGES, ZERO_CARBON_FUELS } from "@/lib/data/taxonomies";

// Aggregate stats deliberately exclude `isAggregateExample` projects —
// e.g. a regional/ISO-wide statistic standing in for many individual
// projects — since mixing one into a sum of individual projects would
// double-count and overstate the total. No source currently ingested
// produces one of these, but the flag and this exclusion stay in place for
// whenever one does (see prisma/schema.prisma for the field's intent).
export function computeAggregateStats(projects: ProjectDTO[]): AggregateStats {
  const realProjects = projects.filter((p) => !p.isAggregateExample);

  // "Waiting" MW/dollar totals only mean something for a project still
  // actually waiting on a decision — a resolved project's capacity isn't
  // "waiting," it's built, cancelled, or cleared for construction. This
  // matters because these totals are computed from whatever the Status
  // filter currently shows, not just the default "In Permitting" bucket —
  // without this, switching to "Permits Complete" or "Cancelled/Suspended"
  // summed those projects' capacity into "Capacity waiting" too, which is
  // exactly backwards. `totalProjects` below is NOT filtered this way — the
  // "Projects" stat should still reflect the real count of whatever bucket
  // is showing.
  const stillWaitingProjects = realProjects.filter((p) => !RESOLVED_STAGES.includes(p.currentStage));

  const totalCapacityMw = stillWaitingProjects.reduce((sum, p) => {
    if (p.capacityUnit !== "MW" || p.capacityValue == null) return sum;
    return sum + p.capacityValue;
  }, 0);

  let totalInvestmentWaitingUsd = 0;
  let investmentWaitingCoverageCount = 0;
  for (const p of stillWaitingProjects) {
    if (p.investmentWaiting.applicable && p.investmentWaiting.estimatedUsd != null) {
      totalInvestmentWaitingUsd += p.investmentWaiting.estimatedUsd;
      investmentWaitingCoverageCount += 1;
    }
  }

  let totalCleanCapacityMw = 0;
  let cleanCapacityProjectCount = 0;
  for (const p of stillWaitingProjects) {
    if (ZERO_CARBON_FUELS.includes(p.fuelType) && p.capacityUnit === "MW" && p.capacityValue != null) {
      totalCleanCapacityMw += p.capacityValue;
      cleanCapacityProjectCount += 1;
    }
  }

  return {
    totalProjects: realProjects.length,
    totalCapacityMw,
    totalInvestmentWaitingUsd,
    investmentWaitingCoverageCount,
    totalCleanCapacityMw,
    cleanCapacityProjectCount,
  };
}
