"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { ProjectDTO } from "@/lib/types";
import { DEFAULT_FILTERS, buildChips, hasActiveFilters, matchesFilters, type CauseFilterValue, type FilterState } from "@/lib/filters";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { computeAggregateStats } from "@/lib/stats";
import { StatsHeader } from "@/components/StatsHeader";
import { FilterPanel } from "@/components/FilterPanel";
import { ProjectList } from "@/components/ProjectList";
import { StateDirectory } from "@/components/StateDirectory";

const Map = dynamic(() => import("@/components/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center text-sm text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

// Validates the `?cause=` deep-link param (see /policies' project-count
// links) against the real cause taxonomy plus the synthetic "unknown"
// value — an unrecognized value is silently ignored rather than crashing
// or showing an empty result set for a typo'd/stale link.
function causeFromSearchParam(raw: string | null): CauseFilterValue | null {
  if (raw === "unknown") return "unknown";
  if (raw && raw in CAUSE_CATEGORY_BY_SLUG) return raw as CauseFilterValue;
  return null;
}

export function Explorer({ projects }: { projects: ProjectDTO[] }) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => {
    const cause = causeFromSearchParam(searchParams.get("cause"));
    return cause ? { ...DEFAULT_FILTERS, causes: [cause] } : DEFAULT_FILTERS;
  });
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
        <h1 className="text-2xl font-bold tracking-tight">All projects</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Every U.S. energy project we track, filterable by state, status, fuel type, and permitting stage.{" "}
          <Link href="/" className="underline text-[var(--accent)]">
            See what changed recently →
          </Link>
        </p>
      </div>

      <StatsHeader stats={stats} exampleProject={exampleProject} status={filters.status} />

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

      <StateDirectory projects={projects} />
    </div>
  );
}
