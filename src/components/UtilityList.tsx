"use client";

import Link from "next/link";
import type { UtilityGroup } from "@/lib/utilityGrouping";
import { formatUsd } from "@/lib/calc/investmentWaiting";

// The Utility Company dimension's list view: a simple, filtered list of
// utility rows linking out to each utility's own /utility/[slug] page —
// that page already has the full project list, so this doesn't duplicate
// it inline (earlier version did, as an accordion-of-ProjectLists; this
// replaces it). Shared by Explorer.tsx (/projects) and
// StateProjectExplorer.tsx (/state/[code]).
export function UtilityList({ groups }: { groups: UtilityGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No utility company data available for this set of projects yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        <Link
          key={g.utility}
          href={`/utility/${g.slug}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="font-semibold">{g.utility}</span>
          <span className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <span>{g.count} projects</span>
            {g.totalInvestment > 0 && <span>{formatUsd(g.totalInvestment)} waiting</span>}
            <span className="text-[var(--accent)]">View page →</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
