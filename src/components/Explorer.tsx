"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ProjectDTO } from "@/lib/types";
import { DEFAULT_FILTERS, buildChips, hasActiveFilters, matchesFilters, type FilterState } from "@/lib/filters";
import { computeAggregateStats } from "@/lib/stats";
import { groupProjectsByUtility, utilityMarkerProjects } from "@/lib/utilityGrouping";
import { StatsHeader } from "@/components/StatsHeader";
import { FilterPanel } from "@/components/FilterPanel";
import { ProjectList } from "@/components/ProjectList";
import { StateDirectory } from "@/components/StateDirectory";
import { UtilityList } from "@/components/UtilityList";
import { UtilityDirectory } from "@/components/UtilityDirectory";
import { ChangesFeed } from "@/components/ChangesFeed";
import type { ProjectChangeDTO } from "@/lib/types";

const Map = dynamic(() => import("@/components/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center text-sm text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

export function Explorer({
  projects,
  initialChanges,
  initialChangesHasMore,
  now,
}: {
  projects: ProjectDTO[];
  initialChanges: ProjectChangeDTO[];
  initialChangesHasMore: boolean;
  now: string;
}) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<"map" | "list" | "feed">("map");
  const [dimension, setDimension] = useState<"project" | "service-area">("project");
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = useMemo(
    () => projects.filter((p) => matchesFilters(p, filters)),
    [projects, filters],
  );

  // Respects the active filters, same set the Map/List views already show —
  // so narrowing to e.g. one fuel type also narrows what each utility group
  // contains.
  const utilityGroups = useMemo(() => groupProjectsByUtility(filtered), [filtered]);

  // The Feed view filters client-side to whatever the map/list are already
  // showing — see ChangesFeed's `filterSlugs` prop comment for why this
  // doesn't reach further back into the change history than what's loaded.
  const filteredSlugs = useMemo(() => new Set(filtered.map((p) => p.slug)), [filtered]);

  const stats = useMemo(() => computeAggregateStats(filtered), [filtered]);
  const chips = useMemo(() => buildChips(filters), [filters]);

  // One real project used to ground the stat tooltips in live numbers.
  // Prefer a project where every stat has an applicable estimate so none of
  // the four tooltips falls back to "not estimated"; degrade gracefully.
  const exampleProject = useMemo(() => {
    const real = filtered.filter((p) => !p.isAggregateExample);
    return real.find((p) => p.investmentWaiting.applicable) ?? real[0] ?? null;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-2 flex flex-col gap-2 flex-1">
      <StatsHeader stats={stats} exampleProject={exampleProject} status={filters.status} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1 bg-[var(--panel)]">
            <button
              onClick={() => setDimension("project")}
              className={`px-3 py-1 text-sm rounded-md ${dimension === "project" ? "bg-[var(--accent)] text-white" : ""}`}
            >
              Project
            </button>
            <button
              onClick={() => setDimension("service-area")}
              className={`px-3 py-1 text-sm rounded-md ${dimension === "service-area" ? "bg-[var(--accent)] text-white" : ""}`}
            >
              Utility Company
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1 bg-[var(--panel)]">
            <button
              onClick={() => setView("map")}
              className={`px-3 py-1 text-sm rounded-md ${view === "map" ? "bg-[var(--accent)] text-white" : ""}`}
            >
              Map
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1 text-sm rounded-md ${view === "list" ? "bg-[var(--accent)] text-white" : ""}`}
            >
              List
            </button>
            <button
              onClick={() => setView("feed")}
              className={`px-3 py-1 text-sm rounded-md ${view === "feed" ? "bg-[var(--accent)] text-white" : ""}`}
            >
              Feed
            </button>
          </div>
        </div>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="lg:hidden text-sm px-3 py-1.5 rounded-md border border-[var(--border)]"
        >
          {panelOpen ? "Hide filters" : chips.length > 0 ? `Filters (${chips.length})` : "Filters"}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilters(chip.onRemove(filters))}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
            >
              {chip.label} <span aria-hidden>×</span>
            </button>
          ))}
          {hasActiveFilters(filters) && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs underline text-[var(--muted)] ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-2 flex-1">
        <div className={`${panelOpen ? "" : "hidden"} lg:block lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto`}>
          <FilterPanel filters={filters} onChange={setFilters} projects={projects} />
        </div>
        <div className="h-[65vh] min-h-[380px] lg:h-[560px]">
          {view === "map" &&
            (dimension === "project" ? (
              <Map projects={filtered} />
            ) : (
              <Map
                projects={utilityMarkerProjects(utilityGroups)}
                markerLink={(p) => `/utility/${p.slug}`}
              />
            ))}
          {/* Both lists are rendered (not conditionally mounted) regardless
              of the active view/dimension, just hidden via CSS otherwise —
              this is the only place real <a href="/project/slug"> and
              <a href="/utility/slug"> links exist anywhere on the site, and
              "map"/"project" are the defaults, so a JS-executing crawler
              that never clicks either toggle would otherwise never see a
              single real link to any project or utility page, leaving
              sitemap.xml as their only discovery path. Confirmed live
              2026-09-06: Search Console reported ~1,955 project pages
              "Discovered - currently not indexed", and the server-rendered
              /projects HTML had 0 links matching href="/project/" despite
              embedding full data for every project — this is why. */}
          <div className={view === "list" && dimension === "project" ? "h-full overflow-y-auto" : "hidden"}>
            <ProjectList projects={filtered} />
          </div>
          <div className={view === "list" && dimension === "service-area" ? "h-full overflow-y-auto" : "hidden"}>
            <UtilityList groups={utilityGroups} />
          </div>
          <div className={view === "feed" ? "h-full overflow-y-auto" : "hidden"}>
            <ChangesFeed
              initialChanges={initialChanges}
              initialHasMore={initialChangesHasMore}
              now={now}
              state={null}
              filterSlugs={filteredSlugs}
            />
          </div>
        </div>
      </div>

      {dimension === "project" ? <StateDirectory projects={projects} /> : <UtilityDirectory projects={projects} />}
    </div>
  );
}
