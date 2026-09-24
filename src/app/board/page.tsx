import type { Metadata } from "next";
import { getForumTopics } from "@/lib/forum";
import { NewTopicForm } from "@/components/board/NewTopicForm";
import { TopicList } from "@/components/board/TopicList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Board | WaitingForPower",
  description: "Discuss permitting reform with people tracking stuck energy projects, as a guest or a confirmed name.",
  alternates: { canonical: "/board" },
};

export default async function BoardPage() {
  const { items, hasMore } = await getForumTopics(0, 20);
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Board</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-2xl">Discuss permitting reform with people tracking stuck projects.</p>
      </div>

      <NewTopicForm />

      <TopicList initialItems={items} initialHasMore={hasMore} now={now} />
    </div>
  );
}
