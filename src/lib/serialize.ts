import type { Project, ProjectCause, ProjectSource, Milestone } from "@prisma/client";
import { daysWaiting, yearsWaiting } from "@/lib/calc/dates";
import { estimateInvestmentWaiting } from "@/lib/calc/investmentWaiting";
import type { ProjectDTO } from "@/lib/types";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType, VerificationStatus } from "@/lib/data/taxonomies";

export type ProjectWithRelations = Project & {
  causes: ProjectCause[];
  sources: ProjectSource[];
  milestones: Milestone[];
};

export function serializeProject(p: ProjectWithRelations): ProjectDTO {
  const days = daysWaiting(p.applicationFiledDate);
  const years = yearsWaiting(p.applicationFiledDate);
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
    currentStatus: p.currentStatus,
    currentStage: p.currentStage as ProjectStage,
    causeSlugs: p.causes.map((c) => c.causeSlug as CauseSlug),
    causeDetail: p.causeDetail,
    isAggregateExample: p.isAggregateExample,
    estimatedMwDelayed: p.estimatedMwDelayed,
    verificationStatus: p.verificationStatus as VerificationStatus,
    dataQualityNote: p.dataQualityNote,
    interconnectionQueueStage: p.interconnectionQueueStage,
    networkUpgradeCostUsd: p.networkUpgradeCostUsd,
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
