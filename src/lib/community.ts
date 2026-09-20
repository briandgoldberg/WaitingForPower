// User-generated content: project comments, replies, likes, and the
// predictions that share the same thread. One identity (Predictor) covers all
// of it: an anonymous browser key plus a name that is asked for once and then
// locked, optionally upgraded to a saved email profile.
import { prisma } from "@/lib/db";
import { getOrCreateHumanPredictor, PredictionError } from "@/lib/predictions";

export const MAX_COMMENT_LENGTH = 1000;
const MAX_COMMENTS_PER_HOUR = 10;
const MAX_LIKES_PER_HOUR = 60;
const MAX_LINKS_PER_COMMENT = 2;
const MAX_THREAD_ROWS = 500;
// Agents can flood the home feed with bulk predictions; cap each agent's rows
// there so people's own words stay visible. (Not capped on a project page,
// which has at most one prediction per predictor.)
const MAX_AGENT_PREDICTIONS_IN_FEED = 3;

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

// One post in a project's thread: either a comment or a prediction (which may
// carry a reason). Both can be liked and replied to.
export interface DiscussionItem {
  kind: "prediction" | "comment";
  // The database id, used with `kind` for liking and replying.
  rawId: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  body: string | null;
  predictedDate: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: ReplyItem[];
}

export interface DiscussionSummary {
  predictionCount: number;
  peopleCount: number;
  agentCount: number;
  medianDate: string | null;
}

export interface Discussion {
  items: DiscussionItem[];
  summary: DiscussionSummary;
  // The caller's own prediction on this project, when they made one.
  myPredictedDate: string | null;
  // Who the caller is on this site, when they have posted before.
  me: { label: string; emailConfirmed: boolean; nameChosen: boolean; decided: boolean } | null;
}

export interface CommunityFeedItem {
  id: string;
  kind: "prediction" | "comment";
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  body: string | null;
  predictedDate: string | null;
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
  replyToPredictionId?: string;
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
  // post, so threads stay flat and readable.
  let parentId: string | null = null;
  let predictionId: string | null = null;
  if (params.parentCommentId) {
    const parent = await prisma.projectComment.findUnique({
      where: { id: params.parentCommentId },
      select: { id: true, projectId: true, parentId: true, predictionId: true },
    });
    if (!parent || parent.projectId !== project.id) throw new CommentError("not_found", "That comment is gone.");
    if (parent.parentId) parentId = parent.parentId;
    else if (parent.predictionId) predictionId = parent.predictionId;
    else parentId = parent.id;
  } else if (params.replyToPredictionId) {
    const prediction = await prisma.prediction.findUnique({
      where: { id: params.replyToPredictionId },
      select: { projectId: true },
    });
    if (!prediction || prediction.projectId !== project.id) throw new CommentError("not_found", "That prediction is gone.");
    predictionId = params.replyToPredictionId;
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
    data: { projectId: project.id, predictorId: predictor.id, body, parentId, predictionId },
  });
  return { comment, predictor };
}

