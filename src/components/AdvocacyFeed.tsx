"use client";

import { useState } from "react";
import Link from "next/link";
import { PosterBadge } from "./PosterBadge";
import { relativeTime, groupByDate } from "@/lib/feedTime";
import { STATE_NAMES } from "@/lib/data/usStates";
import { POLICIES } from "@/lib/data/policies";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { describeAdvocacyEntry, type AdvocacyType } from "@/lib/data/advocacyPoints";
import type { AdvocacyFeedItem } from "@/lib/advocacyFeed";

function issueLabel(slug: string): string {
  if (slug === "other") return "Something else";
  const policy = POLICIES.find((p) => p.slug === slug);
  return policy?.badgeLabel ?? CAUSE_CATEGORY_BY_SLUG[slug as keyof typeof CAUSE_CATEGORY_BY_SLUG]?.shortLabel ?? slug;
}

function describeContact(item: AdvocacyFeedItem): string {
  const stateName = STATE_NAMES[item.state ?? ""] ?? item.state ?? "";
  if (item.targetType === "state_regulator") return `contacted ${item.targetName ?? "their state regulator"}`;
  const chamber = item.targetType === "house" ? "U.S. Representative" : "U.S. Senator";
  return `contacted their ${chamber} for ${stateName}${item.targetName ? ` (${item.targetName})` : ""}`;
}

function AdvocacyCard({ item, nowMs }: { item: AdvocacyFeedItem; nowMs: number }) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold truncate">{item.label}</span>
        <PosterBadge isAgent={item.isAgent} confirmed={item.confirmed} guest={item.guest} />
        <span className="text-[var(--accent)] font-medium shrink-0">+{item.points}</span>
        <span className="text-[var(--muted)] ml-auto shrink-0">{relativeTime(item.createdAt, nowMs)}</span>
      </div>
      <p className="text-sm mt-1">
        {item.kind === "project" ? (
          <>
            {describeAdvocacyEntry(item.advocacyType as AdvocacyType, item.hearingDate)} on{" "}
            <span className="font-medium">{item.projectName}</span>
          </>
        ) : (
          describeContact(item)
        )}
      </p>
      {item.kind === "contact" && item.issues && item.issues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.issues.map((slug) => (
            <span key={slug} className="text-[10px] rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted)]">
              {issueLabel(slug)}
            </span>
          ))}
        </div>
      )}
      {item.note && <p className="text-sm text-[var(--text-secondary)] mt-1.5 whitespace-pre-wrap break-words line-clamp-4">{item.note}</p>}
    </>
  );

  const className = "rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 hover:border-[var(--accent)] transition-colors";
  if (item.kind === "project" && item.projectSlug) {
    return (
      <Link href={`/project/${item.projectSlug}#comments`} className={`block ${className}`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

// Server-rendered-first-page-then-"Load more" pattern shared with
// ChangesFeed and the old CommunityFeed — see the `now` prop comment there
// for why it's threaded through instead of each render calling Date.now().
export function AdvocacyFeed({ initialItems, initialHasMore, now }: { initialItems: AdvocacyFeedItem[]; initialHasMore: boolean; now: string }) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nowDate] = useState(() => new Date(now));

  async function loadMore() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/advocacy-feed?offset=${items.length}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { items: AdvocacyFeedItem[]; hasMore: boolean } = await res.json();
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
        Nothing here yet. Open a project and log the first "I Advocated."
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
            <AdvocacyCard key={`${item.kind}-${item.id}`} item={item} nowMs={nowDate.getTime()} />
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
