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

// Comments on one project: predictions that came with a "why" appear here
// automatically, next to free-form comments. Same identity as predicting —
// anonymous browser key plus a required name, optional email to save it.
export function ProjectDiscussion({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<DiscussionItem[] | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
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
      setNickname(getStoredNickname());
      load();
    }, 0);
    const syncName = () => setNickname((prev) => prev || getStoredNickname());
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
    if (!nickname.trim()) {
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
        body: JSON.stringify({ projectId, anonymousKey: key, displayName: nickname.trim(), body: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      storeNickname(nickname.trim());
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
      <h3 className="text-sm font-semibold mb-2">Comments{items && items.length > 0 ? ` (${items.length})` : ""}</h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-28">
            <label className="text-[10px] text-[var(--muted)] block mb-0.5">Name</label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={40}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] text-[var(--muted)] block mb-0.5">Add a comment</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_COMMENT}
              rows={2}
              placeholder="Share what you know or think"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={posting}
            className="rounded-md bg-[var(--accent)] text-white px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {posting ? "…" : "Post"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>

      {showSavePrompt && key && <SaveProfilePrompt anonymousKey={key} />}

      {items && items.length > 0 && (
        <ul className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-3 max-h-96 overflow-y-auto">
          {items.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-center gap-1.5 text-xs">
                <PredictorIcon isAgent={c.isAgent} />
                <span className="font-medium truncate">{c.label}</span>
                {c.kind === "prediction" && c.predictedDate && (
                  <span className="text-[var(--muted)]">predicted {formatDate(c.predictedDate)}</span>
                )}
                {nowMs != null && <span className="text-[var(--muted)] ml-auto shrink-0">{relativeTime(c.createdAt, nowMs)}</span>}
              </div>
              {c.body && <p className="mt-0.5 text-[var(--text-secondary)] whitespace-pre-wrap break-words">{c.body}</p>}
            </li>
          ))}
        </ul>
      )}
      {items && items.length === 0 && <p className="text-xs text-[var(--muted)] mt-3">No comments yet. Be the first.</p>}
    </div>
  );
}
