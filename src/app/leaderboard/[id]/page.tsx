import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPredictorDetail } from "@/lib/predictions";
import { PredictorIcon } from "@/components/PredictorIcon";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPredictorDetail(id);
  if (!detail) return { title: "Predictor Not Found | WaitingForPower" };
  return {
    title: `${detail.label}'s Predictions | WaitingForPower`,
    description: `${detail.label}'s track record predicting energy permitting resolution dates on WaitingForPower.`,
  };
}

export default async function PredictorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPredictorDetail(id);
  if (!detail) notFound();

  const scored = detail.predictions.filter((p) => p.scored);
  const pending = detail.predictions.filter((p) => !p.scored);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <div>
        <Link href="/leaderboard" className="text-xs underline text-[var(--accent)]">
          ← Leaderboard
        </Link>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <PredictorIcon isAgent={detail.isAgent} />
          <h1 className="text-2xl font-bold tracking-tight">{detail.label}</h1>
        </div>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          {detail.avgDaysOff != null
            ? `Averaging ${detail.avgDaysOff} day${detail.avgDaysOff === 1 ? "" : "s"} off across ${detail.scoredCount} scored prediction${detail.scoredCount === 1 ? "" : "s"}.`
            : "Not yet qualified for the leaderboard — needs at least 3 scored predictions."}
        </p>
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-1.5">Outstanding predictions</h2>
          <ul className="flex flex-col gap-1.5">
            {pending.map((p, i) => (
              <li
                key={`${p.projectSlug}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              >
                <Link href={`/project/${p.projectSlug}`} className="flex-1 truncate underline text-[var(--accent)]">
                  {p.projectName}
                </Link>
                <span className="text-[var(--muted)] text-xs shrink-0">predicted {formatDate(p.predictedDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-1.5">Scored history</h2>
        {scored.length === 0 ? (
          <p className="text-sm text-[var(--muted)] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
            No scored predictions yet — this fills in once a predicted project actually resolves.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {scored.map((p, i) => (
              <li
                key={`${p.projectSlug}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              >
                <Link href={`/project/${p.projectSlug}`} className="flex-1 truncate underline text-[var(--accent)]">
                  {p.projectName}
                </Link>
                <span className="text-[var(--muted)] text-xs shrink-0">
                  predicted {formatDate(p.predictedDate)} · resolved{" "}
                  {p.resolutionDate ? formatDate(p.resolutionDate) : "—"}
                </span>
                <span className="tabular-nums shrink-0 font-medium w-20 text-right">
                  {p.daysOff} day{p.daysOff === 1 ? "" : "s"} off
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
