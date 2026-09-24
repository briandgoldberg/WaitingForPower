// User-generated content: project comments, replies and likes. One identity
// (Predictor) covers all of it: an anonymous browser key plus a name that is
// asked for once and then locked, optionally upgraded to a saved email
// profile. (Predictor is still the model name — this site used to also run a
// prediction game on the same identity; that feature is gone, the name
// stuck.)
import { prisma } from "@/lib/db";
import { getOrCreateHumanPredictor, getOrCreateAgentPredictor, PredictionError } from "@/lib/predictions";
import { ADVOCACY_TYPES, HEARING_LOOKBACK_DAYS, STANCES, type AdvocacyType, type Stance } from "@/lib/data/advocacyPoints";

export interface IdentityStatus {
  label: string;
  emailConfirmed: boolean;
  nameChosen: boolean;
  decided: boolean;
}

// The same "who is posting, and have they decided how to appear" check
// Discussion.me computes inline below, factored out so any UGC surface that
// isn't scoped to one project (e.g. AdvocacyContactForm) can ask the same
// question via GET /api/identity. Never creates a Predictor row — only
// actually posting does that (see submitComment/submitAdvocacyContact) — so
// a first-time visitor who hasn't posted anything yet gets null, not a
// freshly minted row.
export async function getIdentityStatus(anonymousKey: string): Promise<IdentityStatus | null> {
  const me = await prisma.predictor.findUnique({
    where: { anonymousKey },
    select: { displayName: true, email: true, nameChosenAt: true, identityDecidedAt: true },
  });
  if (!me) return null;
  return {
    label: me.displayName ?? "Anonymous",
    emailConfirmed: me.email != null,
    nameChosen: me.nameChosenAt != null,
    decided: me.identityDecidedAt != null,
  };
}

export const MAX_COMMENT_LENGTH = 1000;
const MAX_COMMENTS_PER_HOUR = 10;
// Agents get a much tighter per-identity cap than humans — this is on top
// of, not instead of, the IP-based limit at the MCP route layer (see
// src/app/mcp/route.ts) that stops a script from dodging this exact cap by
// minting a fresh agentName on every call.
const MAX_AGENT_COMMENTS_PER_HOUR = 3;
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
  advocacyType: AdvocacyType | null;
  hearingDate: string | null;
  stance: Stance | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

// One post in a project's thread — now always a structured "I Advocated"
// entry (advocacyType set) going forward; null only on legacy rows from
// before that existed.
export interface DiscussionItem {
  // The database id, used for liking and replying.
  rawId: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  body: string | null;
  advocacyType: AdvocacyType | null;
  hearingDate: string | null;
  stance: Stance | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: ReplyItem[];
}

export interface Discussion {
  items: DiscussionItem[];
  // Who the caller is on this site, when they have posted before.
  me: { label: string; emailConfirmed: boolean; nameChosen: boolean; decided: boolean } | null;
  // Tally across every visible entry with a stance — the project page's
  // approve/deny summary bar (see ProjectDiscussion.tsx).
  stanceTally: { approve: number; deny: number };
}

export interface CommunityFeedItem {
  id: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  body: string | null;
  advocacyType: AdvocacyType | null;
  hearingDate: string | null;
  stance: Stance | null;
  createdAt: string;
  projectSlug: string;
  projectName: string;
}

// Exported for src/lib/advocacyFeed.ts and src/lib/advocacyContacts.ts, so
// every UGC surface renders identity the exact same way.
export function labelOf(p: { displayName: string | null; agentName: string | null }): string {
  return p.displayName ?? p.agentName ?? "anonymous";
}

export function isHeld(p: { agentName: string | null; identityDecidedAt: Date | null }): boolean {
  return p.agentName == null && p.identityDecidedAt == null;
}

export function flagsOf(p: { agentName: string | null; email: string | null }): { confirmed: boolean; guest: boolean } {
  const human = p.agentName == null;
  return { confirmed: human && p.email != null, guest: human && p.email == null };
}

