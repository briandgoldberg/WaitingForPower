import type { Metadata } from "next";
import Link from "next/link";
import { getForumTopics } from "@/lib/forum";
import { NewTopicForm } from "@/components/board/NewTopicForm";
import { TopicList } from "@/components/board/TopicList";
import { AdvocacyFeed } from "@/components/AdvocacyFeed";
import { Leaderboard } from "@/components/Leaderboard";
import { getAdvocacyFeed } from "@/lib/advocacyFeed";
import { getTopAdvocates } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community — WaitingForPower",
  description:
    "Discuss permitting reform with people tracking stuck energy projects, see who's advocating for faster decisions, and the leaderboard of top advocates.",
  alternates: { canonical: "/activity" },
};

type CommunityTab = "board" | "advocating" | "leaders";
const TABS: { value: CommunityTab; label: string }[] = [
  { value: "board", label: "Board" },
  { value: "advocating", label: "Advocacy activity" },
  { value: "leaders", label: "Top advocates" },
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: CommunityTab = tabParam === "advocating" || tabParam === "leaders" ? tabParam : "board";

  const [{ items: topics, hasMore: topicsHasMore }, advocacyResult, leaders] = await Promise.all([
    tab === "board" ? getForumTopics(0, 20) : Promise.resolve({ items: [], hasMore: false }),
    tab === "advocating" ? getAdvocacyFeed(0, 20) : Promise.resolve({ items: [], hasMore: false }),
    tab === "leaders" ? getTopAdvocates(25) : Promise.resolve([]),
  ]);
  // Passed down instead of letting the feed components call `new Date()`
  // themselves — see ChangesFeed's `now` prop comment for the hydration
  // mismatch this fixes.
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Community</h1>

      <div className="flex justify-between sm:justify-start gap-2 sm:gap-6 border-b border-[var(--border)]" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "board" ? "/activity" : `/activity?tab=${t.value}`}
            role="tab"
            aria-selected={tab === t.value}
            className={`shrink-0 -mb-px px-0.5 pb-2.5 pt-1 max-[359px]:text-xs text-[13px] min-[400px]:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.value ? "border-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text-secondary)]"
            }`}
            style={tab === t.value ? { color: "var(--accent)" } : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "board" && (
        <>
          <NewTopicForm />
          <TopicList initialItems={topics} initialHasMore={topicsHasMore} now={now} />
        </>
      )}
      {tab === "advocating" && (
        <AdvocacyFeed initialItems={advocacyResult.items} initialHasMore={advocacyResult.hasMore} now={now} />
      )}
      {tab === "leaders" && <Leaderboard entries={leaders} />}
    </div>
  );
}
