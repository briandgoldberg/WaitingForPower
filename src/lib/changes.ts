// Server-side query for the homepage changes feed — see ProjectChange in
// schema.prisma for what gets logged and why (one bundled row per project
// per ingestion run that changed something a user would care about, not a
// full audit log).

import { prisma } from "@/lib/db";
import type { ProjectChangeDTO } from "@/lib/types";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";

export async function getRecentChanges(
  limit = 50,
  offset = 0,
): Promise<{ changes: ProjectChangeDTO[]; hasMore: boolean }> {
  // Fetch one extra row to know whether a next page exists without a
  // separate count() query — cheap, and avoids a second round trip on
  // every page load just to render a "Load more" button correctly.
  const rows = await prisma.projectChange.findMany({
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit + 1,
    include: {
      project: {
        select: {
          slug: true,
          name: true,
          state: true,
          projectType: true,
          fuelType: true,
          capacityValue: true,
          capacityUnit: true,
          isAggregateExample: true,
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  // Aggregate-example rows (a regional stat standing in for many projects,
  // see Project.isAggregateExample) don't belong in a feed framed around
  // individual project events — same exclusion this site's stats already
  // apply.
  const changes = page
    .filter((r) => !r.project.isAggregateExample)
    .map((r) => ({
      id: r.id,
      changeTypes: r.changeTypes,
      previousStage: (r.previousStage as ProjectStage | null) ?? null,
      newStage: (r.newStage as ProjectStage | null) ?? null,
      summary: r.summary,
      createdAt: r.createdAt.toISOString(),
      project: {
        slug: r.project.slug,
        name: r.project.name,
        state: r.project.state,
        projectType: r.project.projectType as ProjectType,
        fuelType: r.project.fuelType as FuelType,
        capacityValue: r.project.capacityValue,
        capacityUnit: r.project.capacityUnit,
      },
    }));

  return { changes, hasMore };
}
