import { prisma } from "@/lib/db";

export interface UpcomingHearingEntry {
  date: string; // ISO
  endDate: string | null; // ISO
  label: string | null;
  location: string | null;
}

export interface UpcomingHearingGroup {
  project: {
    slug: string;
    name: string;
    state: string | null;
    hearingDetailsLink: string | null;
  };
  hearings: UpcomingHearingEntry[];
}

// One card per project, each holding every real upcoming hearing date found
// for it (a project can have several — see ProjectHearing in schema.prisma).
// Groups come back ordered by their own earliest hearing, oldest first,
// which falls out for free from querying hearings in date order and
// grouping by first-seen project.
export async function getUpcomingPublicHearingGroups(): Promise<UpcomingHearingGroup[]> {
  const rows = await prisma.projectHearing.findMany({
    where: {
      date: { gte: new Date() },
      project: { noLongerReported: false, isAggregateExample: false },
    },
    orderBy: { date: "asc" },
    include: {
      project: { select: { slug: true, name: true, state: true, hearingDetailsLink: true } },
    },
  });

  const byProject = new Map<string, UpcomingHearingGroup>();
  for (const row of rows) {
    const entry: UpcomingHearingEntry = {
      date: row.date.toISOString(),
      endDate: row.endDate ? row.endDate.toISOString() : null,
      label: row.label,
      location: row.location,
    };
    const existing = byProject.get(row.project.slug);
    if (existing) {
      existing.hearings.push(entry);
    } else {
      byProject.set(row.project.slug, { project: row.project, hearings: [entry] });
    }
  }
  return Array.from(byProject.values());
}

export async function countUpcomingPublicHearings(): Promise<number> {
  return prisma.projectHearing.count({
    where: {
      date: { gte: new Date() },
      project: { noLongerReported: false, isAggregateExample: false },
    },
  });
}
