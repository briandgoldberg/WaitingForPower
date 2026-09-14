"use client";

import { useEffect, useState } from "react";

// Zero-friction identity, same pattern as this site's other no-login
// features (the old GreenlightVote's voterKey): a random id the browser
// generates once and keeps in localStorage. Never a login — only ever
// upgraded to a real email if the person opts into "save my profile"
// after they've already predicted (see the two-step flow below).
function getOrCreatePredictorKey(): string {
  const key = "wfp_predictor_key";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function predictionKey(projectId: string): string {
  return `wfp_prediction_${projectId}`;
}

interface Guess {
  label: string;
  isAgent: boolean;
  predictedDate: string;
  submittedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Two-step flow, deliberately in this order: (1) let someone predict
// immediately, no barrier at all — the whole point is to get a real
// commitment locked in before ever asking for anything; (2) only once
// that's done, offer to save it under an email so it survives a device
// change instead of living only in this browser's localStorage. Skipping
// step 2 costs nothing — the prediction already counts either way.
export function PredictCard({ projectId }: { projectId: string }) {
  const [predictorKey, setPredictorKey] = useState<string | null>(null);
  const [predictedDate, setPredictedDate] = useState("");
  const [nickname, setNickname] = useState("");
  const [myPrediction, setMyPrediction] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveEmail, setSaveEmail] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Deferred via setTimeout rather than called synchronously in the effect
  // body, to avoid a cascading-render lint error — same pattern the old
  // GreenlightVote widget used for the same reason.
  useEffect(() => {
    const t = setTimeout(() => {
      setPredictorKey(getOrCreatePredictorKey());
      setNickname(localStorage.getItem("wfp_predictor_nickname") ?? "");
      const stored = localStorage.getItem(predictionKey(projectId));
      if (stored) setMyPrediction(stored);
    }, 0);

    fetch(`/api/predictions?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.guesses) setGuesses(data.guesses);
      })
      .catch(() => {
        // Non-critical — the predict form still works without the guess list.
      });

    return () => clearTimeout(t);
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!predictedDate || !predictorKey) {
      setError("Pick a date first.");
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
          displayName: nickname || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      localStorage.setItem(predictionKey(projectId), data.predictedDate);
      if (nickname) localStorage.setItem("wfp_predictor_nickname", nickname);
      setMyPrediction(data.predictedDate);
      // Only nag once, ever, per browser — not on every project someone
      // predicts on.
      if (!data.hasSavedProfile && !localStorage.getItem("wfp_predictor_email_sent")) {
        setShowSavePrompt(true);
      }
      setGuesses((prev) => [...prev.filter((g) => g.label !== (nickname || "anonymous")), { label: nickname || "anonymous", isAgent: false, predictedDate: data.predictedDate, submittedAt: new Date().toISOString() }].sort((a, b) => a.predictedDate.localeCompare(b.predictedDate)));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!predictorKey || !saveEmail) return;
    setSaveStatus("sending");
    try {
      const res = await fetch("/api/predictions/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey: predictorKey, email: saveEmail }),
      });
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      localStorage.setItem("wfp_predictor_email_sent", "1");
      setSaveStatus("sent");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-semibold">Predict when this resolves</h2>
        <span className="text-xs bg-black/5 dark:bg-white/10 rounded-full px-2.5 py-0.5">
          No sign-in needed
        </span>
      </div>

      {myPrediction ? (
        <p className="text-sm mt-2">
          Your guess: <strong>{formatDate(myPrediction)}</strong>{" "}
          <button
            type="button"
            className="text-xs underline text-[var(--accent)] ml-1"
            onClick={() => setMyPrediction(null)}
          >
            change
          </button>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-[var(--muted)] block mb-1">Your guess: when does this resolve?</label>
              <input
                type="date"
                value={predictedDate}
                onChange={(e) => setPredictedDate(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60"
            >
              {loading ? "Submitting…" : "Submit guess"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="anonymous"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={40}
              className="max-w-[220px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs"
            />
            <span className="text-xs text-[var(--muted)]">optional nickname · remembered on this device</span>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {showSavePrompt && saveStatus !== "sent" && (
        <form onSubmit={handleSaveProfile} className="mt-3 pt-3 border-t border-[var(--border)] flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-[var(--muted)] block mb-1">
              Save this to a profile that survives a new device? (optional)
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={saveEmail}
              onChange={(e) => setSaveEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saveStatus === "sending"}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60"
          >
            {saveStatus === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {saveStatus === "error" && <p className="text-xs text-red-600 dark:text-red-400 w-full">Couldn&rsquo;t send that — try again.</p>}
        </form>
      )}
      {saveStatus === "sent" && (
        <p className="text-xs text-[var(--muted)] mt-3 pt-3 border-t border-[var(--border)]">
          Check your email for a link to confirm.
        </p>
      )}

      {guesses.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1.5">{guesses.length} guess{guesses.length === 1 ? "" : "es"} so far</p>
          <div className="flex flex-col gap-1">
            {guesses.map((g, i) => (
              <div key={`${g.label}-${i}`} className="flex items-center gap-2 text-xs">
                <span className="flex-1">{g.label}</span>
                {g.isAgent && (
                  <span className="text-[10px] bg-black/5 dark:bg-white/10 rounded-full px-1.5 py-0.5">via API</span>
                )}
                <span className="text-[var(--muted)]">{formatDate(g.predictedDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
