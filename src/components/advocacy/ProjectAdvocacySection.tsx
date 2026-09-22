"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { STATE_COMMENT_RULES, type StateCommentRule } from "@/lib/data/stateCommentRules";

const PAGE_SIZE = 20;

// How likely a project is to still be accepting comments, least to most
// likely. The slider filters to this tier or higher; results are always
// shown largest project first (MW), not by likelihood or date.
const LIKELIHOOD_LEVELS = [
  { min: 0, label: "Any status" },
  { min: 1, label: "Not confirmed closed" },
  { min: 2, label: "Possibly or confirmed open" },
  { min: 3, label: "Confirmed open only" },
] as const;

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

// "Possibly open" means we genuinely don't know either way, as opposed to a
// hearing having already probably closed the record.
const isMaybeOpen = (acts: { comment: ActionRow }) => acts.comment.ok === null && acts.comment.label.startsWith("Maybe");

// 0 = confirmed closed, 1 = probably closed, 2 = possibly open, 3 = confirmed open.
function commentLikelihood(acts: { comment: ActionRow }): number {
  if (acts.comment.ok === true) return 3;
  if (isMaybeOpen(acts)) return 2;
  if (acts.comment.ok === null) return 1;
  return 0;
}

export function ProjectAdvocacySection({ projects }: { projects: AdvocacyProject[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [minLikelihood, setMinLikelihood] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(
    () =>
      projects.map((p) => {
        const rule = ruleFor(p);
        const acts = actionsFor(p, rule);
        return { p, rule, acts, score: commentLikelihood(acts) };
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

  const filtered = useMemo(() => {
    const list = inScope.filter((r) => r.score >= minLikelihood);
    // Always largest project first, regardless of likelihood or date.
    return [...list].sort((a, b) => (b.p.capacityValue ?? -1) - (a.p.capacityValue ?? -1));
  }, [inScope, minLikelihood]);

  const reset = () => setVisible(PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)] max-w-2xl">
        Projects awaiting a decision from state or federal regulators, largest first.
      </p>

      <div className="flex flex-col gap-1.5 max-w-sm">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="likelihood" className="font-medium">
            Likelihood of accepting comments
          </label>
          <span className="text-[var(--muted)]">{filtered.length} projects</span>
        </div>
        <input
          id="likelihood"
          type="range"
          min={0}
          max={LIKELIHOOD_LEVELS.length - 1}
          step={1}
          value={minLikelihood}
          onChange={(e) => {
            setMinLikelihood(Number(e.target.value));
            reset();
          }}
          className="w-full accent-[var(--accent)]"
        />
        <span className="text-xs text-[var(--muted)]">{LIKELIHOOD_LEVELS[minLikelihood].label}</span>
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
                  <a href={p.hearingLink} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
                    Hearing details
                  </a>
                )}
                {regulator && (
                  <a href={regulator.contactUrl ?? regulator.website} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
                    Contact regulator
                  </a>
                )}
                <Link href={`/project/${p.slug}#take-action`} className="font-semibold text-[var(--accent)] underline">
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
