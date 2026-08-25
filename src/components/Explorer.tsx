"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ProjectDTO } from "@/lib/types";
import { DEFAULT_FILTERS, buildChips, hasActiveFilters, matchesFilters, type FilterState } from "@/lib/filters";
import { computeAggregateStats } from "@/lib/stats";
import { StatsHeader } from "@/components/StatsHeader";
import { FilterPanel } from "@/components/FilterPanel";
import { ProjectList } from "@/components/ProjectList";

const Map = dynamic(() => import("@/components/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center text-sm text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

export function Explorer({ projects }: { projects: ProjectDTO[] }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<"map" | "list">("map");
  const [panelOpen, setPanelOpen] = useState(true);

  const filtered = useMemo(
    () => projects.filter((p) => matchesFilters(p, filters)),
    [projects, filters],
  );

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Know what&rsquo;s happening at America&rsquo;s energy projects.
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5 max-w-3xl">
          America&rsquo;s premier data source for power projects in permitting. We turn new
          filings into project intelligence.
        </p>
      </div>

      <StatsHeader stats={stats} exampleProject={exampleProject} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
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
        </div>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="lg:hidden text-sm px-3 py-1.5 rounded-md border border-[var(--border)]"
        >
          {panelOpen ? "Hide filters" : "Show filters"}
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
        {panelOpen && (
          <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <FilterPanel filters={filters} onChange={setFilters} projects={projects} />
          </div>
        )}
        <div className="h-[560px]">
          {view === "map" ? (
            <Map projects={filtered} />
          ) : (
            <div className="h-full overflow-y-auto">
              <ProjectList projects={filtered} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
