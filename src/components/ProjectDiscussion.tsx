"use client";

import { useCallback, useEffect, useState } from "react";
import { PredictorIcon } from "./PredictorIcon";
import { SaveProfilePrompt, shouldOfferSaveProfile } from "./SaveProfilePrompt";
import {
  DISCUSSION_CHANGED_EVENT,
  IDENTITY_CHANGED_EVENT,
  getOrCreatePredictorKey,
  getStoredNickname,
  storeNickname,
} from "@/lib/clientIdentity";
import { relativeTime } from "@/lib/feedTime";

const MAX_COMMENT = 1000;

interface DiscussionItem {
  id: string;
  kind: "prediction" | "comment";
  label: string;
  isAgent: boolean;
  body: string | null;
  predictedDate: string | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The comment thread at the bottom of a project page, like a news article:
// predictions that came with a "why" appear here automatically, next to
// free-form comments. Same identity as predicting: an anonymous browser key
// plus a name that's asked for once and then locked, with an optional email
// to save the profile.
export function ProjectDiscussion({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<DiscussionItem[] | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [lockedName, setLockedName] = useState("");
  const [typedName, setTypedName] = useState("");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/comments?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items) {
          setItems(data.items);
          setNowMs(Date.now());
        }
      })
      .catch(() => setItems((prev) => prev ?? []));
  }, [projectId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setKey(getOrCreatePredictorKey());
      setLockedName(getStoredNickname());
      load();
    }, 0);
    const syncName = () => setLockedName(getStoredNickname());
    window.addEventListener(DISCUSSION_CHANGED_EVENT, load);
    window.addEventListener(IDENTITY_CHANGED_EVENT, syncName);
    return () => {
      clearTimeout(t);
      window.removeEventListener(DISCUSSION_CHANGED_EVENT, load);
      window.removeEventListener(IDENTITY_CHANGED_EVENT, syncName);
    };
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key) return;
    const name = lockedName || typedName.trim();
    if (!name) {
      setError("Enter a name so people know who's commenting.");
      return;
    }
    if (!text.trim()) {
      setError("Write a comment first.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, anonymousKey: key, displayName: name, body: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      storeNickname(data.displayName ?? name);
      setText("");
      if (shouldOfferSaveProfile(data.hasSavedProfile)) setShowSavePrompt(true);
      load();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-[var(--accent)] mb-3">
        Comments{items && items.length > 0 ? ` (${items.length})` : ""}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_COMMENT}
          rows={3}
          aria-label="Add a comment"
          placeholder="Share what you know or think"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {lockedName ? (
            <span className="text-xs text-[var(--muted)]">
              Commenting as <strong className="text-[var(--foreground)]">{lockedName}</strong>
            </span>
          ) : (
            <input
              type="text"
              placeholder="Your name"
              aria-label="Your name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              maxLength={40}
              className="w-40 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            />
          )}
          <button
            type="submit"
            disabled={posting}
            className="rounded-md bg-[var(--accent)] text-white px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {posting ? "…" : "Post comment"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>

      {showSavePrompt && key && <SaveProfilePrompt anonymousKey={key} />}

      {items && items.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col gap-4">
          {items.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-center gap-1.5 text-xs">
                <PredictorIcon isAgent={c.isAgent} />
                <span className="font-semibold truncate">{c.label}</span>
                {nowMs != null && <span className="text-[var(--muted)]">· {relativeTime(c.createdAt, nowMs)}</span>}
              </div>
              {c.kind === "prediction" && c.predictedDate && (
                <p className="text-xs text-[var(--muted)] mt-0.5">Predicted approval on {formatDate(c.predictedDate)}</p>
              )}
              {c.body && <p className="mt-1 text-[var(--text-secondary)] whitespace-pre-wrap break-words">{c.body}</p>}
            </li>
          ))}
        </ul>
      )}
      {items && items.length === 0 && <p className="text-xs text-[var(--muted)] mt-3">No comments yet. Be the first.</p>}
    </div>
  );
}
