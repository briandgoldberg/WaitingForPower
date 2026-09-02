"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "sent" | "already" | "error";

export function SubscribeBox({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, email }),
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
      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-1">Check your email</h2>
        <p className="text-sm text-[var(--muted)]">
          We sent a confirmation link to {email}. Click it to start getting updates on {projectName}.
        </p>
      </section>
    );
  }

  if (status === "already") {
    return (
      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-1">You&rsquo;re already subscribed</h2>
        <p className="text-sm text-[var(--muted)]">{email} will get an email when this project updates.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
      <h2 className="text-lg font-semibold mb-1">Get notified of updates</h2>
      <p className="text-sm text-[var(--muted)] mb-3">
        We&rsquo;ll email you when {projectName}&rsquo;s status changes — no more than once a day.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-md bg-[var(--accent)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : "Notify me"}
        </button>
      </form>
      {status === "error" && <p className="text-sm text-red-600 mt-2">{errorMsg}</p>}
    </section>
  );
}
