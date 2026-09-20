"use client";

import { useEffect, useState } from "react";
import { PredictorIcon } from "./PredictorIcon";
import { SaveProfilePrompt, shouldOfferSaveProfile } from "./SaveProfilePrompt";
import {
  DISCUSSION_CHANGED_EVENT,
  IDENTITY_CHANGED_EVENT,
  getOrCreatePredictorKey,
  getStoredNickname,
  storeNickname,
} from "@/lib/clientIdentity";

const MAX_WHY = 500;

function predictionKey(projectId: string): string {
  return `wfp_prediction_${projectId}`;
}

interface PredictionEntry {
  label: string;
  isAgent: boolean;
  predictedDate: string;
  submittedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Collapsed-by-default so the page doesn't read as long, but the closed
// state is a bold single CTA button rather than a quiet link. Two-step flow
// beyond that, deliberately in this order: (1) let someone predict
// immediately, no barrier at all; (2) only once that's done, offer to save
// it under an email so it survives a device change. Skipping step 2 costs
// nothing — the prediction already counts either way.
export function PredictCard({ projectId }: { projectId: string }) {
  const [predictorKey, setPredictorKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [predictedDate, setPredictedDate] = useState("");
  const [nickname, setNickname] = useState("");
  const [why, setWhy] = useState("");
  const [myPrediction, setMyPrediction] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // Deferred via setTimeout rather than called synchronously in the effect
  // body, to avoid a cascading-render lint error.
  useEffect(() => {
    const t = setTimeout(() => {
      setPredictorKey(getOrCreatePredictorKey());
      setNickname(getStoredNickname());
      const stored = localStorage.getItem(predictionKey(projectId));
      if (stored) setMyPrediction(stored);
    }, 0);

    fetch(`/api/predictions?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.predictions) setPredictions(data.predictions);
      })
      .catch(() => {
        // Non-critical — the predict form still works without the prediction list.
      });

    const syncName = () => setNickname((prev) => prev || getStoredNickname());
    window.addEventListener(IDENTITY_CHANGED_EVENT, syncName);

    return () => {
      clearTimeout(t);
      window.removeEventListener(IDENTITY_CHANGED_EVENT, syncName);
    };
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!predictorKey) return;
    if (!nickname.trim()) {
      setError("Enter a name so people know who predicted.");
      return;
    }
    if (!predictedDate) {
      setError("Pick a date.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          predictedDate,
          anonymousKey: predictorKey,
          displayName: nickname.trim(),
          why: why.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      localStorage.setItem(predictionKey(projectId), data.predictedDate);
      storeNickname(nickname.trim());
      setMyPrediction(data.predictedDate);
      // Only nag once, ever, per browser — not on every project someone
      // predicts on.
      if (shouldOfferSaveProfile(data.hasSavedProfile)) setShowSavePrompt(true);
      const label = nickname.trim();
      setPredictions((prev) =>
        [...prev.filter((p) => p.label !== label), { label, isAgent: false, predictedDate: data.predictedDate, submittedAt: new Date().toISOString() }].sort((a, b) =>
          a.predictedDate.localeCompare(b.predictedDate),
        ),
      );
      if (why.trim()) window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const open = expanded || myPrediction != null;

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
      {!open ? (
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <p className="text-sm font-semibold">Think you know when this project will be approved?</p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full sm:w-auto rounded-lg bg-[var(--accent)] text-white px-6 py-3 text-base font-semibold hover:opacity-90 transition-opacity"
          >
            🔮 Predict the approval date
          </button>
          <p className="text-xs text-[var(--muted)]">
            No sign-in needed{predictions.length > 0 && <> · {predictions.length} prediction{predictions.length === 1 ? "" : "s"} so far</>}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">Predict when this project is approved</h3>
            <span className="text-[10px] text-[var(--muted)]">No sign-in needed</span>
          </div>

          {myPrediction ? (
            <p className="text-sm mt-2">
              Your prediction: <strong>{formatDate(myPrediction)}</strong>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-2 flex items-end gap-2 flex-wrap">
              <div className="w-28">
                <label className="text-[10px] text-[var(--muted)] block mb-0.5">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={40}
                  autoFocus
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] text-[var(--muted)] block mb-0.5">Resolution date</label>
                <input
                  type="date"
                  value={predictedDate}
                  onChange={(e) => setPredictedDate(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                />
              </div>
              <div className="w-full">
                <label className="text-[10px] text-[var(--muted)] block mb-0.5">Why? (optional)</label>
                <textarea
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  maxLength={MAX_WHY}
                  rows={2}
                  placeholder="What makes you think so?"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-[var(--accent)] text-white px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "…" : "Submit"}
              </button>
              {error && <p className="text-xs text-red-600 dark:text-red-400 w-full">{error}</p>}
            </form>
          )}

          {showSavePrompt && predictorKey && <SaveProfilePrompt anonymousKey={predictorKey} />}

          {predictions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <p className="text-[10px] text-[var(--muted)] mb-1">
                {predictions.length} prediction{predictions.length === 1 ? "" : "s"} so far
              </p>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {predictions.map((p, i) => (
                  <div key={`${p.label}-${i}`} className="flex items-center gap-1.5 text-xs">
                    <PredictorIcon isAgent={p.isAgent} />
                    <span className="flex-1 truncate">{p.label}</span>
                    <span className="text-[var(--muted)] shrink-0">{formatDate(p.predictedDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
