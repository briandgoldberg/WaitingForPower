"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ProjectDTO } from "@/lib/types";
import { computeAggregateStats } from "@/lib/stats";
import { StatsHeader } from "@/components/StatsHeader";
import { ProjectList } from "@/components/ProjectList";
import { StateDirectory } from "@/components/StateDirectory";
import { utilityMarkerProjects, type UtilityGroup } from "@/lib/utilityGrouping";

const Map = dynamic(() => import("@/components/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center text-sm text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

type Dimension = "project" | "service-area";
type View = "map" | "list";

// Preview of a new "dimension" toggle on top of the real /projects page
// shape (same StatsHeader, same Map/List pattern, same bottom directory) —
// Project is today's view; Service Area regroups the same underlying
// projects by utility (EIA-861 county data) instead of by state/individual
// project. See src/lib/utilityGrouping.ts for the known imprecision.
export function Test1Explorer({ projects, utilityGroups }: { projects: ProjectDTO[]; utilityGroups: UtilityGroup[] }) {
  const [dimension, setDimension] = useState<Dimension>("project");
  const [view, setView] = useState<View>("map");

  const stats = useMemo(() => computeAggregateStats(projects), [projects]);
  const exampleProject = useMemo(() => projects.find((p) => p.investmentWaiting.applicable) ?? projects[0] ?? null, [projects]);
  const utilityMarkers = useMemo(() => utilityMarkerProjects(utilityGroups), [utilityGroups]);
  // One shared lookup instead of duplicating project objects per utility
  // group — see UtilityGroup.projectSlugs' comment for why.
  const bySlug = useMemo(() => new Map(projects.map((p) => [p.slug, p])), [projects]);
  const projectsFor = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((p): p is ProjectDTO => p != null);

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-2 flex flex-col gap-3 flex-1">
      <StatsHeader stats={stats} exampleProject={exampleProject} status="in_permitting" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border-2 border-[var(--accent)] p-1 bg-[var(--panel)]">
          <span className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Show by</span>
          <button
            onClick={() => setDimension("project")}
            className={`px-3 py-1 text-sm rounded-md font-medium ${dimension === "project" ? "bg-[var(--accent)] text-white" : ""}`}
          >
            Project
          </button>
          <button
            onClick={() => setDimension("service-area")}
            className={`px-3 py-1 text-sm rounded-md font-medium ${dimension === "service-area" ? "bg-[var(--accent)] text-white" : ""}`}
          >
            Service Area
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1 bg-[var(--panel)]">
          <button onClick={() => setView("map")} className={`px-3 py-1 text-sm rounded-md ${view === "map" ? "bg-[var(--accent)] text-white" : ""}`}>
            Map
          </button>
          <button onClick={() => setView("list")} className={`px-3 py-1 text-sm rounded-md ${view === "list" ? "bg-[var(--accent)] text-white" : ""}`}>
            List
          </button>
        </div>
      </div>

      {dimension === "service-area" && (
        <p className="text-xs text-[var(--muted)]">
          Grouped by utility service territory (EIA-861 county data). A county often lists several utilities, so a
          project may appear under more than one — this is a known approximation, not a precise match. Map markers
          are placed at the average location of each utility&rsquo;s own tracked projects, not a real territory
          boundary.
        </p>
      )}

      <div className="h-[65vh] min-h-[380px] lg:h-[560px]">
        {view === "map" && <Map projects={dimension === "project" ? projects : utilityMarkers} />}
        <div className={view === "list" ? "h-full overflow-y-auto" : "hidden"}>
          {dimension === "project" ? (
            <ProjectList projects={projects} />
          ) : (
            <div className="flex flex-col gap-3">
              {utilityGroups.map((u) => (
                <details key={u.utility} id={`util-${u.utility.replace(/\s+/g, "-")}`} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
                  <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{u.utility}</span>
                    <span className="text-sm text-[var(--muted)]">{u.count} projects</span>
                  </summary>
                  <div className="mt-4">
                    <ProjectList projects={projectsFor(u.projectSlugs)} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      {dimension === "project" ? (
        <StateDirectory projects={projects} />
      ) : (
        <div className="mt-2">
          <h2 className="text-sm font-semibold mb-2">Browse by service area</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {utilityGroups.map((u) => (
              <li key={u.utility}>
                <Link
                  href={`#util-${u.utility.replace(/\s+/g, "-")}`}
                  onClick={() => setView("list")}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="truncate">{u.utility}</span>
                  <span className="text-xs text-[var(--muted)] tabular-nums shrink-0 ml-2">{u.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
