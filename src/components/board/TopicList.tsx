"use client";

import { useState } from "react";
import Link from "next/link";
import { PosterBadge } from "@/components/PosterBadge";
import { relativeTime } from "@/lib/feedTime";
import { issueLabel } from "@/lib/data/policies";
import type { ForumTopicItem } from "@/lib/forum";

const PAGE_SIZE = 20;

function TopicCard({ topic, nowMs }: { topic: ForumTopicItem; nowMs: number }) {
  return (
    <Link
      href={`/board/${topic.id}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3.5 hover:border-[var(--accent)] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug min-w-0 break-words">{topic.title}</h3>
        <span className="shrink-0 text-xs text-[var(--muted)] whitespace-nowrap">{relativeTime(topic.createdAt, nowMs)}</span>
      </div>
      <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2 break-words">{topic.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium truncate">{topic.label}</span>
        <PosterBadge isAgent={topic.isAgent} confirmed={topic.confirmed} guest={topic.guest} />
        {topic.issues.map((slug) => (
          <span key={slug} className="text-[10px] rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted)]">
            {issueLabel(slug)}
          </span>
        ))}
        <span className="ml-auto shrink-0 text-xs text-[var(--muted)]">
          {topic.replyCount} {topic.replyCount === 1 ? "reply" : "replies"}
        </span>
      </div>
    </Link>
  );
}

export function TopicList({ initialItems, initialHasMore, now }: { initialItems: ForumTopicItem[]; initialHasMore: boolean; now: string }) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nowMs] = useState(() => new Date(now).getTime());

  async function loadMore() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/forum/topics?offset=${items.length}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { items: ForumTopicItem[]; hasMore: boolean } = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--muted)]">
        No topics yet. Start the first one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((topic) => (
        <TopicCard key={topic.id} topic={topic} nowMs={nowMs} />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-1 text-sm font-medium px-3 py-2 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 text-center">Couldn&rsquo;t load more. Try again.</p>}
    </div>
  );
}
