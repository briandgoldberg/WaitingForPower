import { prisma } from "@/lib/db";
import { overlayMerged, mergedChildren } from "@/lib/dedupe";
import { serializeProject } from "@/lib/serialize";
import type { ProjectDTO } from "@/lib/types";
import { DIRTIEST_PROJECTS, type DirtiestCategory } from "@/lib/data/dirtiestProjects";

export interface DirtiestProject {
  project: ProjectDTO;
  category: DirtiestCategory;
  blurb: string;
}

const relations = { causes: true, sources: true, milestones: true } as const;

// Batch-fetches the curated slug list in two round trips total (one for the
// canonical rows, one for every merged-duplicate child across all of them)
// rather than one project detail page's worth of queries per entry — see
// mergedChildren/overlayMerged in dedupe.ts for why a merged duplicate needs
// its own children folded in the same way the single project page does.
// A slug that no longer resolves (renamed, deleted) is silently dropped
// rather than breaking the whole page — this list is re-verified by hand
// periodically anyway (see dirtiestProjects.ts header).
export async function getDirtiestProjects(): Promise<DirtiestProject[]> {
  if (DIRTIEST_PROJECTS.length === 0) return [];

  const slugs = DIRTIEST_PROJECTS.map((e) => e.slug);
  const rows = await prisma.project.findMany({ where: { slug: { in: slugs } }, include: relations });
  const children = await mergedChildren(rows.map((r) => r.id));
  const childrenByParent = new Map<string, typeof children>();
  for (const c of children) {
    if (!c.mergedIntoId) continue;
    const arr = childrenByParent.get(c.mergedIntoId) ?? [];
    arr.push(c);
    childrenByParent.set(c.mergedIntoId, arr);
  }
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const out: DirtiestProject[] = [];
  for (const entry of DIRTIEST_PROJECTS) {
    const row = bySlug.get(entry.slug);
    if (!row) continue;
    const merged = overlayMerged(row, childrenByParent.get(row.id) ?? []);
    out.push({ project: serializeProject(merged), category: entry.category, blurb: entry.blurb });
  }
  return out;
}
