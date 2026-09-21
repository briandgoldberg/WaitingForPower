"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { STATE_COMMENT_RULES, type StateCommentRule } from "@/lib/data/stateCommentRules";

const PAGE_SIZE = 20;

type Filter = "comment" | "hearing" | "open";

// A project shows under every filter it qualifies for: one that is taking
// comments and has a public hearing appears under both.
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Case Open" },
  { value: "comment", label: "Comments Open" },
  { value: "hearing", label: "Hearing Coming Up" },
];

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

interface ActionRow {
  ok: boolean | null;
  label: string;
  lines: string[];
}

// What a resident can do on this project, stated as actions: whether they can
// attend and speak, and whether they can send a comment. `ok: null` means we
// cannot tell (shown as "maybe").
function actionsFor(p: AdvocacyProject, rule: StateCommentRule | undefined): { attend: ActionRow; comment: ActionRow } {
  const pub = p.hearings.filter(isPublicHearing);
  const closedRule = rule?.recordRule === "closes_at_hearing";
  const openRule = rule?.recordRule === "open_until_decision";
  const decisionNext = p.reviewStep === "Awaiting commission order";

  let attend: ActionRow;
  if (pub.length > 0) {
    attend = { ok: true, label: "Attend and speak", lines: pub.map((h) => `${fmtShort(h.date)} · ${h.label ?? "Public hearing"}${h.location ? " · " + h.location : ""}`) };
  } else {
    // Hearings closed to the public (evidentiary, parties only) are left off
    // here; they stay on the project page.
    attend = { ok: false, label: "No public hearing scheduled", lines: [] };
  }

  let comment: ActionRow;
  const how = rule?.howToComment ? [rule.howToComment] : [];
  if (p.commentDeadline) {
    comment = { ok: true, label: `Send a comment by ${fmtShort(p.commentDeadline)}`, lines: how };
  } else if (decisionNext && closedRule) {
    comment = { ok: false, label: "Comments are closed", lines: ["This state closes the record at the hearing. You can still write to the commission."] };
  } else if (decisionNext && openRule) {
    comment = { ok: true, label: "Send a comment before the decision", lines: how };
  } else if (decisionNext) {
    comment = { ok: null, label: "Comments have probably closed", lines: ["The hearing is over. You can still write to the commission."] };
  } else if (openRule) {
    comment = { ok: true, label: "Send a comment before the decision", lines: how };
  } else if (closedRule && p.hearings.length > 0) {
    comment = { ok: true, label: "Send a comment before the hearing", lines: how };
  } else {
    comment = { ok: null, label: "Maybe accepting comments", lines: ["Check the docket for how and when."] };
  }
  return { attend, comment };
}

// A hearing the public can speak at, as opposed to an evidentiary hearing where
// the parties present testimony. Judged from the label the source gives.
const PUBLIC_HEARING_RE = /public|comment|input|listening|town hall/i;
const PARTIES_ONLY_RE = /evidentiary|party session|siting committee|contested|prehearing|technical|settlement/i;
const isPublicHearing = (h: { label: string | null }) => !!h.label && PUBLIC_HEARING_RE.test(h.label) && !PARTIES_ONLY_RE.test(h.label);

const ruleFor = (p: AdvocacyProject): StateCommentRule | undefined => {
  const codes = splitStateCodes(p.state);
  return codes.length === 1 ? STATE_COMMENT_RULES[codes[0]] : undefined;
};

// How worth acting on a case is: a confirmed comment window is worth most, then
// a public hearing, then a "maybe". Closed or not-yet-open cases rank last.
function likelihood(acts: { attend: ActionRow; comment: ActionRow }): number {
  const c = acts.comment.ok === true ? 4 : acts.comment.ok === null ? (acts.comment.label.startsWith("Maybe") ? 2 : 1) : 0;
  const a = acts.attend.ok === true ? 3 : 0;
  return c + a;
}

