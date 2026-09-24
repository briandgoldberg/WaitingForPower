// The Message Board: open discussion about permitting-reform issues, tagged
// by 1+ of the six national policy issues (same slugs as
// AdvocacyContact.issues). Deliberately separate from the structured
// "I Advocated"/"I Reached Out!" log — this is free-form conversation, not a
// verified civic action, so it never earns points or shows on the
// leaderboard (see src/lib/leaderboard.ts, which only reads ProjectComment
// and AdvocacyContact). Same identity system as everywhere else on the site.

import { prisma } from "@/lib/db";
import { getOrCreateHumanPredictor, PredictionError } from "@/lib/predictions";
import { labelOf, flagsOf, isHeld } from "@/lib/community";
import { POLICIES } from "@/lib/data/policies";

export const MAX_TITLE_LENGTH = 140;
export const MAX_BODY_LENGTH = 2000;
const MAX_REPLY_LENGTH = 1000;
const MAX_ISSUES = 8;
const MAX_LINKS = 2;
const MAX_TOPICS_PER_HOUR = 5;
const MAX_REPLIES_PER_HOUR = 20;
// Same six reform issues shown on the National Advocacy tab, not every
// CauseSlug — see advocacyContacts.ts for the identical restriction.
const VALID_ISSUE_SLUGS = new Set<string>([...POLICIES.map((p) => p.slug), "other"]);

function countLinks(s: string): number {
  return (s.match(/https?:\/\//gi) ?? []).length;
}

export class ForumError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ForumReplyItem {
  id: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  body: string;
  createdAt: string;
}

export interface ForumTopicItem {
  id: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  title: string;
  body: string;
  issues: string[];
  createdAt: string;
  replyCount: number;
}

export interface ForumTopicDetail extends ForumTopicItem {
  replies: ForumReplyItem[];
}

const publicPoster = { OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }] };
const predictorSelect = {
  select: { id: true, displayName: true, agentName: true, email: true, identityDecidedAt: true },
} as const;

export async function submitTopic(params: { anonymousKey: string; title: string; body: string; issues: string[] }) {
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title) throw new ForumError("empty_title", "Give your topic a title.");
  if (title.length > MAX_TITLE_LENGTH) throw new ForumError("title_too_long", `Titles are limited to ${MAX_TITLE_LENGTH} characters.`);
  if (!body) throw new ForumError("empty_body", "Write something first.");
  if (body.length > MAX_BODY_LENGTH) throw new ForumError("too_long", `Posts are limited to ${MAX_BODY_LENGTH} characters.`);
  if (countLinks(body) > MAX_LINKS) throw new ForumError("too_many_links", "Please keep it to two links or fewer.");

  const issues = [...new Set(params.issues)].filter((i) => VALID_ISSUE_SLUGS.has(i));
  if (issues.length > MAX_ISSUES) throw new ForumError("too_many_issues", "Pick fewer issues.");

  let predictor;
  try {
    predictor = await getOrCreateHumanPredictor(params.anonymousKey);
  } catch (err) {
    if (err instanceof PredictionError) throw new ForumError(err.code, err.message);
    throw err;
  }

  const recentCount = await prisma.forumTopic.count({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentCount >= MAX_TOPICS_PER_HOUR) {
    throw new ForumError("rate_limited", "You're posting a lot. Please try again in a bit.");
  }

  const topic = await prisma.forumTopic.create({ data: { predictorId: predictor.id, title, body, issues } });
  return { topic, predictor };
}

export async function submitReply(params: { anonymousKey: string; topicId: string; body: string }) {
  const body = params.body.trim();
  if (!body) throw new ForumError("empty", "Write a reply first.");
  if (body.length > MAX_REPLY_LENGTH) throw new ForumError("too_long", `Replies are limited to ${MAX_REPLY_LENGTH} characters.`);
  if (countLinks(body) > MAX_LINKS) throw new ForumError("too_many_links", "Please keep it to two links or fewer.");

  const topic = await prisma.forumTopic.findUnique({ where: { id: params.topicId }, select: { id: true } });
  if (!topic) throw new ForumError("not_found", "That topic is gone.");

  let predictor;
  try {
    predictor = await getOrCreateHumanPredictor(params.anonymousKey);
  } catch (err) {
    if (err instanceof PredictionError) throw new ForumError(err.code, err.message);
    throw err;
  }

  const recentCount = await prisma.forumReply.count({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentCount >= MAX_REPLIES_PER_HOUR) {
    throw new ForumError("rate_limited", "You're replying a lot. Please try again in a bit.");
  }

  const reply = await prisma.forumReply.create({ data: { topicId: topic.id, predictorId: predictor.id, body } });
  return { reply, predictor };
}

// Topic list, newest first — the Message Board's index page.
export async function getForumTopics(offset = 0, limit = 20): Promise<{ items: ForumTopicItem[]; hasMore: boolean }> {
  const need = offset + limit + 1;
  const rows = await prisma.forumTopic.findMany({
    where: { predictor: publicPoster },
    include: { predictor: predictorSelect, _count: { select: { replies: true } } },
    orderBy: { createdAt: "desc" },
    take: need,
  });

  const items: ForumTopicItem[] = rows.map((t) => ({
    id: t.id,
    label: labelOf(t.predictor),
    isAgent: t.predictor.agentName != null,
    ...flagsOf(t.predictor),
    pending: isHeld(t.predictor),
    title: t.title,
    body: t.body,
    issues: t.issues,
    createdAt: t.createdAt.toISOString(),
    replyCount: t._count.replies,
  }));
  return { items: items.slice(offset, offset + limit), hasMore: items.length > offset + limit };
}

// One topic and its replies, oldest first (so a thread reads top to bottom).
export async function getForumTopic(id: string): Promise<ForumTopicDetail | null> {
  const t = await prisma.forumTopic.findUnique({
    where: { id },
    include: {
      predictor: predictorSelect,
      replies: { include: { predictor: predictorSelect }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) return null;
  // A held topic (author hasn't decided how to appear) is invisible to
  // everyone but its own author — same rule as a project's "I Advocated"
  // log. The API layer doesn't currently distinguish "held from me" vs
  // "held from someone else", so it's simply not shown at all here.
  if (isHeld(t.predictor)) return null;

  return {
    id: t.id,
    label: labelOf(t.predictor),
    isAgent: t.predictor.agentName != null,
    ...flagsOf(t.predictor),
    pending: false,
    title: t.title,
    body: t.body,
    issues: t.issues,
    createdAt: t.createdAt.toISOString(),
    replyCount: t.replies.length,
    replies: t.replies.map((r) => ({
      id: r.id,
      label: labelOf(r.predictor),
      isAgent: r.predictor.agentName != null,
      ...flagsOf(r.predictor),
      pending: isHeld(r.predictor),
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

// Newest topics only (not replies) — feeds the home page's merged advocacy
// activity feed alongside ProjectComment/AdvocacyContact entries.
export async function getRecentForumTopics(limit: number) {
  const rows = await prisma.forumTopic.findMany({
    where: { predictor: publicPoster },
    include: { predictor: predictorSelect, _count: { select: { replies: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((t) => ({
    id: t.id,
    label: labelOf(t.predictor),
    isAgent: t.predictor.agentName != null,
    ...flagsOf(t.predictor),
    pending: isHeld(t.predictor),
    title: t.title,
    body: t.body,
    issues: t.issues,
    createdAt: t.createdAt.toISOString(),
    replyCount: t._count.replies,
  }));
}
