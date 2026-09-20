"use client";

import { useCallback, useEffect, useState } from "react";
import { DISCUSSION_CHANGED_EVENT, OPEN_PREDICTION_EVENT, getOrCreatePredictorKey } from "@/lib/clientIdentity";
import type { Discussion } from "@/lib/community";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The slim prediction prompt in Take action. Predicting happens in the
// discussion composer at the bottom of the page (one place for everything
// people post); this shows where the crowd stands and takes you there.
export function PredictCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Discussion | null>(null);

  const load = useCallback(() => {
    const key = getOrCreatePredictorKey();
    fetch(`/api/comments?projectId=${encodeURIComponent(projectId)}`, { headers: { "x-anonymous-key": key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Discussion | null) => {
        if (d?.summary) setData(d);
      })
      .catch(() => {
        // Non-critical: the prompt still works without the counts.
      });
  }, [projectId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    window.addEventListener(DISCUSSION_CHANGED_EVENT, load);
    return () => {
      clearTimeout(t);
      window.removeEventListener(DISCUSSION_CHANGED_EVENT, load);
    };
  }, [load]);

  const summary = data?.summary;
  const mine = data?.myPredictedDate ?? null;

  function goToDiscussion(openPrediction: boolean) {
    document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (openPrediction) window.dispatchEvent(new Event(OPEN_PREDICTION_EVENT));
  }

  return (
    <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm">
        {mine ? (
          <>
            <span className="font-semibold">🔮 Your prediction:</span> <strong>{formatDate(mine)}</strong>
          </>
        ) : (
          <span className="font-semibold">🔮 When will this be approved?</span>
        )}
        {summary && summary.predictionCount > 0 && summary.medianDate && (
          <span className="text-xs text-[var(--muted)]">
            {" "}
            · {summary.predictionCount} prediction{summary.predictionCount === 1 ? "" : "s"}, median {formatDate(summary.medianDate)}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => goToDiscussion(!mine)}
        className="rounded-md bg-[var(--accent)] text-white px-3.5 py-1.5 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        {mine ? "See discussion" : "Predict"}
      </button>
    </div>
  );
}