// The date that makes a project urgent: the comment deadline or the next public hearing, whichever is first.
const soonestDate = (p: AdvocacyProject): string => [p.commentDeadline, p.hearings.find(isPublicHearing)?.date].filter(Boolean).sort()[0] ?? "9999";

export function ProjectAdvocacySection({ projects }: { projects: AdvocacyProject[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(
    () =>
      projects.map((p) => {
        const rule = ruleFor(p);
        const acts = actionsFor(p, rule);
        return { p, rule, acts, score: likelihood(acts) };
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
      return true;
    });
  }, [rows, query, state]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { comment: 0, hearing: 0, open: inScope.length };
    for (const r of inScope) {
      if (r.acts.comment.ok === true) c.comment++;
      if (r.acts.attend.ok === true) c.hearing++;
    }
    return c;
  }, [inScope]);

  const filtered = useMemo(() => {
    const list = inScope.filter((r) => filter === "open" || (filter === "comment" ? r.acts.comment.ok === true : r.acts.attend.ok === true));
    // Soonest first: cases with a comment deadline or public hearing date, in date
    // order, then the rest with the likeliest to take comments ahead, larger first.
    return [...list].sort((a, b) => {
      const da = soonestDate(a.p);
      const db = soonestDate(b.p);
      if (da !== db) return da.localeCompare(db);
      if (a.score !== b.score) return b.score - a.score;
      return (b.p.capacityValue ?? -1) - (a.p.capacityValue ?? -1);
    });
  }, [inScope, filter]);

  const reset = () => setVisible(PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)] max-w-2xl">
        Pick a project and see what you can do: attend a hearing, send a comment, or both. Cases most likely to be taking comments are listed first.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        {FILTERS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setFilter(o.value);
              reset();
            }}
            aria-pressed={filter === o.value}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === o.value
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
            }`}
          >
            {o.label} ({counts[o.value]})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
          placeholder="Search projects"
          aria-label="Search projects"
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
      </div>

      <div className="flex flex-col gap-3">
        {filtered.slice(0, visible).map(({ p, rule, acts }) => {
          const fuel = FUEL_TYPE_BY_VALUE[p.fuelType as keyof typeof FUEL_TYPE_BY_VALUE];
          const codes = splitStateCodes(p.state);
          const regulator = codes.length === 1 ? STATE_REGULATORS[codes[0]]?.[0] : undefined;
          return (
            <div key={p.slug} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/project/${p.slug}#take-action`} className="font-semibold text-sm hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {codes.map((c) => STATE_NAMES[c] ?? c).join(", ") || "Location not specified"} · {fuel?.label ?? p.fuelType}
                    {p.yearsWaiting != null && <> · Waiting {p.yearsWaiting.toFixed(1)} yrs</>}
                  </p>
                </div>
                {p.capacityValue != null && (
                  <span className="shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">
                    {formatCapacity(p.capacityValue, p.capacityUnit)}
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2.5 flex flex-col gap-2.5 text-xs">
                {(
                  [
                    ["Attend", acts.attend],
                    ["Comment", acts.comment],
                  ] as const
                ).map(([title, row]) => (
                  <div key={title} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className={`w-4 shrink-0 text-center font-bold ${row.ok ? "text-emerald-600 dark:text-emerald-400" : row.ok === false ? "text-[var(--muted)]" : "text-amber-600 dark:text-amber-400"}`}
                    >
                      {row.ok ? "✓" : row.ok === false ? "✕" : "?"}
                    </span>
                    <div className="min-w-0">
                      <div className={row.ok === false ? "text-[var(--muted)]" : "font-semibold"}>{row.label}</div>
                      {row.lines.map((l, i) => (
                        <div key={i} className="text-[var(--muted)]">
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

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
                  <a href={p.hearingLink} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                    Hearing details
                  </a>
                )}
                {regulator && (
                  <a href={regulator.contactUrl ?? regulator.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                    Contact regulator
                  </a>
                )}
                <Link href={`/project/${p.slug}#take-action`} className="text-[var(--muted)] underline">
                  Project page
                </Link>
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
