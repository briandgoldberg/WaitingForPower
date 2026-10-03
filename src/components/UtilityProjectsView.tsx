"use client";

import { useState } from "react";
import type { ProjectDTO } from "@/lib/types";
import { ProjectList } from "@/components/ProjectList";
import { Map } from "@/components/Map";

// Map/List tab toggle for a single utility's project set — same Map/List
// style as the main Explorer, so a utility page reads as the same product
// at a narrower scope rather than a one-off layout (the full-page version
// just stacked the map above the list with no toggle).
export function UtilityProjectsView({ projects }: { projects: ProjectDTO[] }) {
  const [view, setView] = useState<"map" | "list">("list");

  return (
    <div className="flex flex-col gap-2">
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

      <div className="h-[55vh] min-h-[320px] lg:h-[460px]">
        {view === "map" && <Map projects={projects} />}
        {/* Rendered (not conditionally mounted) regardless of the active
            view, just hidden via CSS — same crawlability reasoning as
            Explorer.tsx: this is the only place real <a href="/project/..">
            links to this utility's own projects exist. */}
        <div className={view === "list" ? "h-full overflow-y-auto" : "hidden"}>
          <ProjectList projects={projects} />
        </div>
      </div>
    </div>
  );
}
