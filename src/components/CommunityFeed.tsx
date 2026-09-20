"use client";

import { useState } from "react";
import Link from "next/link";
import { PredictorIcon } from "./PredictorIcon";
import { PosterBadge } from "./PosterBadge";
import { relativeTime, groupByDate } from "@/lib/feedTime";
import type { CommunityFeedItem } from "@/lib/community";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function CommunityCard({ item, nowMs }: { item: CommunityFeedItem; nowMs: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 hover:border-[var(--accent)] transition-colors">
      <Link href={`/project/${item.projectSlug}#${item.body ? "comments" : "take-action"}`} className="block">
        <div className="flex items-center gap-1.5 text-xs">
          <PredictorIcon isAgent={item.isAgent} />
          <span className="font-semibold truncate">{item.label}</span>
          <PosterBadge confirmed={item.confirmed} guest={item.guest} />
          <span className="text-[var(--muted)] shrink-0">{item.kind === "prediction" ? "predicted" : "commented"}</span>
          <span className="text-[var(--muted)] ml-auto shrink-0">{relativeTime(item.createdAt, nowMs)}</span>
        </div>
        <p className="text-sm font-medium mt-1 truncate">{item.projectName}</p>
        {item.kind === "prediction" && item.predictedDate && (
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Will be approved <strong className="text-[var(--foreground)]">{formatDate(item.predictedDate)}</strong>
          </p>
        )}
        {item.body && <p className="text-sm text-[var(--text-secondary)] mt-1.5 whitespace-pre-wrap break-words line-clamp-4">{item.body}</p>}
      </Link>
    </div>
  );
}

// Same server-rendered-first-page-then-"Load more" pattern as ChangesFeed,
// including the shared `now` prop that keeps SSR and hydration identical.
export function CommunityFeed({
  initialItems,
  initialHasMore,
  now,
}: {
  initialItems: CommunityFeedItem[];
  initialHasMore: boolean;
  now: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nowDate] = useState(() => new Date(now));

  async function loadMore() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/community?offset=${items.length}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { items: CommunityFeedItem[]; hasMore: boolean } = await res.json();
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
        Nothing here yet. Open a project and be the first to predict or comment.
      </div>
    );
  }

  const groups = groupByDate(items, nowDate);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{group.label}</h3>
          {group.items.map((item) => (
            <CommunityCard key={item.id} item={item} nowMs={nowDate.getTime()} />
          ))}
        </div>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-2 text-sm font-medium px-3 py-2 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 text-center">Couldn&rsquo;t load more. Try again.</p>}
    </div>
  );
}
