// Shared shape returned by /api/projects and used throughout the frontend.
// This is the "common project schema" the ingestion modules normalize into
// (see src/lib/ingest/*), serialized from Prisma models plus a few computed
// fields (days/years waiting, cost of delay) that we deliberately compute at
// read time rather than cache, so they're always current.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType, VerificationStatus } from "@/lib/data/taxonomies";

export interface ProjectSourceDTO {
  label: string;
  url: string;
}

export interface MilestoneDTO {
  date: string; // ISO date
  dateConfidence: "exact" | "approximate";
  stage: string;
  description: string;
}

export interface ProjectDTO {
  id: string;
  slug: string;
  name: string;
  projectType: ProjectType;
  fuelType: FuelType;
  lat: number | null;
  lon: number | null;
  state: string | null;
  county: string | null;
  capacityValue: number | null;
  capacityUnit: string | null;
  applicationFiledDate: string | null; // ISO date
  dateConfidence: "exact" | "approximate";
  currentStatus: string;
  currentStage: ProjectStage;
  // See Project.noLongerReported in schema.prisma — true only for a
  // still-pending project whose source stopped listing it in a later run.
  noLongerReported: boolean;
  causeSlugs: CauseSlug[];
  causeDetail: string;
  isAggregateExample: boolean;
  estimatedMwDelayed: number | null;
  verificationStatus: VerificationStatus;
  dataQualityNote: string | null;
  // Interconnection-source-specific detail, null for every other source —
  // see schema.prisma and src/lib/ingest/README.md.
  interconnectionQueueStage: string | null;
  networkUpgradeCostUsd: number | null;
  sources: ProjectSourceDTO[];
  milestones: MilestoneDTO[];

  // computed
  daysWaiting: number | null;
  yearsWaiting: number | null;
  investmentWaiting: {
    applicable: boolean;
    reason?: string;
    estimatedUsd?: number;
    costPerKw?: number;
  };
}

// One row of the homepage changes feed — see ProjectChange in
// schema.prisma. `project` is a trimmed summary (not the full ProjectDTO)
// since a feed of many entries only needs enough to render a card and link
// out, not sources/milestones/etc.
export interface ProjectChangeDTO {
  id: number;
  changeTypes: string[];
  previousStage: ProjectStage | null;
  newStage: ProjectStage | null;
  summary: string;
  createdAt: string; // ISO date
  project: {
    slug: string;
    name: string;
    state: string | null;
    projectType: ProjectType;
    fuelType: FuelType;
    capacityValue: number | null;
    capacityUnit: string | null;
  };
}

export interface AggregateStats {
  totalProjects: number;
  totalCapacityMw: number;
  totalInvestmentWaitingUsd: number;
  investmentWaitingCoverageCount: number; // how many of totalProjects have an applicable estimate
  totalCleanCapacityMw: number;
  cleanCapacityProjectCount: number; // how many of totalProjects are zero-carbon generation with MW capacity
}
