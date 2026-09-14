"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PredictorIcon } from "./PredictorIcon";

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

// Collapsed-by-default so the page doesn't read as long, but the closed
// state is a bold single CTA button rather than a quiet link — clicking it
// reveals the compact name/date/submit row. Two-step flow beyond that,
// deliberately in this order: (1) let someone predict immediately, no
// barrier at all — the whole point is to get a real commitment locked in
// before ever asking for anything; (2) only once that's done, offer to
// save it under an email so it survives a device change instead of living
// only in this browser's localStorage. Skipping step 2 costs nothing — the
// prediction already counts either way.
export function PredictCard({ projectId }: { projectId: string }) {
  const [predictorKey, setPredictorKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
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
    if (!predictorKey) return;
    if (!nickname.trim()) {
      setError("Enter a name — it's how you'll show up on the leaderboard.");
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      localStorage.setItem(predictionKey(projectId), data.predictedDate);
      localStorage.setItem("wfp_predictor_nickname", nickname.trim());
      setMyPrediction(data.predictedDate);
      // Only nag once, ever, per browser — not on every project someone
      // predicts on.
      if (!data.hasSavedProfile && !localStorage.getItem("wfp_predictor_email_sent")) {
        setShowSavePrompt(true);
      }
      const label = nickname.trim();
      setGuesses((prev) => [...prev.filter((g) => g.label !== label), { label, isAgent: false, predictedDate: data.predictedDate, submittedAt: new Date().toISOString() }].sort((a, b) => a.predictedDate.localeCompare(b.predictedDate)));
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
            No sign-in needed{guesses.length > 0 && <> · {guesses.length} guess{guesses.length === 1 ? "" : "es"} so far</>}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold">Predict when this project is approved</h2>
            <span className="text-[10px] text-[var(--muted)]">No sign-in needed</span>
          </div>

          {myPrediction ? (
            <p className="text-sm mt-2">
              Your guess: <strong>{formatDate(myPrediction)}</strong> — locked in, no changes.
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

          {showSavePrompt && saveStatus !== "sent" && (
            <form onSubmit={handleSaveProfile} className="mt-2 pt-2 border-t border-[var(--border)] flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] text-[var(--muted)] block mb-0.5">Save your streak to an email? (optional)</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={saveEmail}
                  onChange={(e) => setSaveEmail(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saveStatus === "sending"}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60"
              >
                {saveStatus === "sending" ? "Sending…" : "Send link"}
              </button>
              {saveStatus === "error" && <p className="text-xs text-red-600 dark:text-red-400 w-full">Couldn&rsquo;t send that — try again.</p>}
            </form>
          )}
          {saveStatus === "sent" && (
            <p className="text-xs text-[var(--muted)] mt-2 pt-2 border-t border-[var(--border)]">
              Check your email for a link to confirm.
            </p>
          )}

          {guesses.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-[var(--muted)]">{guesses.length} guess{guesses.length === 1 ? "" : "es"} so far</p>
                <Link href="/leaderboard" className="text-[10px] underline text-[var(--accent)]">leaderboard</Link>
              </div>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {guesses.map((g, i) => (
                  <div key={`${g.label}-${i}`} className="flex items-center gap-1.5 text-xs">
                    <PredictorIcon isAgent={g.isAgent} />
                    <span className="flex-1 truncate">{g.label}</span>
                    <span className="text-[var(--muted)] shrink-0">{formatDate(g.predictedDate)}</span>
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
