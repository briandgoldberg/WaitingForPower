"use client";

import Link from "next/link";
import type { ProjectDTO } from "@/lib/types";
import type { UtilityGroup } from "@/lib/utilityGrouping";
import { ProjectList } from "@/components/ProjectList";

// The Service Area dimension's list view: one collapsible section per
// utility, each with a link to its own /utility/[slug] page and the same
// ProjectList used everywhere else. Shared by Explorer.tsx (/projects) and
// StateProjectExplorer.tsx (/state/[code]) rather than duplicated, since
// both need the same slug -> project resolution (a project can land in
// several groups at once — see UtilityGroup.projectSlugs).
export function UtilityAccordion({ groups, projects }: { groups: UtilityGroup[]; projects: ProjectDTO[] }) {
  // A plain record, not a `Map` — callers of this component live inside
  // pages that import a `Map` component (the map view), which shadows the
  // global Map constructor.
  const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));
  const projectsFor = (slugs: string[]) => slugs.map((s) => bySlug[s]).filter((p): p is ProjectDTO => p != null);

  if (groups.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No utility service-area data available for this set of projects yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <details key={g.utility} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{g.utility}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)]">{g.count} projects</span>
              <Link href={`/utility/${g.slug}`} className="text-xs text-[var(--accent)] underline">
                Full page →
              </Link>
            </span>
          </summary>
          <div className="mt-4">
            <ProjectList projects={projectsFor(g.projectSlugs)} />
          </div>
        </details>
      ))}
    </div>
  );
}
