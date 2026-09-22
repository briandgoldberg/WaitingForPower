"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectChangeDTO } from "@/lib/types";
import { FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { stateName } from "@/lib/data/usStates";
import { relativeTime, groupByDate } from "@/lib/feedTime";
import { ruleForState, commentScore, commentStatusText } from "@/lib/advocacyActions";

// Bundled changeTypes are shown as one card — this picks which single
// badge/color represents the whole bundle when more than one fired in the
// same run (e.g. ["resolved", "fact_revised"]). Order is priority, most
// newsworthy first; `summary` (already pre-rendered server-side, see
// buildChangeSummary in common.ts) still carries every detail regardless of
// which badge wins.
const BADGE_PRIORITY = ["resolved", "new", "no_longer_reported", "reappeared", "advanced", "fact_revised", "new_filing"] as const;

type Badge = { label: string; className: string };

function badgeFor(changeTypes: string[], newStage: string | null): Badge {
  const primary = BADGE_PRIORITY.find((t) => changeTypes.includes(t)) ?? changeTypes[0];
  switch (primary) {
    case "resolved":
      if (newStage === "cancelled") return { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" };
      if (newStage === "completed") return { label: "Complete", className: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" };
      return { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" };
    case "new":
      return { label: "New", className: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" };
    case "no_longer_reported":
      return { label: "No Longer Reported", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" };
    case "reappeared":
      return { label: "Reappeared", className: "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300" };
    case "advanced":
      return { label: "Stage Update", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300" };
    case "new_filing":
      return { label: "New Filing", className: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300" };
    case "fact_revised":
      return { label: "Capacity Update", className: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300" };
    default:
      return { label: "Updated", className: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300" };
  }
}

function ChangeCard({ change, nowMs }: { change: ProjectChangeDTO; nowMs: number }) {
  const badge = badgeFor(change.changeTypes, change.newStage);
  const fuel = FUEL_TYPE_BY_VALUE[change.project.fuelType];
  // A resolved project (approved/cancelled/complete) is no longer awaiting a
  // decision, so it never gets an "advocate for this" line — checked against
  // the project's actual current stage (change.project.resolved), not just
  // whether this particular change bundle happened to be the one that
  // resolved it; a later, unrelated change on an already-resolved project
  // (e.g. a capacity correction) must still hide the line. Otherwise, same
  // scoring the Advocate > Projects tab uses (see src/lib/advocacyActions.ts)
  // — only "Maybe" and "Accepting" are worth surfacing here; "Unlikely" is
  // left off entirely rather than told to a reader as a reason not to bother.
  const score = change.project.resolved
    ? -1
    : commentScore(
        { commentDeadline: change.project.commentDeadline, reviewStep: change.project.reviewStep, hearingCount: change.project.hearingCount },
        ruleForState(change.project.state),
      );
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 hover:border-[var(--accent)] transition-colors">
      <Link href={`/project/${change.project.slug}`} className="flex gap-3">
        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: fuel?.color ?? "#6b7280" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-sm truncate min-w-0 flex-1">{change.project.name}</span>
            <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">{change.summary}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] mt-1.5">
            {change.project.state && <span>{stateName(change.project.state)}</span>}
            <span aria-hidden>·</span>
            <span>{fuel?.label ?? change.project.fuelType}</span>
            <span aria-hidden>·</span>
            <span>{formatCapacity(change.project.capacityValue, change.project.capacityUnit)}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(change.createdAt, nowMs)}</span>
          </div>
        </div>
      </Link>
      {score >= 2 && (
        <p className="text-xs mt-1.5 pl-[22px]">
          <span className={score === 3 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
            {commentStatusText(score, change.project.commentDeadline)}
          </span>{" "}
          <Link href={`/project/${change.project.slug}#take-action`} className="text-[var(--accent)] underline">
            Advocate for project
          </Link>
        </p>
      )}
    </div>
  );
}

// Client-side "Load more" pagination — starts with the server-rendered
// first page (fast first paint, real SSR content for crawlers/agents), then
// pages further back through the full change history via /api/changes as
// requested rather than ever loading it all up front. This is the site's
// full chronological history, not a 1-day/N-day window — the only limit is
// page size.
export function ChangesFeed({
  initialChanges,
  initialHasMore,
  now,
  state,
}: {
  initialChanges: ProjectChangeDTO[];
  initialHasMore: boolean;
  // ISO timestamp captured once by the server component that renders this
  // (see src/app/page.tsx) at the same moment it fetched `initialChanges`.
  // Used as-is for this component's first render on both the server and
  // the client (via useState's lazy initializer, which only runs once) so
  // "Today"/"Yesterday" grouping and "Xh ago" text are identical between
  // the SSR HTML and the client's hydration pass — computing `Date.now()`
  // separately in each would drift (server is UTC; a visitor's browser
  // usually isn't) and trip a React hydration-mismatch error. A page left
  // open for a long time will show a "now" that's stuck at load time, same
  // tradeoff every SSR site with relative timestamps makes.
  now: string;
  // Current state filter (see src/components/StateFeedFilter.tsx) — threaded
  // into "Load more" so paging further back stays scoped to the same filter
  // the server-rendered first page already applied.
  state: string | null;
}) {
  const [changes, setChanges] = useState(initialChanges);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nowDate] = useState(() => new Date(now));

  async function loadMore() {
    setLoading(true);
    setError(false);
    try {
      const stateQuery = state ? `&state=${state}` : "";
      const res = await fetch(`/api/changes?offset=${changes.length}${stateQuery}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { changes: ProjectChangeDTO[]; hasMore: boolean } = await res.json();
      setChanges((prev) => [...prev, ...data.changes]);
      setHasMore(data.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (changes.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--muted)]">
        No changes detected yet — check back after the next round of source checks.
      </div>
    );
  }

  const groups = groupByDate(changes, nowDate);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{group.label}</h3>
          {group.items.map((c) => (
            <ChangeCard key={c.id} change={c} nowMs={nowDate.getTime()} />
          ))}
        </div>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-2 text-sm font-medium px-3 py-2 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center">
          Couldn&rsquo;t load more — try again.
        </p>
      )}
    </div>
  );
}
