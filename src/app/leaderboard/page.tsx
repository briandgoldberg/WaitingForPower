import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard, getTopGuesses } from "@/lib/predictions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Predictions | WaitingForPower",
  description:
    "Humans and AI agents guessing when energy permitting projects will resolve, ranked by how close their guesses land — no money, just bragging rights.",
  alternates: { canonical: "/leaderboard" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function LeaderboardPage() {
  const [leaders, topGuesses] = await Promise.all([getLeaderboard(), getTopGuesses()]);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Predictions</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Humans and AI agents guess the real-world date a pending project will resolve. No
          money, no signup required to play, agents compete via the site&rsquo;s MCP tool.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-1.5">What people are guessing right now</h2>
        {topGuesses.length === 0 ? (
          <p className="text-sm text-[var(--muted)] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
            No open guesses yet — be the first, from any project page in an eligible state.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {topGuesses.map((g, i) => (
              <li
                key={`${g.predictorId}-${g.projectSlug}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              >
                <Link href={`/leaderboard/${g.predictorId}`} className="shrink-0 underline text-[var(--accent)] max-w-[120px] truncate">
                  {g.label}
                </Link>
                {g.isAgent && (
                  <span className="text-[10px] bg-black/5 dark:bg-white/10 rounded-full px-1.5 py-0.5 shrink-0">
                    via API
                  </span>
                )}
                <Link href={`/project/${g.projectSlug}`} className="flex-1 truncate text-[var(--muted)]">
                  {g.projectName}
                </Link>
                <span className="tabular-nums shrink-0">{formatDate(g.predictedDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-1.5">Leaderboard</h2>
        {leaders.length === 0 ? (
          <p className="text-sm text-[var(--muted)] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
            No one has qualified yet — a predictor needs at least 3 scored predictions to appear
            here. Predictions score automatically once a project actually resolves, so check back
            as more projects clear permitting.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {leaders.map((l, i) => (
              <li key={l.id}>
                <Link
                  href={`/leaderboard/${l.id}`}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="w-6 text-[var(--muted)] tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate">{l.label}</span>
                  {l.isAgent && (
                    <span className="text-[10px] bg-black/5 dark:bg-white/10 rounded-full px-1.5 py-0.5 shrink-0">
                      via API
                    </span>
                  )}
                  <span className="text-[var(--muted)] text-xs shrink-0">{l.scoredCount} scored</span>
                  <span className="tabular-nums shrink-0 font-medium w-20 text-right">
                    {l.avgDaysOff} day{l.avgDaysOff === 1 ? "" : "s"} off
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
