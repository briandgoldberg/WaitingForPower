"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SaveProfilePrompt } from "./SaveProfilePrompt";
import { IdentityDecision } from "./IdentityDecision";
import { SignInLink } from "./SignInLink";
import { ChooseName } from "./ChooseName";
import { PosterBadge } from "./PosterBadge";
import {
  DISCUSSION_CHANGED_EVENT,
  getOrCreatePredictorKey,
} from "@/lib/clientIdentity";
import { relativeTime } from "@/lib/feedTime";
import type { Discussion, ReplyItem } from "@/lib/community";

const MAX_COMMENT = 1000;
const POSTS_PER_PAGE = 10;
const REPLIES_COLLAPSED = 2;

interface ReplyTarget {
  threadKey: string;
  toLabel: string;
  payload: { parentCommentId?: string };
}

// The whole conversation about a project, like the comments under a news
// article: one composer, one flat reply level, likes on everything.
// Identity is the same as everywhere else on the site: an anonymous browser
// key plus a name asked for once and then locked.
export function ProjectDiscussion({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Discussion | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [sort, setSort] = useState<"top" | "new">("top");
  const [visible, setVisible] = useState(POSTS_PER_PAGE);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const load = useCallback(
    (keyOverride?: string | null) => {
      const k = keyOverride ?? key;
      fetch(`/api/comments?projectId=${encodeURIComponent(projectId)}`, {
        headers: k ? { "x-anonymous-key": k } : undefined,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Discussion | null) => {
          if (d?.items) {
            setData(d);
            setNowMs(Date.now());
          }
        })
        .catch(() => setData((prev) => prev ?? { items: [], me: null }));
    },
    [projectId, key],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const k = getOrCreatePredictorKey();
      setKey(k);
      load(k);
    }, 0);
    const onChanged = () => load();
    window.addEventListener(DISCUSSION_CHANGED_EVENT, onChanged);
    return () => {
      clearTimeout(t);
      window.removeEventListener(DISCUSSION_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  const sorted = useMemo(() => {
    const items = [...(data?.items ?? [])];
    if (sort === "top") items.sort((a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt));
    else items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  }, [data, sort]);

  const me = data?.me ?? null;
  const myLabel = me?.label ?? "";

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!key) return;
    const body = text.trim();
    if (!body) {
      setError("Write something first.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, anonymousKey: key, body }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setText("");
      setSort("new");
      window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!key || !replyTo) return;
    if (!replyText.trim()) {
      setReplyError("Write a reply first.");
      return;
    }
    setReplyPosting(true);
    setReplyError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, anonymousKey: key, body: replyText.trim(), ...replyTo.payload }),
      });
      const result = await res.json();
      if (!res.ok) {
        setReplyError(result.error ?? "Something went wrong.");
        return;
      }
      setReplyText("");
      setReplyTo(null);
      window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT));
    } catch {
      setReplyError("Couldn't reach the server. Please try again.");
    } finally {
      setReplyPosting(false);
    }
  }

  // Optimistic like: flip the heart immediately, then settle to the server's
  // count (or roll back on failure).
  async function handleLike(id: string, current: { liked: boolean; count: number }) {
    if (!key) return;
    const apply = (liked: boolean, count: number) =>
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) => {
                if (it.rawId === id) return { ...it, likedByMe: liked, likeCount: count };
                return { ...it, replies: it.replies.map((r) => (r.id === id ? { ...r, likedByMe: liked, likeCount: count } : r)) };
              }),
            }
          : prev,
      );
    apply(!current.liked, Math.max(0, current.count + (current.liked ? -1 : 1)));
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey: key, targetId: id }),
      });
      if (!res.ok) throw new Error("like failed");
      const result = await res.json();
      apply(result.liked, result.count);
    } catch {
      apply(current.liked, current.count);
    }
  }

  function startReply(threadKey: string, toLabel: string, payload: ReplyTarget["payload"]) {
    setReplyTo({ threadKey, toLabel, payload });
    setReplyText("");
    setReplyError(null);
  }

  const total = data ? data.items.length + data.items.reduce((n, i) => n + i.replies.length, 0) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-base font-semibold text-[var(--accent)]">Discussion{total > 0 ? ` (${total})` : ""}</h2>
        {data && data.items.length > 1 && (
          <div className="flex gap-3 text-xs">
            {(["top", "new"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={sort === s ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}
              >
                {s === "top" ? "Top" : "Newest"}
              </button>
            ))}
          </div>
        )}
      </div>

      {me && !me.decided && key ? (
        <IdentityDecision
          anonymousKey={key}
          label={me.label}
          onDecided={() => window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT))}
        />
      ) : (
        <div>
          <form onSubmit={handlePost} className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_COMMENT}
            rows={3}
            aria-label="Add to the discussion"
            placeholder="Share what you think or know"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex-1" />
            {!me && <SignInLink />}
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
          {me && !me.nameChosen && (
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Posting as {me.label} ·{" "}
              <button type="button" onClick={() => setIdentityOpen((o) => !o)} className="text-[var(--accent)] underline">
                Choose a name
              </button>
            </p>
          )}
          {identityOpen && key && me && !me.nameChosen && (
            <div className="mt-1">
              {me.emailConfirmed ? (
                <ChooseName anonymousKey={key} onDone={() => setIdentityOpen(false)} />
              ) : (
                <SaveProfilePrompt anonymousKey={key} />
              )}
            </div>
          )}
        </div>
      )}

      {data && sorted.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col gap-5">
          {sorted.slice(0, visible).map((post) => {
            const threadKey = post.rawId;
            const showAll = expandedReplies.has(threadKey) || post.replies.length <= REPLIES_COLLAPSED;
            const shownReplies = showAll ? post.replies : post.replies.slice(0, REPLIES_COLLAPSED);
            return (
              <li key={threadKey} className="text-sm">
                <PostHeader
                  label={post.label}
                  isAgent={post.isAgent}
                  confirmed={post.confirmed}
                  guest={post.guest}
                  pending={post.pending}
                  createdAt={post.createdAt}
                  nowMs={nowMs}
                  isMe={!!myLabel && post.label === myLabel}
                />
                {post.body && <p className="mt-1 text-[var(--text-secondary)] whitespace-pre-wrap break-words">{post.body}</p>}
                <div className="flex items-center gap-4 mt-1.5 text-xs">
                  <LikeButton
                    liked={post.likedByMe}
                    count={post.likeCount}
                    onClick={() => handleLike(post.rawId, { liked: post.likedByMe, count: post.likeCount })}
                  />
                  <button
                    type="button"
                    onClick={() => startReply(threadKey, post.label, { parentCommentId: post.rawId })}
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Reply{post.replies.length > 0 ? ` (${post.replies.length})` : ""}
                  </button>
                </div>

                {(shownReplies.length > 0 || replyTo?.threadKey === threadKey) && (
                  <div className="mt-2 ml-3 pl-3 border-l-2 border-[var(--border)] flex flex-col gap-3">
                    {shownReplies.map((r) => (
                      <ReplyRow
                        key={r.id}
                        reply={r}
                        nowMs={nowMs}
                        isMe={!!myLabel && r.label === myLabel}
                        onLike={() => handleLike(r.id, { liked: r.likedByMe, count: r.likeCount })}
                        onReply={() => startReply(threadKey, r.label, { parentCommentId: r.id })}
                      />
                    ))}
                    {!showAll && (
                      <button
                        type="button"
                        onClick={() => setExpandedReplies((prev) => new Set(prev).add(threadKey))}
                        className="text-xs text-[var(--accent)] text-left underline"
                      >
                        View {post.replies.length - REPLIES_COLLAPSED} more {post.replies.length - REPLIES_COLLAPSED === 1 ? "reply" : "replies"}
                      </button>
                    )}
                    {replyTo?.threadKey === threadKey && (
                      <form onSubmit={handleReply} className="flex flex-col gap-1.5">
                        <textarea
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          maxLength={MAX_COMMENT}
                          rows={2}
                          aria-label={`Reply to ${replyTo.toLabel}`}
                          placeholder={`Reply to ${replyTo.toLabel}`}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm resize-none"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="submit"
                            disabled={replyPosting}
                            className="rounded-md bg-[var(--accent)] text-white px-3 py-1 text-xs font-semibold disabled:opacity-60"
                          >
                            {replyPosting ? "…" : "Reply"}
                          </button>
                          <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-[var(--muted)]">
                            Cancel
                          </button>
                        </div>
                        {replyError && <p className="text-xs text-red-600 dark:text-red-400">{replyError}</p>}
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && sorted.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + POSTS_PER_PAGE)}
          className="mt-4 text-sm font-medium px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
        >
          Show more
        </button>
      )}
      {data && sorted.length === 0 && <p className="text-xs text-[var(--muted)] mt-4">Nothing here yet. Be the first to weigh in.</p>}
    </div>
  );
}

function PostHeader({
  label,
  isAgent,
  confirmed,
  guest,
  pending,
  createdAt,
  nowMs,
  isMe,
}: {
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  createdAt: string;
  nowMs: number | null;
  isMe: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="font-semibold truncate">{label}</span>
      <PosterBadge isAgent={isAgent} confirmed={confirmed} guest={guest} />
      {isMe && <span className="rounded bg-black/5 dark:bg-white/10 px-1 text-[10px] text-[var(--muted)]">You</span>}
      {pending && (
        <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-1 text-[10px]">Only you can see this</span>
      )}
      {nowMs != null && <span className="text-[var(--muted)]">· {relativeTime(createdAt, nowMs)}</span>}
    </div>
  );
}

function LikeButton({ liked, count, onClick }: { liked: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={`inline-flex items-center gap-1 ${liked ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      <span>{count > 0 ? count : "Like"}</span>
    </button>
  );
}

function ReplyRow({
  reply,
  nowMs,
  isMe,
  onLike,
  onReply,
}: {
  reply: ReplyItem;
  nowMs: number | null;
  isMe: boolean;
  onLike: () => void;
  onReply: () => void;
}) {
  return (
    <div className="text-sm">
      <PostHeader label={reply.label} isAgent={reply.isAgent} confirmed={reply.confirmed} guest={reply.guest} pending={reply.pending} createdAt={reply.createdAt} nowMs={nowMs} isMe={isMe} />
      <p className="mt-0.5 text-[var(--text-secondary)] whitespace-pre-wrap break-words">{reply.body}</p>
      <div className="flex items-center gap-4 mt-1 text-xs">
        <LikeButton liked={reply.likedByMe} count={reply.likeCount} onClick={onLike} />
        <button type="button" onClick={onReply} className="text-[var(--muted)] hover:text-[var(--foreground)]">
          Reply
        </button>
      </div>
    </div>
  );
}
