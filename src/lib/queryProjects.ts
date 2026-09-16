// Shared project-query logic used by both the public REST API
// (src/app/api/projects/route.ts) and the MCP server (src/app/mcp/route.ts),
// so a filter behaves identically no matter which surface an agent uses to
// call it.

import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import { matchesFilters, DEFAULT_FILTERS, type FilterState } from "@/lib/filters";
import type { StatusBucket } from "@/lib/data/taxonomies";
import type { ProjectDTO } from "@/lib/types";

export interface ProjectQuery {
  state?: string | null;
  fuelType?: string[];
  projectType?: string[];
  stage?: string[];
  minYearsWaiting?: number | null;
  minCapacity?: number | null;
  // Real projects that are approved, cancelled, or no longer being reported
  // by their source are already correctly categorized into these buckets
  // (see statusBucketForProject in taxonomies.ts) — but until this field
  // existed, neither the public REST API nor the MCP server had any way to
  // ask for anything but the default "in_permitting" bucket, so a caller
  // could never actually retrieve a resolved project through either. "all"
  // returns every bucket at once (see FilterState.status's own doc comment
  // for why FilterState itself can't represent "all" — it's always exactly
  // one bucket, matching the Explorer's single-select status pills).
  status?: StatusBucket | "all" | null;
}

export function toFilterState(q: ProjectQuery): FilterState {
  return {
    ...DEFAULT_FILTERS,
    status: q.status && q.status !== "all" ? q.status : DEFAULT_FILTERS.status,
    state: q.state ?? null,
    fuelTypes: (q.fuelType ?? []) as FilterState["fuelTypes"],
    projectTypes: (q.projectType ?? []) as FilterState["projectTypes"],
    stages: (q.stage ?? []) as FilterState["stages"],
    minYearsWaiting: q.minYearsWaiting ?? null,
    minCapacity: q.minCapacity ?? null,
  };
}

// Prisma Accelerate hard-caps a single query's response at 5MB — the full
// dataset with all three relations included is already past that (8MB+ and
// growing), so this fetches it in pages instead of one findMany(). Every
// caller (this site's own API routes, the MCP server's search_projects/
// get_stats) goes through here, so this fixes all of them at once rather
// than each route working around the limit separately.
const FETCH_PAGE_SIZE = 250;

export async function queryProjects(filters: FilterState, opts: { allStatuses?: boolean } = {}): Promise<ProjectDTO[]> {
  const total = await prisma.project.count();
  const pageCount = Math.max(1, Math.ceil(total / FETCH_PAGE_SIZE));
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      prisma.project.findMany({
        include: { causes: true, sources: true, milestones: true },
        orderBy: { createdAt: "asc" },
        skip: i * FETCH_PAGE_SIZE,
        take: FETCH_PAGE_SIZE,
      }),
    ),
  );
  const projects = pages.flat();
  return projects.map(serializeProject).filter((p) => matchesFilters(p, filters, { ignoreStatus: opts.allStatuses }));
}

export async function getProjectBySlug(slug: string): Promise<ProjectDTO | null> {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { causes: true, sources: true, milestones: true },
  });
  return project ? serializeProject(project) : null;
}
