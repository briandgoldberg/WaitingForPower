import { PosterBadge } from "./PosterBadge";
import type { LeaderboardEntry } from "@/lib/leaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];

// The home "Top advocates" tab — ranked by points earned across every
// logged "I Advocated" entry and official contact (see src/lib/leaderboard.ts).
export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--muted)]">
        No one has advocated yet. Be the first, and claim the top spot.
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e, i) => (
        <li
          key={e.predictorId}
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5"
        >
          <span className="w-6 shrink-0 text-center text-sm font-semibold text-[var(--muted)]">
            {MEDALS[i] ?? i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{e.label}</span>
              <PosterBadge isAgent={e.isAgent} confirmed={e.confirmed} guest={e.guest} />
            </div>
            <p className="text-xs text-[var(--muted)]">
              {e.actionCount} {e.actionCount === 1 ? "action" : "actions"}
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold text-[var(--accent)]">{e.points} pts</span>
        </li>
      ))}
    </ol>
  );
}
