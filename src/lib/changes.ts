// Server-side query for the homepage changes feed — see ProjectChange in
// schema.prisma for what gets logged and why (one bundled row per project
// per ingestion run that changed something a user would care about, not a
// full audit log).

import { prisma } from "@/lib/db";
import type { ProjectChangeDTO } from "@/lib/types";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { splitStateCodes } from "@/lib/data/usStates";

export async function getRecentChanges(
  limit = 50,
  offset = 0,
  state?: string | null,
): Promise<{ changes: ProjectChangeDTO[]; hasMore: boolean }> {
  const projectSelect = {
    slug: true,
    name: true,
    state: true,
    projectType: true,
    fuelType: true,
    capacityValue: true,
    capacityUnit: true,
    isAggregateExample: true,
    verdicts: { select: { vote: true } },
  } as const;

  function tallyVerdicts(verdicts: { vote: string }[]): { greenVotes: number; redVotes: number } {
    return {
      greenVotes: verdicts.filter((v) => v.vote === "green").length,
      redVotes: verdicts.filter((v) => v.vote === "red").length,
    };
  }

  // Project.state can hold multiple comma-joined codes (a multi-state
  // transmission/pipeline project — see splitStateCodes) — a plain SQL
  // `contains` filter can't safely match that (and can false-positive on
  // an unrelated code sharing letters), so a state filter is applied in
  // app code with the same helper every other state-aware view already
  // trusts, not at the Prisma layer. Real change volume is low enough
  // (~3-5/day site-wide, confirmed live) that fetching a generous
  // unfiltered candidate window and paging the filtered result in memory
  // is simpler and cheap — no separate count() query needed either way.
  if (state) {
    const rows = await prisma.projectChange.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { project: { select: projectSelect } },
    });
    const filtered = rows.filter((r) => !r.project.isAggregateExample && splitStateCodes(r.project.state).includes(state));
    const hasMore = filtered.length > offset + limit;
    const changes = filtered.slice(offset, offset + limit).map((r) => ({
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
        ...tallyVerdicts(r.project.verdicts),
      },
    }));
    return { changes, hasMore };
  }

  // Fetch one extra row to know whether a next page exists without a
  // separate count() query — cheap, and avoids a second round trip on
  // every page load just to render a "Load more" button correctly.
  const rows = await prisma.projectChange.findMany({
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit + 1,
    include: {
      project: { select: projectSelect },
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
        ...tallyVerdicts(r.project.verdicts),
      },
    }));

  return { changes, hasMore };
}
