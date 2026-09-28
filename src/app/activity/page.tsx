import type { Metadata } from "next";
import Link from "next/link";
import { AdvocacyFeed } from "@/components/AdvocacyFeed";
import { Leaderboard } from "@/components/Leaderboard";
import { getAdvocacyFeed } from "@/lib/advocacyFeed";
import { getTopAdvocates } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity — WaitingForPower",
  description: "See who's advocating for faster energy permitting decisions, and the leaderboard of top advocates.",
  alternates: { canonical: "/activity" },
};

type ActivityFeed = "advocating" | "leaders";
const TABS: { value: ActivityFeed; label: string }[] = [
  { value: "advocating", label: "Advocacy activity" },
  { value: "leaders", label: "Top advocates" },
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const { feed: feedParam } = await searchParams;
  const feed: ActivityFeed = feedParam === "leaders" ? "leaders" : "advocating";

  const [advocacyResult, leaders] = await Promise.all([
    feed === "advocating" ? getAdvocacyFeed(0, 20) : Promise.resolve({ items: [], hasMore: false }),
    feed === "leaders" ? getTopAdvocates(25) : Promise.resolve([]),
  ]);
  // Passed down instead of letting the feed components call `new Date()`
  // themselves — see ChangesFeed's `now` prop comment for the hydration
  // mismatch this fixes.
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Community activity</h1>

      <div className="flex justify-between sm:justify-start gap-2 sm:gap-6 border-b border-[var(--border)]" role="tablist">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "advocating" ? "/activity" : `/activity?feed=${tab.value}`}
            role="tab"
            aria-selected={feed === tab.value}
            className={`shrink-0 -mb-px px-0.5 pb-2.5 pt-1 max-[359px]:text-xs text-[13px] min-[400px]:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              feed === tab.value ? "border-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text-secondary)]"
            }`}
            style={feed === tab.value ? { color: "var(--accent)" } : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {feed === "advocating" && (
        <AdvocacyFeed initialItems={advocacyResult.items} initialHasMore={advocacyResult.hasMore} now={now} />
      )}
      {feed === "leaders" && <Leaderboard entries={leaders} />}
    </div>
  );
}
