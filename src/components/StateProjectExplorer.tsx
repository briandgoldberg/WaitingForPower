"use client";

import { useMemo, useState } from "react";
import type { ProjectDTO } from "@/lib/types";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";
import { ProjectList } from "@/components/ProjectList";
import { UtilityList } from "@/components/UtilityList";

// Project/Utility Company toggle for /state/[code] — no map, no filters,
// just swapping the flat project list for a list of the utilities serving
// this state, each linking to its own /utility/[slug] page. minCount: 1
// (not the usual 3) — a single state's slice of a utility's territory is
// often small, and an empty "Utility Company" view on a state page would
// read as broken rather than as a real noise floor.
export function StateProjectExplorer({ projects }: { projects: ProjectDTO[] }) {
  const [dimension, setDimension] = useState<"project" | "service-area">("project");
  const utilityGroups = useMemo(() => groupProjectsByUtility(projects, { minCount: 1 }), [projects]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 rounded-lg border-2 border-[var(--accent)] p-1 bg-[var(--panel)] w-fit">
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
          Utility Company
        </button>
      </div>

      {/* Both rendered (not conditionally mounted), just hidden via CSS —
          same crawlability reasoning as Explorer.tsx: this page's only real
          <a href="/project/..."> / <a href="/utility/..."> links live here. */}
      <div className={dimension === "project" ? "" : "hidden"}>
        <ProjectList projects={projects} />
      </div>
      <div className={dimension === "service-area" ? "" : "hidden"}>
        <UtilityList groups={utilityGroups} />
      </div>
    </div>
  );
}
