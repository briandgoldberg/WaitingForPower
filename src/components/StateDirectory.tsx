"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ProjectDTO } from "@/lib/types";
import { statusBucketForProject } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";

// A directory of every state with at least one still-waiting project,
// independent of the Explorer's own active filters — this is a browse-by
// entry point (and, via /state/[code], an SEO landing page each), not
// another filtered view of `filtered`, so it always shows the full "in
// permitting" picture regardless of what's currently selected above.
export function StateDirectory({ projects }: { projects: ProjectDTO[] }) {
  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      if (statusBucketForProject(p.currentStage, p.noLongerReported) !== "in_permitting") continue;
      for (const code of splitStateCodes(p.state)) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    return Object.entries(STATE_NAMES)
      .filter(([code]) => counts.has(code))
      .map(([code, name]) => ({ code, name, count: counts.get(code) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [projects]);

  if (states.length === 0) return null;

  return (
    <div className="mt-2">
      <h2 className="text-sm font-semibold mb-2">Browse by state</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {states.map((s) => (
          <li key={s.code}>
            <Link
              href={`/state/${s.code}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span>{s.name}</span>
              <span className="text-xs text-[var(--muted)] tabular-nums">{s.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
