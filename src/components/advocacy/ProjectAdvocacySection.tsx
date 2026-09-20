"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";

const PAGE_SIZE = 20;

export function ProjectAdvocacySection({ projects }: { projects: AdvocacyProject[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const stateOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const p of projects) for (const c of splitStateCodes(p.state)) if (STATE_NAMES[c]) codes.add(c);
    return [...codes].sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (state && !splitStateCodes(p.state).includes(state)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, query, state]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)] max-w-2xl">
        Pick a project you care about. Read its docket, contact the regulator, and add your prediction or comment. These have waited the longest.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="Search projects"
          aria-label="Search projects"
          className="flex-1 min-w-[180px] sm:max-w-xs rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          aria-label="Filter by state"
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="">All states</option>
          {stateOptions.map((c) => (
            <option key={c} value={c}>
              {STATE_NAMES[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.slice(0, visible).map((p) => {
          const fuel = FUEL_TYPE_BY_VALUE[p.fuelType as keyof typeof FUEL_TYPE_BY_VALUE];
          const codes = splitStateCodes(p.state);
          const regulator = codes.length === 1 ? STATE_REGULATORS[codes[0]]?.[0] : undefined;
          return (
            <div key={p.slug} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/project/${p.slug}#take-action`} className="font-semibold text-sm hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {codes.map((c) => STATE_NAMES[c] ?? c).join(", ") || "Location not specified"} · {fuel?.label ?? p.fuelType} ·{" "}
                    {formatCapacity(p.capacityValue, p.capacityUnit)}
                  </p>
                </div>
                {p.yearsWaiting != null && (
                  <span className="shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">
                    {p.yearsWaiting.toFixed(1)} yrs
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
                <Link href={`/project/${p.slug}#take-action`} className="font-semibold text-[var(--accent)] underline">
                  Take action
                </Link>
                {p.docketUrl && (
                  <a href={p.docketUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                    Docket
                  </a>
                )}
                {regulator && (
                  <a href={regulator.contactUrl ?? regulator.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                    Contact regulator
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-[var(--muted)]">No projects match that.</p>}
      </div>

      {filtered.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="text-sm font-medium px-3 py-2 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
        >
          Show more
        </button>
      )}
    </div>
  );
}
