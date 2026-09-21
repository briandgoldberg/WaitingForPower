import { prisma } from "@/lib/db";
import { RESOLVED_STAGES, statusBucketForProject, type ProjectStage } from "@/lib/data/taxonomies";
import { yearsWaiting } from "@/lib/calc/dates";

export interface AdvocacyProject {
  slug: string;
  name: string;
  state: string | null;
  fuelType: string;
  capacityValue: number | null;
  capacityUnit: string | null;
  yearsWaiting: number | null;
  docketLabel: string | null;
  docketUrl: string | null;
}

const MAX_PROJECTS = 500;

// The largest still-pending projects, for the Advocacy > Project tab: a
// lightweight select (no milestones/causes) so this stays small even though
// it feeds a client-side filter. Ranked by MW capacity, the only capacity
// unit that compares across projects (pipelines are MMcf/d, transmission is
// kV). Years waiting is included when a filing date is known.
export async function getAdvocacyProjects(): Promise<AdvocacyProject[]> {
  const rows = await prisma.project.findMany({
    where: {
      isAggregateExample: false,
      mergedIntoId: null,
      noLongerReported: false,
      capacityUnit: "MW",
      capacityValue: { not: null },
      currentStage: { notIn: RESOLVED_STAGES },
    },
    select: {
      slug: true,
      name: true,
      state: true,
      fuelType: true,
      capacityValue: true,
      capacityUnit: true,
      applicationFiledDate: true,
      currentStage: true,
      sources: { select: { label: true, url: true }, take: 1 },
    },
    orderBy: { capacityValue: "desc" },
    take: MAX_PROJECTS,
  });

  return rows
    .filter((r) => statusBucketForProject(r.currentStage as ProjectStage, false) === "in_permitting")
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      state: r.state,
      fuelType: r.fuelType,
      capacityValue: r.capacityValue,
      capacityUnit: r.capacityUnit,
      yearsWaiting: yearsWaiting(r.applicationFiledDate),
      docketLabel: r.sources[0]?.label ?? null,
      docketUrl: r.sources[0]?.url ?? null,
    }));
}
