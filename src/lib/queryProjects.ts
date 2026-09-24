// Shared project-query logic used by both the public REST API
// (src/app/api/projects/route.ts) and the MCP server (src/app/mcp/route.ts),
// so a filter behaves identically no matter which surface an agent uses to
// call it.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mergedChildren, overlayMerged } from "@/lib/dedupe";
import { serializeProject } from "@/lib/serialize";
import { matchesFilters, DEFAULT_FILTERS, type FilterState } from "@/lib/filters";
import { RESOLVED_STAGES, type StatusBucket } from "@/lib/data/taxonomies";
import type { ProjectDTO } from "@/lib/types";

const CANCELLED_SUSPENDED_STAGES = ["cancelled"];
const PERMITS_COMPLETE_STAGES = ["approved_awaiting_construction", "under_construction", "completed"];
// dedupe.ts's overlayMerged() can upgrade a parent's *effective* currentStage
// to one of these three from a merged child's stage — "cancelled" is
// explicitly excluded from that upgrade path, but these three aren't. A raw
// pre-overlay currentStage filter would wrongly exclude a parent that only
// reaches one of these stages after the merge overlay runs, so any pushdown
// that positively requires currentStage to be one of these must be skipped
// (verified live: this is a real, reproducible case, not a theoretical one).
const OVERLAY_UPGRADABLE_STAGES = new Set(PERMITS_COMPLETE_STAGES);

// Coarse, DB-pushed-down narrowing for the common filter dimensions — this
// is a performance optimization only, never the source of truth: every row
// it lets through still has to pass the exact matchesFilters() check below,
// so a bug here can only ever over-fetch (wasted CPU), never silently
// return a wrong result. Cut in after this pipeline was found to be the
// single biggest Vercel Fluid Active CPU consumer on the site — it used to
// fetch and serialize every tracked project on every call, even a request
// for one state and one fuel type. sourceKeys is deliberately left out (it's
// derived from a sources[].label text pattern, not a raw column, and is a
// rarely-set filter) — those calls still fall back to filtering in memory,
// same as before this change.
function whereFromFilters(f: FilterState, opts: { ignoreStatus?: boolean }): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [];

  if (!opts.ignoreStatus) {
    if (f.status === "no_longer_reported") {
      and.push({ noLongerReported: true });
    } else if (f.status === "cancelled_suspended") {
      // Safe: overlayMerged never upgrades a parent to "cancelled".
      and.push({ noLongerReported: false, currentStage: { in: CANCELLED_SUSPENDED_STAGES } });
    } else if (f.status === "permits_complete") {
      // Not pushed down (see OVERLAY_UPGRADABLE_STAGES) — still narrow by
      // noLongerReported, which overlayMerged never touches.
      and.push({ noLongerReported: false });
    } else {
      // in_permitting: excluding a raw-resolved row here is always safe —
      // overlayMerged only ever upgrades a parent *toward* a resolved
      // stage, never away from one, so a row this filter drops could never
      // have belonged in "in_permitting" anyway.
      and.push({ noLongerReported: false, currentStage: { notIn: RESOLVED_STAGES } });
    }
  }
  if (f.fuelTypes.length > 0) and.push({ fuelType: { in: f.fuelTypes } });
  if (f.projectTypes.length > 0) and.push({ projectType: { in: f.projectTypes } });
  if (f.stages.length > 0 && !f.stages.some((s) => OVERLAY_UPGRADABLE_STAGES.has(s))) {
    and.push({ currentStage: { in: f.stages } });
  }
  if (f.minCapacity != null) and.push({ capacityValue: { gte: f.minCapacity } });
  if (f.queueStages.length > 0) and.push({ interconnectionQueueStage: { in: f.queueStages } });
  // A state column can hold multiple comma-joined USPS codes (pipelines
  // spanning states) — `contains` is a safe over-inclusive approximation
  // here (real per-code matching still happens in matchesFilters).
  if (f.state != null) and.push({ state: { contains: f.state } });
  if (f.minYearsWaiting != null) {
    // Necessary-but-not-sufficient: real yearsWaiting can only be smaller
    // than "now minus filed date" (a project that already resolved waited
    // less than that), never larger — so this can only over-fetch, never
    // exclude a true match.
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - f.minYearsWaiting);
    and.push({ applicationFiledDate: { lte: cutoff } });
  }

  return and.length > 0 ? { AND: and } : {};
}

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
  const where: Prisma.ProjectWhereInput = { mergedIntoId: null, ...whereFromFilters(filters, { ignoreStatus: opts.allStatuses }) };
  const total = await prisma.project.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / FETCH_PAGE_SIZE));
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      prisma.project.findMany({
        where,
        include: { causes: true, sources: true, milestones: true },
        orderBy: { createdAt: "asc" },
        skip: i * FETCH_PAGE_SIZE,
        take: FETCH_PAGE_SIZE,
      }),
    ),
  );
  const base = pages.flat();
  // Duplicates merged into one of the rows above (see src/lib/dedupe.ts)
  // contribute their sources and best facts to it — only ever needed for
  // parents that actually survived the filter, not every merged child in
  // the database.
  const parentIds = base.map((p) => p.id);
  const children =
    parentIds.length > 0
      ? await prisma.project.findMany({ where: { mergedIntoId: { in: parentIds } }, include: { causes: true, sources: true, milestones: true } })
      : [];
  const byParent = new Map<string, typeof children>();
  for (const c of children) byParent.set(c.mergedIntoId as string, [...(byParent.get(c.mergedIntoId as string) ?? []), c]);
  const projects = base.map((p) => overlayMerged(p, byParent.get(p.id) ?? []));
  return projects.map(serializeProject).filter((p) => matchesFilters(p, filters, { ignoreStatus: opts.allStatuses }));
}

export async function getProjectBySlug(slug: string): Promise<ProjectDTO | null> {
  let project = await prisma.project.findUnique({
    where: { slug },
    include: { causes: true, sources: true, milestones: true },
  });
  // A slug that was merged into another project resolves to that project.
  if (project?.mergedIntoId) {
    project = await prisma.project.findUnique({ where: { id: project.mergedIntoId }, include: { causes: true, sources: true, milestones: true } });
  }
  if (!project) return null;
  return serializeProject(overlayMerged(project, await mergedChildren([project.id])));
}
