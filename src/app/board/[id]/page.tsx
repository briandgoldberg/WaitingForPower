import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumTopic, type ForumReplyItem } from "@/lib/forum";
import { PosterBadge } from "@/components/PosterBadge";
import { issueLabel } from "@/lib/data/policies";
import { ReplyForm } from "@/components/board/ReplyForm";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const topic = await getForumTopic(id);
  if (!topic) return {};
  return {
    title: `${topic.title} | Board | WaitingForPower`,
    description: topic.body.slice(0, 200),
    alternates: { canonical: `/board/${id}` },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = await getForumTopic(id);
  if (!topic) notFound();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <Link href="/board" className="text-xs text-[var(--muted)] hover:underline w-fit">
        ← Board
      </Link>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-2.5">
        <h1 className="text-lg font-semibold leading-snug break-words">{topic.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold">{topic.label}</span>
          <PosterBadge isAgent={topic.isAgent} confirmed={topic.confirmed} guest={topic.guest} />
          <span className="text-[var(--muted)]">· {fmt(topic.createdAt)}</span>
        </div>
        {topic.issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topic.issues.map((slug) => (
              <span key={slug} className="text-[10px] rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted)]">
                {issueLabel(slug)}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">{topic.body}</p>
      </div>

      {topic.replies.length > 0 && (
        <ul className="flex flex-col gap-3">
          {topic.replies.map((reply) => (
            <ReplyRow key={reply.id} reply={reply} />
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="text-sm font-semibold mb-2">{topic.replyCount > 0 ? `Reply (${topic.replyCount})` : "Be the first to reply"}</h2>
        <ReplyForm topicId={topic.id} />
      </div>
    </div>
  );
}

function ReplyRow({ reply }: { reply: ForumReplyItem }) {
  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold">{reply.label}</span>
        <PosterBadge isAgent={reply.isAgent} confirmed={reply.confirmed} guest={reply.guest} />
        <span className="text-[var(--muted)]">· {fmt(reply.createdAt)}</span>
      </div>
      <p className="mt-1 text-[var(--text-secondary)] whitespace-pre-wrap break-words">{reply.body}</p>
    </li>
  );
}
