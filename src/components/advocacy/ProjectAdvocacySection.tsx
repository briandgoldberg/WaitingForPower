"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { STATE_COMMENT_RULES } from "@/lib/data/stateCommentRules";

const PAGE_SIZE = 20;

type Phase = "comment" | "hearing" | "decision" | "waiting";

const PHASES: { value: Phase | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "comment", label: "Comments open" },
  { value: "hearing", label: "Hearing coming up" },
  { value: "decision", label: "Decision next" },
  { value: "waiting", label: "Case open" },
];

const PILL: Record<Phase, string> = {
  comment: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  hearing: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  decision: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  waiting: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10",
};

function adviceFor(ph: Phase, howToComment: string | null, rule: string | null, deadlineOnly = false): string {
  const how = howToComment ? " " + howToComment : "";
  if (ph === "comment") return (deadlineOnly ? "Send your comment by the deadline." : "Speak at the public hearing, or send a comment before it.") + how;
  if (ph === "hearing") return "This hearing is for the parties, so the public usually cannot testify. You can still send a comment for the record." + how;
  if (ph === "decision") {
    if (rule === "closes_at_hearing") return "The hearing is over and this state closes the record at the hearing, so formal comments are closed. You can still write to the commission and your legislators.";
    if (rule === "open_until_decision") return "This state accepts public comments until the commission decides." + how;
    return "The hearing is over, so the formal comment period has usually closed. You can still write to the commission and your legislators.";
  }
  if (rule === "closes_at_hearing") return "No hearing is scheduled that we know of. This state closes the record at the hearing, so comment before it is held." + how;
  return "No hearing is scheduled that we know of. Many commissions accept comments while a case is open." + (how || " Check the docket.");
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// A hearing the public can speak at, as opposed to an evidentiary hearing where
// the parties present testimony. Judged from the label the source gives.
const PUBLIC_HEARING_RE = /public|comment|input|listening|town hall/i;
const PARTIES_ONLY_RE = /evidentiary|party session|siting committee|contested|prehearing|technical|settlement/i;
const isPublicHearing = (h: { label: string | null }) => !!h.label && PUBLIC_HEARING_RE.test(h.label) && !PARTIES_ONLY_RE.test(h.label);

function phaseOf(p: AdvocacyProject): Phase {
  if (p.commentDeadline || p.hearings.some(isPublicHearing)) return "comment";
  if (p.hearings.length > 0 || p.reviewStep === "Hearing scheduled") return "hearing";
  if (p.reviewStep === "Awaiting commission order") return "decision";
  return "waiting";
}

const ORDER: Record<Phase, number> = { comment: 0, hearing: 1, decision: 2, waiting: 3 };

// The date that makes a project urgent: the comment deadline or the next hearing, whichever is first.
const soonestDate = (p: AdvocacyProject): string =>
  [p.commentDeadline, p.hearings.find(isPublicHearing)?.date ?? p.hearings[0]?.date].filter(Boolean).sort()[0] ?? "9999";

type Sort = "soonest" | "largest" | "longest";

export function ProjectAdvocacySection({ projects }: { projects: AdvocacyProject[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [phase, setPhase] = useState<Phase | "all">("all");
  const [sort, setSort] = useState<Sort>("soonest");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(() => projects.map((p) => ({ p, phase: phaseOf(p) })), [projects]);

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
    const c: Record<string, number> = { all: inScope.length, comment: 0, hearing: 0, decision: 0, waiting: 0 };
    for (const r of inScope) c[r.phase]++;
    return c;
  }, [inScope]);

  const filtered = useMemo(() => {
    const list = inScope.filter((r) => phase === "all" || r.phase === phase);
    return [...list].sort((a, b) => {
      if (sort === "largest") return (b.p.capacityValue ?? -1) - (a.p.capacityValue ?? -1);
      if (sort === "longest") return (b.p.yearsWaiting ?? -1) - (a.p.yearsWaiting ?? -1);
      if (a.phase !== b.phase) return ORDER[a.phase] - ORDER[b.phase];
      if (a.phase === "comment" || a.phase === "hearing") {
        // Dated items first, soonest at the top; a hearing with no date yet goes after them.
        const da = soonestDate(a.p);
        const db = soonestDate(b.p);
        if (da !== db) return da.localeCompare(db);
      }
      return (b.p.capacityValue ?? -1) - (a.p.capacityValue ?? -1);
    });
  }, [inScope, phase, sort]);

  const reset = () => setVisible(PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)] max-w-2xl">
        Pick a project, see when to act, and go straight to the docket or the regulator. Hearings and decisions coming up are listed first. We cannot always see comment deadlines, so check the docket.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {PHASES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setPhase(o.value);
              reset();
            }}
            aria-pressed={phase === o.value}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              phase === o.value
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
            }`}
          >
            {o.label} ({counts[o.value] ?? 0})
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort"
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="soonest">Soonest first</option>
          <option value="largest">Largest first</option>
          <option value="longest">Waiting longest</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.slice(0, visible).map(({ p, phase: ph }) => {
          const fuel = FUEL_TYPE_BY_VALUE[p.fuelType as keyof typeof FUEL_TYPE_BY_VALUE];
          const codes = splitStateCodes(p.state);
          const regulator = codes.length === 1 ? STATE_REGULATORS[codes[0]]?.[0] : undefined;
          const publicNext = p.hearings.find(isPublicHearing);
          const next = ph === "comment" ? publicNext : p.hearings[0];
          const others = p.hearings.filter((h) => h !== next);
          const rule = codes.length === 1 ? STATE_COMMENT_RULES[codes[0]] : undefined;
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

              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${PILL[ph]}`}>
                    {ph === "comment" ? (p.commentDeadline ? `Comments due ${fmtDay(p.commentDeadline)}` : publicNext ? `Speak ${fmtDay(publicNext.date)}` : "Comments open") : ph === "hearing" ? (next ? `Hearing ${fmtDay(next.date)}` : "Hearing set") : ph === "decision" ? "Decision next" : "Case open"}
                  </span>
                  {next?.label && <span className="text-[var(--muted)]">{next.label}</span>}
                  {ph === "hearing" && next?.label && !isPublicHearing(next) && <span className="text-[var(--muted)]">(parties only)</span>}
                  {others.length > 0 && (
                    <span className="text-[var(--muted)]">+{others.length} more date{others.length > 1 ? "s" : ""}</span>
                  )}
                  {ph === "decision" && p.reviewStepAt && <span className="text-[var(--muted)]">since {fmtDay(p.reviewStepAt)}</span>}
                </div>
                {(ph === "hearing" || ph === "comment") && next?.location && <p className="text-xs text-[var(--muted)]">Where: {next.location}</p>}
                <p className="text-xs text-[var(--text-secondary)]">{adviceFor(ph, rule?.howToComment || null, rule && rule.recordRule !== "unknown" ? rule.recordRule : null, !!p.commentDeadline && !publicNext)}</p>
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
