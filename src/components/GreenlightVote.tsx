"use client";

import { useEffect, useState } from "react";

type Vote = "green" | "red";

// Anonymous, no account — a random id generated once per browser and kept
// in localStorage, same zero-friction pattern as this site's other
// no-login flows (VisitorFeedback, FeedSubscription's double opt-in). Not
// meant to be fraud-proof, just proportionate to the stakes: this is a
// values signal ("do you want this built"), not money or a real forecast.
function getVoterKey(): string {
  const key = "wfp_voter_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function votedKey(slug: string): string {
  return `wfp_verdict_${slug}`;
}

// "Support / Against" rather than a generic thumbs-up/down — still reuses
// the site's existing colored-dot visual language (fuel-type dots, cause
// dots) via green/red, instead of introducing a new icon set or emoji.
export function GreenlightVote({
  slug,
  initialGreen,
  initialRed,
  compact = false,
}: {
  slug: string;
  initialGreen: number;
  initialRed: number;
  compact?: boolean;
}) {
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [green, setGreen] = useState(initialGreen);
  const [red, setRed] = useState(initialRed);
  const [loading, setLoading] = useState(false);

  // Read after mount only — localStorage isn't available during SSR, and
  // seeding this from a server-known value would be wrong anyway (the vote
  // is per-browser, not per-request). A one-frame flash from buttons to
  // results on an already-voted browser is the accepted tradeoff, same as
  // every other localStorage-backed widget on this site.
  useEffect(() => {
    const stored = localStorage.getItem(votedKey(slug));
    if (stored !== "green" && stored !== "red") return;
    // Deferred via setTimeout rather than called synchronously in the
    // effect body — same pattern IntentWidget.tsx already uses for its own
    // localStorage-gated setState, to avoid a cascading-render lint error.
    const t = setTimeout(() => setMyVote(stored), 0);
    return () => clearTimeout(t);
  }, [slug]);

  async function castVote(e: React.MouseEvent, vote: Vote) {
    e.preventDefault();
    e.stopPropagation();
    if (myVote || loading) return;
    setLoading(true);
    setMyVote(vote);
    localStorage.setItem(votedKey(slug), vote);
    try {
      const res = await fetch(`/api/projects/${slug}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterKey: getVoterKey(), vote }),
      });
      if (res.ok) {
        const data: { green: number; red: number } = await res.json();
        setGreen(data.green);
        setRed(data.red);
      }
    } catch {
      // Vote still recorded locally for display purposes — a failed
      // network call here isn't worth surfacing an error for something
      // this low-stakes.
    } finally {
      setLoading(false);
    }
  }

  const total = green + red;
  const greenPct = total > 0 ? Math.round((green / total) * 100) : 0;
  // Lead with whichever side actually has the majority, not always
  // "support" — a project running 65% against should read "65% against,"
  // not "35% support." A tie (including the true 0-vote case) reads as
  // "support" by convention.
  const againstIsMajority = red > green;
  const leadPct = againstIsMajority ? 100 - greenPct : greenPct;
  const leadLabel = againstIsMajority ? "against" : "support";

  if (myVote) {
    return (
      <div className={compact ? "flex items-center gap-1.5 text-[11px]" : "flex flex-col gap-1"}>
        <div className={`flex items-center gap-1 overflow-hidden rounded-full bg-[var(--border)] ${compact ? "h-1.5 w-16" : "h-2 w-full"}`}>
          <div className="h-full bg-green-500" style={{ width: `${greenPct}%` }} />
          <div className="h-full bg-red-500 flex-1" />
        </div>
        <span className={compact ? "text-[var(--muted)] whitespace-nowrap" : "text-xs text-[var(--muted)]"}>
          {leadPct}% {leadLabel} · {total.toLocaleString("en-US")} vote{total === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${compact ? "" : ""}`}>
      <button
        type="button"
        onClick={(e) => castVote(e, "green")}
        disabled={loading}
        aria-label="Support this project"
        title="Support this project — you want to see it built"
        className={`inline-flex items-center gap-1 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60 ${compact ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs font-medium"}`}
      >
        <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-green-500" />
        Support
      </button>
      <button
        type="button"
        onClick={(e) => castVote(e, "red")}
        disabled={loading}
        aria-label="Vote against this project"
        title="Vote against this project — you don't want to see it built"
        className={`inline-flex items-center gap-1 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60 ${compact ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs font-medium"}`}
      >
        <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-red-500" />
        Against
      </button>
    </div>
  );
}
