"use client";

import { useState } from "react";

const SENT_FLAG = "wfp_predictor_email_sent";

// Offered once per browser after someone's first post: attach an email so
// their name and history survive a device change. Optional; skipping costs
// nothing.
export function shouldOfferSaveProfile(hasSavedProfile: boolean): boolean {
  return !hasSavedProfile && !localStorage.getItem(SENT_FLAG);
}

export function SaveProfilePrompt({ anonymousKey }: { anonymousKey: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/predictions/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? null);
        setStatus("error");
        return;
      }
      localStorage.setItem(SENT_FLAG, "1");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-xs text-[var(--muted)] mt-2 pt-2 border-t border-[var(--border)]">
        Check your email for a link to confirm.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-[var(--border)] flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[160px]">
        <label className="text-[10px] text-[var(--muted)] block mb-0.5">Confirm your email to save your name and history (optional)</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send link"}
      </button>
      {status === "error" && <p className="text-xs text-red-600 dark:text-red-400 w-full">{error ?? "Couldn’t send that. Try again."}</p>}
    </form>
  );
}
