"use client";

import { useMemo, useState } from "react";
import type { ProjectDTO } from "@/lib/types";
import { ProjectList } from "@/components/ProjectList";
import { Map } from "@/components/Map";
import { FUEL_TYPES } from "@/lib/data/taxonomies";
import type { FuelType } from "@/lib/data/taxonomies";

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// Map/List tab toggle for a single utility's project set — same Map/List
// style as the main Explorer, so a utility page reads as the same product
// at a narrower scope rather than a one-off layout (the full-page version
// just stacked the map above the list with no toggle). A Fuel filter
// applies to both views at once (same filtered `projects` array feeds
// both), scoped to just the fuel types actually present in this utility's
// own project set rather than the full taxonomy.
export function UtilityProjectsView({ projects }: { projects: ProjectDTO[] }) {
  const [view, setView] = useState<"map" | "list">("list");
  const [fuelFilter, setFuelFilter] = useState<FuelType[]>([]);

  const fuelOptions = useMemo(() => {
    const present = new Set(projects.map((p) => p.fuelType));
    return FUEL_TYPES.filter((f) => present.has(f.value));
  }, [projects]);

  const filteredProjects = fuelFilter.length === 0 ? projects : projects.filter((p) => fuelFilter.includes(p.fuelType));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1 bg-[var(--panel)] w-fit">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1 text-sm rounded-md ${view === "list" ? "bg-[var(--accent)] text-white" : ""}`}
          >
            List
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1 text-sm rounded-md ${view === "map" ? "bg-[var(--accent)] text-white" : ""}`}
          >
            Map
          </button>
        </div>

        {fuelOptions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            {fuelOptions.map((f) => {
              const active = fuelFilter.includes(f.value);
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFuelFilter((prev) => toggle(prev, f.value))}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    active
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-[55vh] min-h-[320px] lg:h-[460px]">
        {view === "map" && <Map projects={filteredProjects} />}
        {/* Rendered (not conditionally mounted) regardless of the active
            view, just hidden via CSS — same crawlability reasoning as
            Explorer.tsx: this is the only place real <a href="/project/..">
            links to this utility's own projects exist. */}
        <div className={view === "list" ? "h-full overflow-y-auto" : "hidden"}>
          <ProjectList projects={filteredProjects} />
        </div>
      </div>
    </div>
  );
}
