"use client";

import { useState } from "react";
import Link from "next/link";
import { setPredictorKey, storeNickname } from "@/lib/clientIdentity";

// Landing page for the emailed sign-in link. Requires a click before it uses
// the single-use token, so email link scanners that pre-fetch the URL can't
// spend it.
export function RestoreProfile({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setStatus("working");
    setError(null);
    try {
      const res = await fetch("/api/predictions/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setPredictorKey(data.anonymousKey);
      if (data.displayName) storeNickname(data.displayName);
      // Already saved, so don't ask to save an email again.
      localStorage.setItem("wfp_predictor_email_sent", "1");
      setName(data.displayName ?? "");
      setStatus("done");
    } catch {
      setError("Couldn't reach the server. Try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          You&rsquo;re signed in{name ? <> as <strong>{name}</strong></> : ""}. Your name and comments are back on this device.
        </p>
        <Link href="/?feed=advocating" className="text-sm text-[var(--accent)] underline">
          Go to the feed
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 items-start">
      <p className="text-sm text-[var(--text-secondary)]">Sign in to your WaitingForPower name and history on this device.</p>
      <button
        type="button"
        onClick={handleContinue}
        disabled={status === "working" || !token}
        className="rounded-md bg-[var(--accent)] text-white px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {status === "working" ? "Signing in…" : "Sign in"}
      </button>
      {!token && <p className="text-xs text-red-600 dark:text-red-400">This link is missing its code.</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
