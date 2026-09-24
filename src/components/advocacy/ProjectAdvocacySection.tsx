"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { FUEL_TYPE_BY_VALUE, POTENTIAL_POLLUTER_FUELS, formatCapacity, type FuelType } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import type { StateCommentRule } from "@/lib/data/stateCommentRules";
import { isPublicHearing, ruleForState, commentScore, commentStatusText } from "@/lib/advocacyActions";

const PAGE_SIZE = 20;

// Four exclusive views: the first is every project on this page (all of them
// are, literally, awaiting a decision); the other three partition the rest by
// comment likelihood, so a project appears under exactly one of them, never
// more than one. Results are always shown largest project first (MW).
const SHORT_LIKELIHOOD_LABELS = ["All", "Unlikely", "Maybe", "Confirmed"] as const;

const LIKELIHOOD_LEVELS = [
  { label: "Projects awaiting a decision that may accept public comments" },
  { label: "Public comments unlikely to be accepted" },
  { label: "Public comments possibly open, not confirmed" },
  { label: "Public comments confirmed open" },
] as const;

// Which comment-likelihood score(s) each button (after "All") shows. Buttons
// never overlap each other: "Unlikely" alone covers both 0 (confirmed closed)
// and 1 (decision pending, no confirmed rule, leans closed), "Maybe" is
// exactly 2, "Confirmed" is exactly 3.
function matchesBucket(button: number, score: number): boolean {
  if (button === 0) return true;
  if (button === 1) return score <= 1;
  return score === button;
}

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

interface ActionRow {
  ok: boolean | null;
  label: string;
  lines: string[];
}

// What a resident can do on this project: whether they can attend and speak
// at a hearing, and a comment-likelihood score (see matchesBucket): 0
// confirmed closed, 1 decision pending with no confirmed rule (leans
// closed), 2 genuinely unknown, 3 confirmed open. `attend` is null when
// there is nothing to show at all (no public hearing) rather than a row
// saying so.
function actionsFor(p: AdvocacyProject, rule: StateCommentRule | undefined): { attend: ActionRow | null; score: number } {
  const pub = p.hearings.filter(isPublicHearing);

  // Hearings closed to the public (evidentiary, parties only) stay off this
  // page entirely; they're still on the project's own page.
  const attend: ActionRow | null =
    pub.length > 0
      ? { ok: true, label: "Attend and speak", lines: pub.map((h) => `${fmtShort(h.date)} · ${h.label ?? "Public hearing"}${h.location ? " · " + h.location : ""}`) }
      : null;

  const score = commentScore({ commentDeadline: p.commentDeadline, reviewStep: p.reviewStep, hearingCount: p.hearings.length }, rule);
  return { attend, score };
}

export function ProjectAdvocacySection({ projects, initialBucket = 0 }: { projects: AdvocacyProject[]; initialBucket?: number }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [bucket, setBucket] = useState(initialBucket);
  const [pollutersOnly, setPollutersOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(
    () =>
      projects.map((p) => {
        const rule = ruleForState(p.state);
        const { attend, score } = actionsFor(p, rule);
        return { p, rule, attend, score };
      }),
    [projects],
  );

  const stateOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const p of projects) for (const c of splitStateCodes(p.state)) if (STATE_NAMES[c]) codes.add(c);
    return [...codes].sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));
  }, [projects]);

  const inScope = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ p }) => {
      if (state && !splitStateCodes(p.state).includes(state)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (pollutersOnly && !POTENTIAL_POLLUTER_FUELS.includes(p.fuelType as FuelType)) return false;
      return true;
    });
  }, [rows, query, state, pollutersOnly]);

  const filtered = useMemo(() => {
    const list = inScope.filter((r) => matchesBucket(bucket, r.score));
    // Always largest project first, regardless of likelihood or date.
    return [...list].sort((a, b) => (b.p.capacityValue ?? -1) - (a.p.capacityValue ?? -1));
  }, [inScope, bucket]);

  const reset = () => setVisible(PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
          placeholder="Search all projects awaiting a decision"
          aria-label="Search all projects awaiting a decision"
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
        <label className="flex items-center gap-1.5 text-xs font-medium self-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pollutersOnly}
            onChange={(e) => {
              setPollutersOnly(e.target.checked);
              reset();
            }}
            className="accent-[var(--accent)]"
          />
          Biggest polluters (potentially)
        </label>
        <span className="text-xs text-[var(--muted)] self-center">{filtered.length} projects</span>
      </div>

      <div className="flex flex-col gap-1.5 max-w-sm">
        <span className="text-xs font-medium">Accepting comments?</span>
        <div className="relative grid grid-cols-4 rounded-full bg-black/5 dark:bg-white/10 p-1" role="radiogroup" aria-label="Accepting comments?">
          <div
            aria-hidden
            className="absolute top-1 bottom-1 rounded-full bg-[var(--accent)] transition-[left] duration-200 ease-out"
            style={{ left: `calc(${bucket} * 25% + 3px)`, width: "calc(25% - 6px)" }}
          />
          {LIKELIHOOD_LEVELS.map((lvl, i) => (
            <button
              key={lvl.label}
              type="button"
              role="radio"
              aria-checked={bucket === i}
              onClick={() => {
                setBucket(i);
                reset();
              }}
              className={`relative z-10 rounded-full px-1 py-1.5 text-[11px] sm:text-xs font-medium leading-tight text-center transition-colors ${
                bucket === i ? "text-white" : "text-[var(--text-secondary)]"
              }`}
            >
              {SHORT_LIKELIHOOD_LABELS[i]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.slice(0, visible).map(({ p, rule, attend, score }) => {
          const fuel = FUEL_TYPE_BY_VALUE[p.fuelType as keyof typeof FUEL_TYPE_BY_VALUE];
          const codes = splitStateCodes(p.state);
          const regulator = codes.length === 1 ? STATE_REGULATORS[codes[0]]?.[0] : undefined;
          return (
            <div key={p.slug} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/project/${p.slug}`} className="font-semibold text-sm text-[var(--accent)] underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {codes.map((c) => STATE_NAMES[c] ?? c).join(", ") || "Location not specified"} · {fuel?.label ?? p.fuelType}
                    {p.yearsWaiting != null && <> · Waiting {p.yearsWaiting.toFixed(1)} yrs</>}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1 text-right">
                  {p.capacityValue != null && (
                    <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">
                      {formatCapacity(p.capacityValue, p.capacityUnit)}
                    </span>
                  )}
                  <span className="text-xs text-[var(--text-secondary)]">{commentStatusText(score, p.commentDeadline)}</span>
                </div>
              </div>

              {attend && (
                <div className="rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2.5 flex gap-2.5 text-xs">
                  <span aria-hidden className="w-4 shrink-0 text-center">
                    📅
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold">{attend.label}</div>
                    {attend.lines.map((l, i) => (
                      <div key={i} className="text-[var(--muted)]">
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {rule?.commentUrl && (
                  <a href={rule.commentUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
                    How to comment
                  </a>
                )}
                {p.docketUrl && (
                  <a href={p.docketUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
                    Docket
                  </a>
                )}
                {p.hearingLink && /^https?:\/\//.test(p.hearingLink) && (
                  <a href={p.hearingLink} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
                    Hearing details
                  </a>
                )}
                {regulator && (
                  <a href={regulator.contactUrl ?? regulator.website} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
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

      <a href="/hearings.rss" className="text-xs text-[var(--muted)] underline w-fit">
        Hearings RSS feed
      </a>
    </div>
  );
}
