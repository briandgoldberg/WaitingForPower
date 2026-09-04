import type { Project, ProjectCause, ProjectSource, Milestone, ProjectVerdict } from "@prisma/client";
import { daysWaiting, yearsWaiting } from "@/lib/calc/dates";
import { estimateInvestmentWaiting } from "@/lib/calc/investmentWaiting";
import type { ProjectDTO } from "@/lib/types";
import type { CauseSlug } from "@/lib/data/causeCategories";
import { RESOLVED_STAGES, type FuelType, type ProjectStage, type ProjectType, type VerificationStatus } from "@/lib/data/taxonomies";

export type ProjectWithRelations = Project & {
  causes: ProjectCause[];
  sources: ProjectSource[];
  milestones: Milestone[];
  // Optional — most callers (e.g. the full-table Explorer fetch in
  // queryProjects.ts) don't need vote tallies and skip this relation
  // entirely; greenVotes/redVotes just default to 0 below when omitted.
  // Only the project detail page's own fetch (src/app/project/[id]/page.tsx)
  // includes it for real.
  verdicts?: ProjectVerdict[];
};

export function serializeProject(p: ProjectWithRelations): ProjectDTO {
  // A resolved project (granted, cancelled, under construction, or
  // complete) is no longer "waiting" on anything — `now - filedDate` would
  // otherwise keep growing forever even years after resolution, which is
  // exactly the misleading number this guards against. No real resolution
  // date is tracked anywhere in this schema (see RESOLVED_STAGES' own
  // comment), so rather than guess one, daysWaiting/yearsWaiting are simply
  // not computed for a resolved project — every UI surface that displays
  // them (ProjectList, Map popup, project detail page) already treats null
  // as "—", and the "length of delay" quick-filter naturally excludes
  // resolved projects too, which is correct: that filter means "how long
  // has this been waiting," not applicable once resolved.
  const isResolved = RESOLVED_STAGES.includes(p.currentStage as ProjectStage);
  const days = isResolved ? null : daysWaiting(p.applicationFiledDate);
  const years = isResolved ? null : yearsWaiting(p.applicationFiledDate);
  const investment = estimateInvestmentWaiting({
    fuelType: p.fuelType,
    capacityValue: p.capacityValue,
    capacityUnit: p.capacityUnit,
  });

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    projectType: p.projectType as ProjectType,
    fuelType: p.fuelType as FuelType,
    lat: p.lat,
    lon: p.lon,
    state: p.state,
    county: p.county,
    capacityValue: p.capacityValue,
    capacityUnit: p.capacityUnit,
    applicationFiledDate: p.applicationFiledDate ? p.applicationFiledDate.toISOString() : null,
    dateConfidence: p.dateConfidence as "exact" | "approximate",
    applicant: p.applicant,
    expectedOnlineDate: p.expectedOnlineDate ? p.expectedOnlineDate.toISOString() : null,
    expectedOnlineDateConfidence: p.expectedOnlineDateConfidence as "exact" | "approximate" | null,
    currentStatus: p.currentStatus,
    currentStage: p.currentStage as ProjectStage,
    noLongerReported: p.noLongerReported,
    causeSlugs: p.causes.map((c) => c.causeSlug as CauseSlug),
    causeDetail: p.causeDetail,
    isAggregateExample: p.isAggregateExample,
    estimatedMwDelayed: p.estimatedMwDelayed,
    verificationStatus: p.verificationStatus as VerificationStatus,
    dataQualityNote: p.dataQualityNote,
    interconnectionQueueStage: p.interconnectionQueueStage,
    networkUpgradeCostUsd: p.networkUpgradeCostUsd,
    poiCostUsd: p.poiCostUsd,
    balancingAuthority: p.balancingAuthority,
    ownerSector: p.ownerSector,
    netSummerCapacityMw: p.netSummerCapacityMw,
    netWinterCapacityMw: p.netWinterCapacityMw,
    primeMoverCode: p.primeMoverCode,
    queueCluster: p.queueCluster,
    pointOfInterconnection: p.pointOfInterconnection,
    greenVotes: p.verdicts?.filter((v) => v.vote === "green").length ?? 0,
    redVotes: p.verdicts?.filter((v) => v.vote === "red").length ?? 0,
    sources: p.sources.map((s) => ({ label: s.label, url: s.url })),
    milestones: p.milestones
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((m) => ({
        date: m.date.toISOString(),
        dateConfidence: m.dateConfidence as "exact" | "approximate",
        stage: m.stage,
        description: m.description,
      })),
    daysWaiting: days,
    yearsWaiting: years,
    investmentWaiting: investment,
  };
}
