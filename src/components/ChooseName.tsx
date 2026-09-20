"use client";

import { useState } from "react";
import { DISCUSSION_CHANGED_EVENT, storeNickname } from "@/lib/clientIdentity";

// Shown only to a profile whose email is confirmed: pick the public name
// that replaces the anonymous handle. One time only, so it's spelled out.
export function ChooseName({ anonymousKey, onDone }: { anonymousKey: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions/set-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      storeNickname(data.displayName);
      window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT));
      onDone();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-[var(--border)] flex flex-col gap-1.5">
      <label className="text-[10px] text-[var(--muted)]">Choose your public name. You can only do this once.</label>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="e.g. Alex R"
          aria-label="Your public name"
          className="w-44 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-[var(--accent)] text-white px-3 py-1 text-xs font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save name"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