// Like or unlike a comment or prediction. Needs only the anonymous key, so
// reacting never requires a name.
export async function toggleLike(params: { anonymousKey: string; kind: "comment" | "prediction"; targetId: string }) {
  const predictor = await prisma.predictor.upsert({
    where: { anonymousKey: params.anonymousKey },
    create: { anonymousKey: params.anonymousKey },
    update: {},
  });

  const targetExists =
    params.kind === "comment"
      ? await prisma.projectComment.findUnique({ where: { id: params.targetId }, select: { id: true } })
      : await prisma.prediction.findUnique({ where: { id: params.targetId }, select: { id: true } });
  if (!targetExists) throw new CommentError("not_found", "That post is gone.");

  const recentLikes = await prisma.threadLike.count({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  const target = params.kind === "comment" ? { commentId: params.targetId } : { predictionId: params.targetId };
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

function median(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : new Date((sorted[mid - 1].getTime() + sorted[mid].getTime()) / 2);
}

// A project's whole thread, newest first: comments and predictions as one
// list of posts, each with its likes and replies, plus the consensus summary
// and (when the caller identifies themselves) which posts they liked and
// what they predicted.
export async function getProjectDiscussion(projectId: string, anonymousKey?: string): Promise<Discussion> {
  const me = anonymousKey
    ? await prisma.predictor.findUnique({ where: { anonymousKey }, select: { id: true, displayName: true, email: true, nameChosenAt: true, identityDecidedAt: true } })
    : null;

  const predictorSelect = { select: { id: true, displayName: true, agentName: true, email: true, identityDecidedAt: true } } as const;
  // Posts from someone who hasn't yet chosen how to appear are held: only
  // they see them. AI agents' posts are always public.
  const visible = {
    OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }, ...(me ? [{ id: me.id }] : [])],
  };
  const [comments, predictions] = await Promise.all([
    prisma.projectComment.findMany({
      where: { projectId, predictor: visible },
      include: { predictor: predictorSelect },
      orderBy: { createdAt: "asc" },
      take: MAX_THREAD_ROWS,
    }),
    prisma.prediction.findMany({
      where: { projectId, predictor: visible },
      include: { predictor: predictorSelect },
      orderBy: { submittedAt: "asc" },
      take: MAX_THREAD_ROWS,
    }),
  ]);

  const commentIds = comments.map((c) => c.id);
  const predictionIds = predictions.map((p) => p.id);
  const [commentLikeCounts, predictionLikeCounts, myLikes] = await Promise.all([
    prisma.threadLike.groupBy({ by: ["commentId"], where: { commentId: { in: commentIds } }, _count: { _all: true } }),
    prisma.threadLike.groupBy({ by: ["predictionId"], where: { predictionId: { in: predictionIds } }, _count: { _all: true } }),
    me
      ? prisma.threadLike.findMany({
          where: { predictorId: me.id, OR: [{ commentId: { in: commentIds } }, { predictionId: { in: predictionIds } }] },
          select: { commentId: true, predictionId: true },
        })
      : Promise.resolve([] as { commentId: string | null; predictionId: string | null }[]),
  ]);

  const commentLikes = new Map(commentLikeCounts.map((r) => [r.commentId as string, r._count._all]));
  const predictionLikes = new Map(predictionLikeCounts.map((r) => [r.predictionId as string, r._count._all]));
  const likedComments = new Set(myLikes.map((l) => l.commentId).filter((x): x is string => x != null));
  const likedPredictions = new Set(myLikes.map((l) => l.predictionId).filter((x): x is string => x != null));

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
  const repliesByPrediction = new Map<string, ReplyItem[]>();
  for (const c of comments) {
    if (c.parentId) repliesByComment.set(c.parentId, [...(repliesByComment.get(c.parentId) ?? []), toReply(c)]);
    else if (c.predictionId) repliesByPrediction.set(c.predictionId, [...(repliesByPrediction.get(c.predictionId) ?? []), toReply(c)]);
  }

  const items: DiscussionItem[] = [
    ...comments
      .filter((c) => !c.parentId && !c.predictionId)
      .map((c) => ({
        kind: "comment" as const,
        rawId: c.id,
        label: labelOf(c.predictor),
        isAgent: c.predictor.agentName != null,
        ...flagsOf(c.predictor),
        pending: isHeld(c.predictor),
        body: c.body,
        predictedDate: null,
        createdAt: c.createdAt.toISOString(),
        likeCount: commentLikes.get(c.id) ?? 0,
        likedByMe: likedComments.has(c.id),
        replies: repliesByComment.get(c.id) ?? [],
      })),
    ...predictions.map((p) => ({
      kind: "prediction" as const,
      rawId: p.id,
      label: labelOf(p.predictor),
      isAgent: p.predictor.agentName != null,
      ...flagsOf(p.predictor),
      pending: isHeld(p.predictor),
      body: p.why,
      predictedDate: p.predictedDate.toISOString(),
      createdAt: p.submittedAt.toISOString(),
      likeCount: predictionLikes.get(p.id) ?? 0,
      likedByMe: likedPredictions.has(p.id),
      replies: repliesByPrediction.get(p.id) ?? [],
    })),
  ];
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const med = median(predictions.map((p) => p.predictedDate));
  const agentCount = predictions.filter((p) => p.predictor.agentName != null).length;
  const mine = me ? await prisma.prediction.findFirst({ where: { projectId, predictorId: me.id }, select: { predictedDate: true } }) : null;

  return {
    items,
    summary: {
      predictionCount: predictions.length,
      peopleCount: predictions.length - agentCount,
      agentCount,
      medianDate: med ? med.toISOString() : null,
    },
    myPredictedDate: mine ? mine.predictedDate.toISOString() : null,
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

// The home "What people think" feed: every comment, every human prediction,
// every prediction with a "why", and a few of each agent's own predictions.
// Each source is fetched to offset+limit rows so the merged top-K is exact.
export async function getCommunityFeed(offset = 0, limit = 20): Promise<{ items: CommunityFeedItem[]; hasMore: boolean }> {
  const need = offset + limit + 1;
  const projectSelect = { select: { slug: true, name: true } } as const;
  const predictorSelect = { select: { id: true, displayName: true, agentName: true, email: true } } as const;
  // Held posts (author hasn't chosen how to appear) stay out of the feed.
  const publicPoster = { OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }] };

  const agentTotals = await prisma.prediction.groupBy({
    by: ["predictorId"],
    where: { predictor: { agentName: { not: null } } },
    _count: { _all: true },
  });

  const [comments, peoplePredictions, agentPredictionSets] = await Promise.all([
    prisma.projectComment.findMany({
      where: { predictor: publicPoster },
      include: { predictor: predictorSelect, project: projectSelect },
      orderBy: { createdAt: "desc" },
      take: need,
    }),
    prisma.prediction.findMany({
      where: { AND: [{ OR: [{ why: { not: null } }, { predictor: { agentName: null } }] }, { predictor: publicPoster }] },
      include: { predictor: predictorSelect, project: projectSelect },
      orderBy: { submittedAt: "desc" },
      take: need,
    }),
    Promise.all(
      agentTotals.map((a) =>
        prisma.prediction.findMany({
          where: { predictorId: a.predictorId, why: null },
          include: { predictor: predictorSelect, project: projectSelect },
          orderBy: { submittedAt: "desc" },
          take: MAX_AGENT_PREDICTIONS_IN_FEED,
        }),
      ),
    ),
  ]);

  type PredictionRow = (typeof peoplePredictions)[number];
  const seen = new Set<string>();
  const toPredictionItem = (p: PredictionRow): CommunityFeedItem => ({
    id: `p_${p.id}`,
    kind: "prediction",
    label: labelOf(p.predictor),
    isAgent: p.predictor.agentName != null,
    ...flagsOf(p.predictor),
    body: p.why,
    predictedDate: p.predictedDate.toISOString(),
    createdAt: p.submittedAt.toISOString(),
    projectSlug: p.project.slug,
    projectName: p.project.name,
  });

  const items: CommunityFeedItem[] = [];
  for (const p of [...peoplePredictions, ...agentPredictionSets.flat()]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    items.push(toPredictionItem(p));
  }
  for (const c of comments) {
    items.push({
      id: `c_${c.id}`,
      kind: "comment",
      label: labelOf(c.predictor),
      isAgent: c.predictor.agentName != null,
      ...flagsOf(c.predictor),
      body: c.body,
      predictedDate: null,
      createdAt: c.createdAt.toISOString(),
      projectSlug: c.project.slug,
      projectName: c.project.name,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items: items.slice(offset, offset + limit), hasMore: items.length > offset + limit };
}
