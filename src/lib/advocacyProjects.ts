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
  // Most recent real, individually-filed public comment on this project's
  // docket within RECENT_COMMENT_WINDOW_DAYS (see lib/ingest/caCecComments.ts),
  // else null. A comment actually being filed is stronger, more direct
  // evidence the window is open right now than any of the state-rule
  // heuristics commentScore otherwise relies on.
  recentPublicCommentDate: string | null;
}

const MAX_PROJECTS = 500;
// How recent a filed comment has to be to count as "the window is open
// right now" rather than stale evidence of a period that's since closed.
// Comment periods on a contested docket commonly run 30-45 days around a
// staff assessment/EIR milestone (see Fountain Wind's real docket, which
// this was sized against) — 45 days errs toward not missing one.
const RECENT_COMMENT_WINDOW_DAYS = 45;

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
  publicComments: {
    where: { filedDate: { gte: new Date(Date.now() - RECENT_COMMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000) } },
    orderBy: { filedDate: "desc" as const },
    take: 1,
    select: { filedDate: true },
  },
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
        OR: [
          { hearings: { some: { date: { gte: new Date() } } } },
          { commentDeadline: { gte: new Date() } },
          { reviewStep: { in: ["Awaiting commission order", "Hearing scheduled"] } },
          { publicComments: { some: { filedDate: { gte: new Date(Date.now() - RECENT_COMMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000) } } } },
        ],
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
      recentPublicCommentDate: r.publicComments[0] ? r.publicComments[0].filedDate.toISOString() : null,
    }));
}
