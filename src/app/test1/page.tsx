// UNLINKED preview page — not in nav, no canonical/sitemap entry, noindex.
// Preview of a "Project / Service Area" dimension toggle layered onto the
// real /projects page shape (same StatsHeader, same Map/List pattern, same
// bottom directory) — see src/components/Test1Explorer.tsx and
// src/lib/utilityGrouping.ts for the actual logic and known imprecision.
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";
import { Test1Explorer } from "@/components/Test1Explorer";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function Test1Page() {
  const projects = await queryProjects(toFilterState({}));
  const utilityGroups = groupProjectsByUtility(projects);

  return (
    <>
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 pt-4">
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
          <strong>Unlinked preview — /test1.</strong> Not indexed, not in nav. Testing a "Project / Service Area"
          toggle on top of the real Projects page layout.
        </div>
      </div>
      <Test1Explorer projects={projects} utilityGroups={utilityGroups} />
    </>
  );
}