export async function submitComment(params: {
  projectId: string;
  // Exactly one of these two identifies the poster — anonymousKey for a
  // human (browser), agentName for an MCP-connected agent (see
  // getOrCreateAgentPredictor; always public, always isAgent-labeled, no
  // held/guest/confirmed distinction).
  anonymousKey?: string;
  agentName?: string;
  body: string;
  parentCommentId?: string;
  advocacyType?: AdvocacyType;
  hearingDate?: string;
  stance?: Stance;
}) {
  const body = params.body.trim();
  const advocacyType = params.advocacyType;
  // A structured "I Advocated" entry only needs its type; the note is
  // optional. A plain (legacy-shaped) post still needs real text.
  if (!body && !advocacyType) throw new CommentError("empty", "Write a comment first.");
  if (advocacyType && !ADVOCACY_TYPES.includes(advocacyType)) {
    throw new CommentError("invalid", "That's not a valid advocacy type.");
  }
  // Every structured entry must say which way it's advocating — that's the
  // whole point of logging it.
  if (advocacyType && !params.stance) throw new CommentError("missing_stance", "Say whether you support approving or denying this.");
  if (params.stance && !STANCES.includes(params.stance)) throw new CommentError("invalid_stance", "That's not a valid stance.");
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new CommentError("too_long", `Comments are limited to ${MAX_COMMENT_LENGTH} characters.`);
  }
  if ((body.match(/https?:\/\//gi) ?? []).length > MAX_LINKS_PER_COMMENT) {
    throw new CommentError("too_many_links", "Please keep it to two links or fewer.");
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, hearings: { select: { date: true } } },
  });
  if (!project) throw new CommentError("not_found", "Project not found.");

  // "Attended a hearing" must point at one of this project's own real
  // hearing dates — never free text — and that hearing must actually have
  // happened already, recently, not be claimed in advance or from long ago.
  let hearingDate: Date | null = null;
  if (advocacyType === "attended_hearing") {
    if (!params.hearingDate) throw new CommentError("missing_hearing", "Pick which hearing you attended.");
    const candidate = new Date(params.hearingDate);
    const matches = project.hearings.some((h) => h.date.getTime() === candidate.getTime());
    if (!matches) throw new CommentError("invalid_hearing", "That's not one of this project's hearings.");
    const now = Date.now();
    const lookbackMs = HEARING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    if (candidate.getTime() > now) throw new CommentError("hearing_not_past", "That hearing hasn't happened yet.");
    if (candidate.getTime() < now - lookbackMs) {
      throw new CommentError("hearing_too_old", `Only hearings from the last ${HEARING_LOOKBACK_DAYS} days can be logged.`);
    }
    hearingDate = candidate;
  }

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

  if (!params.anonymousKey && !params.agentName) {
    throw new CommentError("missing_identity", "No identity provided.");
  }
  let predictor;
  try {
    predictor = params.agentName ? await getOrCreateAgentPredictor(params.agentName) : await getOrCreateHumanPredictor(params.anonymousKey!);
  } catch (err) {
    if (err instanceof PredictionError) throw new CommentError(err.code, err.message);
    throw err;
  }

  const recent = await prisma.projectComment.findMany({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    select: { body: true, projectId: true, advocacyType: true },
  });
  const hourlyCap = params.agentName ? MAX_AGENT_COMMENTS_PER_HOUR : MAX_COMMENTS_PER_HOUR;
  if (recent.length >= hourlyCap) {
    throw new CommentError("rate_limited", "You're commenting a lot. Please try again in a bit.");
  }
  // Same project, same kind of entry (or same free text for a legacy plain
  // comment), within the hour — a duplicate submit, not a second real action.
  if (recent.some((r) => r.projectId === project.id && r.advocacyType === (advocacyType ?? null) && r.body === body)) {
    throw new CommentError("duplicate", advocacyType ? "You already logged that for this project." : "You already posted that.");
  }

  const comment = await prisma.projectComment.create({
    data: { projectId: project.id, predictorId: predictor.id, body, parentId, advocacyType, hearingDate, stance: params.stance },
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
    advocacyType: c.advocacyType as AdvocacyType | null,
    hearingDate: c.hearingDate ? c.hearingDate.toISOString() : null,
    stance: c.stance as Stance | null,
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
      advocacyType: c.advocacyType as AdvocacyType | null,
      hearingDate: c.hearingDate ? c.hearingDate.toISOString() : null,
      stance: c.stance as Stance | null,
      createdAt: c.createdAt.toISOString(),
      likeCount: commentLikes.get(c.id) ?? 0,
      likedByMe: likedComments.has(c.id),
      replies: repliesByComment.get(c.id) ?? [],
    }));
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const stanceTally = { approve: 0, deny: 0 };
  for (const c of comments) {
    if (c.stance === "approve") stanceTally.approve++;
    else if (c.stance === "deny") stanceTally.deny++;
  }

  return {
    items,
    stanceTally,
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
    // Legacy free-form rows (predate advocacyType) don't belong in a feed
    // now framed entirely around structured advocacy actions.
    where: { predictor: publicPoster, advocacyType: { not: null } },
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
    advocacyType: c.advocacyType as AdvocacyType | null,
    hearingDate: c.hearingDate ? c.hearingDate.toISOString() : null,
    stance: c.stance as Stance | null,
    createdAt: c.createdAt.toISOString(),
    projectSlug: c.project.slug,
    projectName: c.project.name,
  }));

  return { items: items.slice(offset, offset + limit), hasMore: items.length > offset + limit };
}
