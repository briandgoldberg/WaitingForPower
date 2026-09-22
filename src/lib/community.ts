// User-generated content: project comments, replies and likes. One identity
// (Predictor) covers all of it: an anonymous browser key plus a name that is
// asked for once and then locked, optionally upgraded to a saved email
// profile. (Predictor is still the model name — this site used to also run a
// prediction game on the same identity; that feature is gone, the name
// stuck.)
import { prisma } from "@/lib/db";
import { getOrCreateHumanPredictor, PredictionError } from "@/lib/predictions";

export const MAX_COMMENT_LENGTH = 1000;
const MAX_COMMENTS_PER_HOUR = 10;
const MAX_LIKES_PER_HOUR = 60;
const MAX_LINKS_PER_COMMENT = 2;
const MAX_THREAD_ROWS = 500;

export class CommentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ReplyItem {
  id: string;
  label: string;
  isAgent: boolean;
  // A person with a confirmed email vs. an anonymous guest (agents are neither).
  confirmed: boolean;
  guest: boolean;
  // Held: the author hasn't yet chosen how to appear, so only they can see it.
  pending: boolean;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

// One post in a project's thread.
export interface DiscussionItem {
  // The database id, used for liking and replying.
  rawId: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  body: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: ReplyItem[];
}

export interface Discussion {
  items: DiscussionItem[];
  // Who the caller is on this site, when they have posted before.
  me: { label: string; emailConfirmed: boolean; nameChosen: boolean; decided: boolean } | null;
}

export interface CommunityFeedItem {
  id: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  body: string | null;
  createdAt: string;
  projectSlug: string;
  projectName: string;
}

function labelOf(p: { displayName: string | null; agentName: string | null }): string {
  return p.displayName ?? p.agentName ?? "anonymous";
}

function isHeld(p: { agentName: string | null; identityDecidedAt: Date | null }): boolean {
  return p.agentName == null && p.identityDecidedAt == null;
}

function flagsOf(p: { agentName: string | null; email: string | null }): { confirmed: boolean; guest: boolean } {
  const human = p.agentName == null;
  return { confirmed: human && p.email != null, guest: human && p.email == null };
}

export async function submitComment(params: {
  projectId: string;
  anonymousKey: string;
  body: string;
  parentCommentId?: string;
}) {
  const body = params.body.trim();
  if (!body) throw new CommentError("empty", "Write a comment first.");
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new CommentError("too_long", `Comments are limited to ${MAX_COMMENT_LENGTH} characters.`);
  }
  if ((body.match(/https?:\/\//gi) ?? []).length > MAX_LINKS_PER_COMMENT) {
    throw new CommentError("too_many_links", "Please keep it to two links or fewer.");
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId }, select: { id: true } });
  if (!project) throw new CommentError("not_found", "Project not found.");

  // Replies are one level deep: a reply to a reply attaches to the same top
  // comment, so threads stay flat and readable.
  let parentId: string | null = null;
  if (params.parentCommentId) {
    const parent = await prisma.projectComment.findUnique({
      where: { id: params.parentCommentId },
      select: { id: true, projectId: true, parentId: true },
    });
    if (!parent || parent.projectId !== project.id) throw new CommentError("not_found", "That comment is gone.");
    parentId = parent.parentId ?? parent.id;
  }

  let predictor;
  try {
    predictor = await getOrCreateHumanPredictor(params.anonymousKey);
  } catch (err) {
    if (err instanceof PredictionError) throw new CommentError(err.code, err.message);
    throw err;
  }

  const recent = await prisma.projectComment.findMany({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    select: { body: true, projectId: true },
  });
  if (recent.length >= MAX_COMMENTS_PER_HOUR) {
    throw new CommentError("rate_limited", "You're commenting a lot. Please try again in a bit.");
  }
  if (recent.some((r) => r.projectId === project.id && r.body === body)) {
    throw new CommentError("duplicate", "You already posted that.");
  }

  const comment = await prisma.projectComment.create({
    data: { projectId: project.id, predictorId: predictor.id, body, parentId },
  });
  return { comment, predictor };
}

