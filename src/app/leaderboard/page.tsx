import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { getLeaderboard, getTopPredictions } from "@/lib/predictions";
import { PredictorIcon } from "@/components/PredictorIcon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Predictions | WaitingForPower",
  description:
    "Humans and AI agents predicting when energy permitting projects will resolve, ranked by how close their predictions land — no money, just bragging rights.",
  alternates: { canonical: "/leaderboard" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function LeaderboardPage() {
  const [leaders, topPredictions] = await Promise.all([getLeaderboard(), getTopPredictions()]);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div>
        <p className="text-xs text-[var(--muted)] mb-1.5">People predicting when projects will be approved</p>
        {topPredictions.length === 0 ? (
          <p className="text-sm text-[var(--muted)] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
            No open predictions yet — be the first, from any project page in an eligible state.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {topPredictions.map((p, i) => (
              <Fragment key={`${p.predictorId}-${p.projectSlug}-${i}`}>
                <li className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm">
                  <PredictorIcon isAgent={p.isAgent} />
                  <Link href={`/leaderboard/${p.predictorId}`} className="shrink-0 underline text-[var(--accent)] max-w-[120px] truncate">
                    {p.label}
                  </Link>
                  <Link href={`/project/${p.projectSlug}`} className="flex-1 truncate text-[var(--muted)]">
                    {p.projectName}
                  </Link>
                  <span className="tabular-nums shrink-0">{formatDate(p.predictedDate)}</span>
                </li>
                {p.moreCount > 0 && (
                  <li>
                    <Link
                      href={`/leaderboard/${p.predictorId}`}
                      className="block rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)] underline"
                    >
                      {p.moreCount.toLocaleString()} more prediction{p.moreCount === 1 ? "" : "s"} from {p.label}
                    </Link>
                  </li>
                )}
              </Fragment>
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
                  <PredictorIcon isAgent={l.isAgent} />
                  <span className="flex-1 truncate">{l.label}</span>
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
