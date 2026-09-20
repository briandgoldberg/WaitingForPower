"use client";

import { useState } from "react";

// For someone who already confirmed an email on another browser or device:
// asks for that email and sends a one-time sign-in link. The answer is the
// same whether or not the email has a profile.
export function SignInLink() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/predictions/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't send that. Try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Couldn't reach the server. Try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-xs text-[var(--muted)]">
        If that email has a saved profile, we sent a sign-in link. It expires in 30 minutes.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-[var(--accent)] underline text-left">
        Have a saved profile? Sign in
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <input
        type="email"
        placeholder="you@example.com"
        aria-label="Email for your saved profile"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-48 max-w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Email me a link"}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}
