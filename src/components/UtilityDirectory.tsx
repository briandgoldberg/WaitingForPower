"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ProjectDTO } from "@/lib/types";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";

// A directory of every utility service territory with at least a few
// waiting projects, independent of the Explorer's own active filters —
// same rule as StateDirectory (this is a browse-by entry point, via
// /utility/[slug], not another filtered view of the current selection).
export function UtilityDirectory({ projects }: { projects: ProjectDTO[] }) {
  const groups = useMemo(() => groupProjectsByUtility(projects), [projects]);

  if (groups.length === 0) return null;

  return (
    <div className="mt-2">
      <h2 className="text-sm font-semibold mb-2">Browse by utility company</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {groups.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/utility/${g.slug}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="truncate">{g.utility}</span>
              <span className="text-xs text-[var(--muted)] tabular-nums shrink-0 ml-2">{g.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
