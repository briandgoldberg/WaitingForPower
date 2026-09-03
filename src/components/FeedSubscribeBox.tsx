"use client";

import { useState } from "react";
import { stateName } from "@/lib/data/usStates";

type Status = "idle" | "open" | "loading" | "sent" | "already" | "error";

export function FeedSubscribeBox({ state }: { state: string | null }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const scope = state ? stateName(state) : "every state";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/feed-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, state }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus(data.alreadySubscribed ? "already" : "sent");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="self-start text-xs text-[var(--text-secondary)]">
        Check your email — we sent a link to confirm daily updates for {scope}.
      </p>
    );
  }

  if (status === "already") {
    return (
      <p className="self-start text-xs text-[var(--text-secondary)]">
        {email} already gets daily updates for {scope}.
      </p>
    );
  }

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStatus("open")}
        className="self-start text-xs font-semibold px-3.5 py-1.5 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
      >
        Subscribe to this feed
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="self-start flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-sm w-48"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-accent hover:bg-accent/90 shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap"
        style={{ color: "white" }}
      >
        {status === "loading" ? "Sending…" : `Get daily updates for ${scope}`}
      </button>
      <button
        type="button"
        onClick={() => setStatus("idle")}
        className="text-xs text-[var(--muted)] hover:underline"
      >
        Cancel
      </button>
      {status === "error" && <p className="text-xs text-red-600 dark:text-red-400 w-full">{errorMsg}</p>}
    </form>
  );
}
