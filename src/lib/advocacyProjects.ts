import { prisma } from "@/lib/db";
import { RESOLVED_STAGES, statusBucketForProject, type ProjectStage } from "@/lib/data/taxonomies";
import { yearsWaiting } from "@/lib/calc/dates";

export interface AdvocacyHearing {
  date: string; // ISO
  label: string | null;
  location: string | null;
}

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
  // "Awaiting commission order" | "Hearing scheduled" | "Application filed" | null
  reviewStep: string | null;
  reviewStepAt: string | null;
  hearingLink: string | null;
  // Last day for public comment when the source publishes one, else null.
  commentDeadline: string | null;
  // Upcoming hearings only, soonest first.
  hearings: AdvocacyHearing[];
}

const MAX_PROJECTS = 500;

const select = {
  slug: true,
  name: true,
  state: true,
  fuelType: true,
  capacityValue: true,
  capacityUnit: true,
  applicationFiledDate: true,
  currentStage: true,
  reviewStep: true,
  reviewStepAt: true,
  hearingDetailsLink: true,
  commentDeadline: true,
  sources: { select: { label: true, url: true }, take: 1 },
  hearings: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" as const }, select: { date: true, label: true, location: true } },
} as const;

// Everything a person needs to decide whether and when to act, for the
// Advocacy > Projects tab: the largest still-pending projects (MW is the only
// capacity unit that compares across projects), plus every project with an
// upcoming hearing or a docket at a decision step even when it has no MW
// figure (many transmission dockets don't). Lightweight select so this stays
// small even though it feeds a client-side filter.
export async function getAdvocacyProjects(): Promise<AdvocacyProject[]> {
  const base = { isAggregateExample: false, mergedIntoId: null, noLongerReported: false, currentStage: { notIn: RESOLVED_STAGES } };
  const [big, active] = await Promise.all([
    prisma.project.findMany({
      where: { ...base, capacityUnit: "MW", capacityValue: { not: null } },
      select,
      orderBy: { capacityValue: "desc" },
      take: MAX_PROJECTS,
    }),
    prisma.project.findMany({
      where: {
        ...base,
        OR: [{ hearings: { some: { date: { gte: new Date() } } } }, { commentDeadline: { gte: new Date() } }, { reviewStep: { in: ["Awaiting commission order", "Hearing scheduled"] } }],
      },
      select,
    }),
  ]);

  const bySlug = new Map<string, (typeof big)[number]>();
  for (const r of [...big, ...active]) bySlug.set(r.slug, r);

  return [...bySlug.values()]
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
      reviewStep: r.reviewStep,
      reviewStepAt: r.reviewStepAt ? r.reviewStepAt.toISOString() : null,
      hearingLink: r.hearingDetailsLink,
      commentDeadline: r.commentDeadline && r.commentDeadline.getTime() >= Date.now() ? r.commentDeadline.toISOString() : null,
      hearings: r.hearings.map((h) => ({ date: h.date.toISOString(), label: h.label, location: h.location })),
    }));
}
