// User-generated content: free-form project comments, plus predictions that
// carry a "why". One identity (Predictor) covers both — anonymous browser key
// plus a required nickname, optionally upgraded to a saved email profile.
import { prisma } from "@/lib/db";
import { getOrCreateHumanPredictor, PredictionError } from "@/lib/predictions";

export const MAX_COMMENT_LENGTH = 1000;
const MAX_COMMENTS_PER_HOUR = 10;
const MAX_LINKS_PER_COMMENT = 2;
// Agents can flood the feed with bulk predictions; cap each agent's rows so
// people's own words stay visible.
const MAX_AGENT_PREDICTIONS_IN_FEED = 3;

export class CommentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface DiscussionItem {
  id: string;
  kind: "prediction" | "comment";
  label: string;
  isAgent: boolean;
  body: string | null;
  predictedDate: string | null;
  createdAt: string;
}

export interface CommunityFeedItem extends DiscussionItem {
  projectSlug: string;
  projectName: string;
}

function labelOf(p: { displayName: string | null; agentName: string | null }): string {
  return p.displayName ?? p.agentName ?? "anonymous";
}

export async function submitComment(params: {
  projectId: string;
  anonymousKey: string;
  displayName: string;
  body: string;
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

  let predictor;
  try {
    predictor = await getOrCreateHumanPredictor(params.anonymousKey, params.displayName);
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
    data: { projectId: project.id, predictorId: predictor.id, body },
  });
  return { comment, predictor };
}

// Everything people have said on one project, newest first: free comments
// plus predictions that included a "why".
export async function getProjectDiscussion(projectId: string, limit = 100): Promise<DiscussionItem[]> {
  const [comments, predictions] = await Promise.all([
    prisma.projectComment.findMany({
      where: { projectId },
      include: { predictor: { select: { displayName: true, agentName: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.prediction.findMany({
      where: { projectId, why: { not: null } },
      include: { predictor: { select: { displayName: true, agentName: true } } },
      orderBy: { submittedAt: "desc" },
      take: limit,
    }),
  ]);

  const items: DiscussionItem[] = [
    ...comments.map((c) => ({
      id: `c_${c.id}`,
      kind: "comment" as const,
      label: labelOf(c.predictor),
      isAgent: c.predictor.agentName != null,
      body: c.body,
      predictedDate: null,
      createdAt: c.createdAt.toISOString(),
    })),
    ...predictions.map((p) => ({
      id: `p_${p.id}`,
      kind: "prediction" as const,
      label: labelOf(p.predictor),
      isAgent: p.predictor.agentName != null,
      body: p.why,
      predictedDate: p.predictedDate.toISOString(),
      createdAt: p.submittedAt.toISOString(),
    })),
  ];
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.slice(0, limit);
}

// The home "What people think" feed: every comment, every human prediction,
// every prediction with a "why", and a few of each agent's own predictions.
// Each source is fetched to offset+limit rows so the merged top-K is exact.
export async function getCommunityFeed(offset = 0, limit = 20): Promise<{ items: CommunityFeedItem[]; hasMore: boolean }> {
  const need = offset + limit + 1;
  const projectSelect = { select: { slug: true, name: true } } as const;
  const predictorSelect = { select: { id: true, displayName: true, agentName: true } } as const;

  const agentTotals = await prisma.prediction.groupBy({
    by: ["predictorId"],
    where: { predictor: { agentName: { not: null } } },
    _count: { _all: true },
  });

  const [comments, peoplePredictions, agentPredictionSets] = await Promise.all([
    prisma.projectComment.findMany({
      include: { predictor: predictorSelect, project: projectSelect },
      orderBy: { createdAt: "desc" },
      take: need,
    }),
    prisma.prediction.findMany({
      where: { OR: [{ why: { not: null } }, { predictor: { agentName: null } }] },
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
