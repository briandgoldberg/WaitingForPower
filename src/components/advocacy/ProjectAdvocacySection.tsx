"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { STATE_COMMENT_RULES, type StateCommentRule } from "@/lib/data/stateCommentRules";

const PAGE_SIZE = 20;

// Four exclusive views: the first is every project on this page (all of them
// are, literally, awaiting a decision); the other three partition the rest by
// comment likelihood, so a project appears under exactly one of them, never
// more than one. Results are always shown largest project first (MW).
const SHORT_LIKELIHOOD_LABELS = ["All", "Unlikely", "Maybe", "Confirmed"] as const;

const LIKELIHOOD_LEVELS = [
  { label: "Every project awaiting a decision" },
  { label: "Comments unlikely to be accepted" },
  { label: "Comments possibly open, not confirmed" },
  { label: "Comments confirmed open" },
] as const;

// Which commentLikelihood score each button (after "All") shows: exactly one
// score per button, so a project is never shown under more than one.
const BUCKET_SCORE = [null, 0, 2, 3] as const;

function matchesBucket(button: number, score: number): boolean {
  const want = BUCKET_SCORE[button];
  return want === null || score === want;
}

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

interface ActionRow {
  ok: boolean | null;
  label: string;
  lines: string[];
}

// What a resident can do on this project, stated as actions: whether they can
// attend and speak, and whether they can send a comment. `ok: null` means we
// cannot tell (shown as "maybe"). `attend` is null when there is nothing to
// show at all (no public hearing) rather than a row saying so.
function actionsFor(p: AdvocacyProject, rule: StateCommentRule | undefined): { attend: ActionRow | null; comment: ActionRow } {
  const pub = p.hearings.filter(isPublicHearing);
  const closedRule = rule?.recordRule === "closes_at_hearing";
  const openRule = rule?.recordRule === "open_until_decision";
  const decisionNext = p.reviewStep === "Awaiting commission order";

  // Hearings closed to the public (evidentiary, parties only) stay off this
  // page entirely; they're still on the project's own page.
  const attend: ActionRow | null =
    pub.length > 0
      ? { ok: true, label: "Attend and speak", lines: pub.map((h) => `${fmtShort(h.date)} · ${h.label ?? "Public hearing"}${h.location ? " · " + h.location : ""}`) }
      : null;

  // Being past the hearing (decisionNext) says only that the hearing is
  // over, not whether comments are still accepted — so it only counts here
  // when the state's own rule confirms an answer either way. Everywhere else
  // (including a decision-pending case in an unconfirmed state) falls through
  // to "maybe": we genuinely don't know, not "probably closed".
  let comment: ActionRow;
  const how = rule?.howToComment ? [rule.howToComment] : [];
  if (p.commentDeadline) {
    comment = { ok: true, label: `Send a comment by ${fmtShort(p.commentDeadline)}`, lines: how };
  } else if (decisionNext && closedRule) {
    comment = { ok: false, label: "Comments are closed", lines: ["This state closes the record at the hearing. You can still write to the commission."] };
  } else if (decisionNext && openRule) {
    comment = { ok: true, label: "Send a comment before the decision", lines: how };
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

// 0 = confirmed closed (unlikely), 2 = genuinely unknown (maybe), 3 = confirmed
// open. 1 is reserved for the "Unlikely" bucket label but nothing separate
// scores into it: confirmed-closed is the whole of that bucket.
function commentLikelihood(acts: { comment: ActionRow }): number {
  if (acts.comment.ok === true) return 3;
  if (acts.comment.ok === null) return 2;
  return 0;
}

export function ProjectAdvocacySection({ projects, initialBucket = 0 }: { projects: AdvocacyProject[]; initialBucket?: number }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [bucket, setBucket] = useState(initialBucket);
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
    const list = inScope.filter((r) => matchesBucket(bucket, r.score));
    // Always largest project first, regardless of likelihood or date.
    return [...list].sort((a, b) => (b.p.capacityValue ?? -1) - (a.p.capacityValue ?? -1));
  }, [inScope, bucket]);

  const reset = () => setVisible(PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 max-w-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Likelihood of accepting comments</span>
          <span className="text-[var(--muted)]">{filtered.length} projects</span>
        </div>
        <div className="relative grid grid-cols-4 rounded-full bg-black/5 dark:bg-white/10 p-1" role="radiogroup" aria-label="Likelihood of accepting comments">
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
              className={`relative z-10 rounded-full py-1.5 text-[11px] sm:text-xs font-medium transition-colors ${
                bucket === i ? "text-white" : "text-[var(--text-secondary)]"
              }`}
            >
              {SHORT_LIKELIHOOD_LABELS[i]}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--muted)]">{LIKELIHOOD_LEVELS[bucket].label}</span>
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
                {acts.attend && (
                  <div className="flex gap-2.5">
                    <span aria-hidden className="w-4 shrink-0 text-center">
                      📅
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">{acts.attend.label}</div>
                      {acts.attend.lines.map((l, i) => (
                        <div key={i} className="text-[var(--muted)]">
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2.5">
                  <span
                    aria-hidden
                    className={`w-4 shrink-0 text-center font-bold ${acts.comment.ok ? "text-emerald-600 dark:text-emerald-400" : acts.comment.ok === false ? "text-[var(--muted)]" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    {acts.comment.ok ? "✓" : acts.comment.ok === false ? "✕" : "?"}
                  </span>
                  <div className="min-w-0">
                    <div className={acts.comment.ok === false ? "text-[var(--muted)]" : "font-semibold"}>{acts.comment.label}</div>
                    {acts.comment.lines.map((l, i) => (
                      <div key={i} className="text-[var(--muted)]">
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
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
