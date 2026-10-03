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
  const full = await queryProjects(toFilterState({}));
  // Strip the heavy per-project relation arrays before this goes to the
  // client — neither ProjectList nor Map reads them, and utility grouping
  // duplicates whatever's left across every utility a project's county
  // lists (some projects land in 3-5+ groups), so the full objects (with
  // sources/milestones/statusHistory/hearings/opposition) were blowing the
  // page's hydration payload up to 13MB+ and stalling the map.
  const projects = full.map((p) => ({ ...p, sources: [], milestones: [], statusHistory: [], hearings: [], opposition: [] }));
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
