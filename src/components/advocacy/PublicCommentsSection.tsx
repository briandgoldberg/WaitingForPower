"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { FUEL_TYPES, FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { ruleForState, commentScore } from "@/lib/advocacyActions";
import { formatHearingDate } from "@/lib/hearingTime";

const PAGE_SIZE = 20;

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function PublicCommentsSection({
  projects,
  initialFuelFilter = [],
}: {
  projects: AdvocacyProject[];
  initialFuelFilter?: string[];
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [fuelFilter, setFuelFilter] = useState<string[]>(initialFuelFilter);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const fuelOptions = useMemo(() => {
    const present = new Set(projects.map((p) => p.fuelType));
    return FUEL_TYPES.filter((f) => present.has(f.value));
  }, [projects]);

  // Only ever score-3, confirmed-open projects make it onto this tab — see
  // commentScore in lib/advocacyActions.ts. This page's whole point is "can
  // I actually comment on this right now," so a maybe/unlikely/unknown
  // project would just waste someone's time.
  const rows = useMemo(
    () =>
      projects
        .map((p) => {
          const rule = ruleForState(p.state);
          const score = commentScore({ commentDeadline: p.commentDeadline, reviewStep: p.reviewStep, hearingCount: p.hearings.length }, rule);
          return { p, rule, score };
        })
        .filter((r) => r.score === 3),
    [projects],
  );

  const stateOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const { p } of rows) for (const c of splitStateCodes(p.state)) if (STATE_NAMES[c]) codes.add(c);
    return [...codes].sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(({ p }) => {
      if (state && !splitStateCodes(p.state).includes(state)) return false;
      if (fuelFilter.length > 0 && !fuelFilter.includes(p.fuelType)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    // Largest project first.
    return [...list].sort((a, b) => (b.p.capacityValue ?? -1) - (a.p.capacityValue ?? -1));
  }, [rows, query, state, fuelFilter]);

  const reset = () => setVisible(PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-3xl font-bold tracking-tight max-w-2xl">Submit a public comment, right now.</h2>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
          placeholder="Search projects accepting comments"
          aria-label="Search projects accepting comments"
          className="flex-1 min-w-[160px] sm:max-w-xs rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            reset();
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
        <span className="text-xs text-[var(--muted)] self-center">{filtered.length} projects</span>
      </div>

      {fuelOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {fuelOptions.map((f) => {
            const active = fuelFilter.includes(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setFuelFilter((prev) => toggle(prev, f.value));
                  reset();
                }}
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

      <div className="flex flex-col gap-3">
        {filtered.slice(0, visible).map(({ p, rule }) => {
          const fuel = FUEL_TYPE_BY_VALUE[p.fuelType as keyof typeof FUEL_TYPE_BY_VALUE];
          const codes = splitStateCodes(p.state);
          return (
            <div
              key={p.slug}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-3 border-l-4"
              style={fuel ? { borderLeftColor: fuel.color } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/project/${p.slug}`} className="font-semibold text-sm text-[var(--accent)] underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
                    {fuel && <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: fuel.color }} />}
                    <span>
                      {codes.map((c) => STATE_NAMES[c] ?? c).join(", ") || "Location not specified"} · {fuel?.label ?? p.fuelType}
                      {p.yearsWaiting != null && <> · Waiting {p.yearsWaiting.toFixed(1)} yrs</>}
                    </span>
                  </p>
                </div>
                {p.capacityValue != null && (
                  <span className="shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">
                    {formatCapacity(p.capacityValue, p.capacityUnit)}
                  </span>
                )}
              </div>

              {/* The clear, easy part: exactly what to do, in plain words,
                  right on the card — not buried behind a link someone has
                  to click and then re-orient on an unfamiliar government
                  site. No "accepting comments" badge here — every card on
                  this tab already is, by definition, so it's just noise. */}
              <div className="flex flex-col gap-1.5">
                {p.commentDeadline && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Comment window closes {formatHearingDate(p.commentDeadline, p.state)}
                  </p>
                )}
                {rule?.howToComment && <p className="text-sm text-[var(--text-secondary)]">{rule.howToComment}</p>}
                {rule?.commentUrl && (
                  <a
                    href={rule.commentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 self-start min-h-[44px] rounded-full font-bold px-5 text-sm mt-1 hover:opacity-90"
                    style={{ background: "#1e3a5f", color: "#ffffff" }}
                  >
                    Submit a public comment →
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            No projects match that right now. Comment windows open and close often — check back, or widen your filters.
          </p>
        )}
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
