import type { Metadata } from "next";
import Link from "next/link";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Energy Projects by State | WaitingForPower",
  description:
    "Browse U.S. energy projects waiting on permitting approval by state — generation, transmission, storage, LNG, and pipeline projects, live and sourced.",
};

export default async function StatesIndexPage() {
  const projects = await queryProjects(toFilterState(DEFAULT_FILTERS));

  // A multi-state project (e.g. a pipeline listing "NY,CT,MA,RI") counts
  // toward every state it touches — see splitStateCodes in
  // src/lib/data/usStates.ts for why the `state` field is comma-separated.
  const counts = new Map<string, number>();
  for (const p of projects) {
    for (const code of splitStateCodes(p.state)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const states = Object.entries(STATE_NAMES)
    .filter(([code]) => code in STATE_NAMES && counts.has(code))
    .map(([code, name]) => ({ code, name, count: counts.get(code) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Energy projects by state</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          {states.length} states with at least one project currently waiting on a permitting
          decision, tracked live from public federal and state sources.{" "}
          <Link href="/projects" className="underline text-[var(--accent)]">
            See the full map →
          </Link>
        </p>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
