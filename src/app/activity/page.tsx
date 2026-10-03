import type { Metadata } from "next";
import { getForumTopics } from "@/lib/forum";
import { NewTopicForm } from "@/components/board/NewTopicForm";
import { TopicList } from "@/components/board/TopicList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community — WaitingForPower",
  description: "Discuss permitting reform with people tracking stuck energy projects — tag a topic to a utility to also surface it on that utility's page, or post without one.",
  alternates: { canonical: "/activity" },
};

export default async function ActivityPage() {
  const { items: topics, hasMore: topicsHasMore } = await getForumTopics(0, 20);
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Community</h1>

      <NewTopicForm />
      <TopicList initialItems={topics} initialHasMore={topicsHasMore} now={now} />
    </div>
  );
}