// Like or unlike a comment. Needs only the anonymous key, so reacting never
// requires a name.
export async function toggleLike(params: { anonymousKey: string; targetId: string }) {
  const predictor = await prisma.predictor.upsert({
    where: { anonymousKey: params.anonymousKey },
    create: { anonymousKey: params.anonymousKey },
    update: {},
  });

  const targetExists = await prisma.projectComment.findUnique({ where: { id: params.targetId }, select: { id: true } });
  if (!targetExists) throw new CommentError("not_found", "That post is gone.");

  const recentLikes = await prisma.threadLike.count({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  const target = { commentId: params.targetId };
  const existing = await prisma.threadLike.findFirst({ where: { predictorId: predictor.id, ...target }, select: { id: true } });

  let liked: boolean;
  if (existing) {
    await prisma.threadLike.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    if (recentLikes >= MAX_LIKES_PER_HOUR) throw new CommentError("rate_limited", "Slow down a little.");
    await prisma.threadLike.create({ data: { predictorId: predictor.id, ...target } });
    liked = true;
  }
  const count = await prisma.threadLike.count({ where: target });
  return { liked, count };
}

// A project's whole comment thread, newest first, plus (when the caller
// identifies themselves) which posts they liked.
export async function getProjectDiscussion(projectId: string, anonymousKey?: string): Promise<Discussion> {
  const me = anonymousKey
    ? await prisma.predictor.findUnique({ where: { anonymousKey }, select: { id: true, displayName: true, email: true, nameChosenAt: true, identityDecidedAt: true } })
    : null;

  const predictorSelect = { select: { id: true, displayName: true, agentName: true, email: true, identityDecidedAt: true } } as const;
  // Posts from someone who hasn't yet chosen how to appear are held: nobody
  // sees them, the author included, until they decide. AI agents' posts are
  // always public.
  const visible = {
    OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }],
  };
  const comments = await prisma.projectComment.findMany({
    where: { projectId, predictor: visible },
    include: { predictor: predictorSelect },
    orderBy: { createdAt: "asc" },
    take: MAX_THREAD_ROWS,
  });

  const commentIds = comments.map((c) => c.id);
  const [commentLikeCounts, myLikes] = await Promise.all([
    prisma.threadLike.groupBy({ by: ["commentId"], where: { commentId: { in: commentIds } }, _count: { _all: true } }),
    me
      ? prisma.threadLike.findMany({ where: { predictorId: me.id, commentId: { in: commentIds } }, select: { commentId: true } })
      : Promise.resolve([] as { commentId: string | null }[]),
  ]);

  const commentLikes = new Map(commentLikeCounts.map((r) => [r.commentId as string, r._count._all]));
  const likedComments = new Set(myLikes.map((l) => l.commentId).filter((x): x is string => x != null));

  const toReply = (c: (typeof comments)[number]): ReplyItem => ({
    id: c.id,
    label: labelOf(c.predictor),
    isAgent: c.predictor.agentName != null,
    ...flagsOf(c.predictor),
    pending: isHeld(c.predictor),
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    likeCount: commentLikes.get(c.id) ?? 0,
    likedByMe: likedComments.has(c.id),
  });

  const repliesByComment = new Map<string, ReplyItem[]>();
  for (const c of comments) {
    if (c.parentId) repliesByComment.set(c.parentId, [...(repliesByComment.get(c.parentId) ?? []), toReply(c)]);
  }

  const items: DiscussionItem[] = comments
    .filter((c) => !c.parentId)
    .map((c) => ({
      rawId: c.id,
      label: labelOf(c.predictor),
      isAgent: c.predictor.agentName != null,
      ...flagsOf(c.predictor),
      pending: isHeld(c.predictor),
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      likeCount: commentLikes.get(c.id) ?? 0,
      likedByMe: likedComments.has(c.id),
      replies: repliesByComment.get(c.id) ?? [],
    }));
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    items,
    me: me
      ? {
          label: me.displayName ?? "Anonymous",
          emailConfirmed: me.email != null,
          nameChosen: me.nameChosenAt != null,
          decided: me.identityDecidedAt != null,
        }
      : null,
  };
}

// The home "Recent changes" feed's companion: every public comment, most
// recent first.
export async function getCommunityFeed(offset = 0, limit = 20): Promise<{ items: CommunityFeedItem[]; hasMore: boolean }> {
  const need = offset + limit + 1;
  const projectSelect = { select: { slug: true, name: true } } as const;
  const predictorSelect = { select: { id: true, displayName: true, agentName: true, email: true } } as const;
  // Held posts (author hasn't chosen how to appear) stay out of the feed.
  const publicPoster = { OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }] };

  const comments = await prisma.projectComment.findMany({
    where: { predictor: publicPoster },
    include: { predictor: predictorSelect, project: projectSelect },
    orderBy: { createdAt: "desc" },
    take: need,
  });

  const items: CommunityFeedItem[] = comments.map((c) => ({
    id: c.id,
    label: labelOf(c.predictor),
    isAgent: c.predictor.agentName != null,
    ...flagsOf(c.predictor),
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    projectSlug: c.project.slug,
    projectName: c.project.name,
  }));

  return { items: items.slice(offset, offset + limit), hasMore: items.length > offset + limit };
}
