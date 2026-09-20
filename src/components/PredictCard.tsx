"use client";

import { useEffect, useState } from "react";
import { PredictorIcon } from "./PredictorIcon";
import { SaveProfilePrompt, shouldOfferSaveProfile } from "./SaveProfilePrompt";
import { SignInLink } from "./SignInLink";
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

// A slim one-line prompt that opens into a single compact row. Two-step flow
// beyond that, deliberately in this order: (1) let someone predict
// immediately, no barrier at all; (2) only once that's done, offer to save
// it under an email so it survives a device change. Skipping step 2 costs
// nothing; the prediction already counts either way.
//
// The name is asked for once. After that it is locked to this profile (the
// server ignores later name changes), so it shows as read-only text.
export function PredictCard({ projectId }: { projectId: string }) {
  const [predictorKey, setPredictorKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [predictedDate, setPredictedDate] = useState("");
  const [lockedName, setLockedName] = useState("");
  const [typedName, setTypedName] = useState("");
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
      setLockedName(getStoredNickname());
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

    const syncName = () => setLockedName(getStoredNickname());
    window.addEventListener(IDENTITY_CHANGED_EVENT, syncName);

    return () => {
      clearTimeout(t);
      window.removeEventListener(IDENTITY_CHANGED_EVENT, syncName);
    };
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!predictorKey) return;
    const name = lockedName || typedName.trim();
    if (!name) {
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
          displayName: name,
          why: why.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const finalName: string = data.displayName ?? name;
      localStorage.setItem(predictionKey(projectId), data.predictedDate);
      storeNickname(finalName);
      setMyPrediction(data.predictedDate);
      // Only nag once, ever, per browser, not on every project someone
      // predicts on.
      if (shouldOfferSaveProfile(data.hasSavedProfile)) setShowSavePrompt(true);
      setPredictions((prev) =>
        [...prev.filter((p) => p.label !== finalName), { label: finalName, isAgent: false, predictedDate: data.predictedDate, submittedAt: new Date().toISOString() }].sort((a, b) =>
          a.predictedDate.localeCompare(b.predictedDate),
        ),
      );
      window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // A signed-in profile on a new device has no local record of predicting, so
  // also find it in the server's list by its (unique, locked) name.
  const mineOnServer = lockedName ? predictions.find((p) => !p.isAgent && p.label === lockedName)?.predictedDate ?? null : null;
  const shownPrediction = myPrediction ?? mineOnServer;
  const open = expanded || shownPrediction != null;
  const countText = predictions.length > 0 ? `${predictions.length} prediction${predictions.length === 1 ? "" : "s"}` : null;

  return (
    <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2.5">
      {!open ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm">
            <span className="font-semibold">🔮 When will this be approved?</span>
            {countText && <span className="text-xs text-[var(--muted)]"> · {countText}</span>}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md bg-[var(--accent)] text-white px-3.5 py-1.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Predict
          </button>
        </div>
      ) : shownPrediction ? (
        <p className="text-sm">
          🔮 Your prediction: <strong>{formatDate(shownPrediction)}</strong>
          {countText && <span className="text-xs text-[var(--muted)]"> · {countText}</span>}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold shrink-0">🔮 Predict the date</span>
            {lockedName ? (
              <span className="text-xs text-[var(--muted)] shrink-0">
                as <strong className="text-[var(--foreground)]">{lockedName}</strong>
              </span>
            ) : (
              <input
                type="text"
                placeholder="Your name"
                aria-label="Your name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                maxLength={40}
                autoFocus
                className="w-28 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
              />
            )}
            <input
              type="date"
              aria-label="Predicted approval date"
              value={predictedDate}
              onChange={(e) => setPredictedDate(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[var(--accent)] text-white px-3.5 py-1 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "…" : "Submit"}
            </button>
          </div>
          <input
            type="text"
            aria-label="Why (optional)"
            placeholder="Why? (optional)"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            maxLength={MAX_WHY}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {!lockedName && <SignInLink />}
        </form>
      )}

      {showSavePrompt && predictorKey && <SaveProfilePrompt anonymousKey={predictorKey} />}

      {open && predictions.length > 0 && (
        <details className="mt-1.5 text-xs">
          <summary className="cursor-pointer text-[var(--muted)]">See all {countText}</summary>
          <div className="flex flex-col gap-1 mt-1 max-h-24 overflow-y-auto">
            {predictions.map((p, i) => (
              <div key={`${p.label}-${i}`} className="flex items-center gap-1.5">
                <PredictorIcon isAgent={p.isAgent} />
                <span className="flex-1 truncate">{p.label}</span>
                <span className="text-[var(--muted)] shrink-0">{formatDate(p.predictedDate)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
