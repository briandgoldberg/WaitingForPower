"use client";

import { useState } from "react";
import { SaveProfilePrompt } from "./SaveProfilePrompt";

// Shown to a first-time poster instead of the composer. Their post is held
// (nobody sees it) until they choose: keep the handle, or confirm an email to
// pick a name.
export function IdentityDecision({
  anonymousKey,
  label,
  onDecided,
}: {
  anonymousKey: string;
  label: string;
  onDecided: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postAsGuest() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions/decide-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong.");
        return;
      }
      onDecided();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={postAsGuest}
          disabled={saving}
          className="rounded-md bg-[var(--accent)] text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Posting…" : `Post as ${label}`}
        </button>
        <button
          type="button"
          onClick={() => setEmailOpen((o) => !o)}
          className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
        >
          Confirm email to choose a name
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {emailOpen && <SaveProfilePrompt anonymousKey={anonymousKey} />}
    </div>
  );
}
