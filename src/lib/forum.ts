// The Message Board: open discussion, optionally tagged with 1+ of the six
// national policy issues, a utility company, and/or a specific project —
// any combination, or none. Same identity system as everywhere else on the
// site (see src/lib/community.ts).

import { prisma } from "@/lib/db";
import { getOrCreateHumanPredictor, getOrCreateAgentPredictor, PredictionError } from "@/lib/predictions";
import { labelOf, flagsOf, isHeld } from "@/lib/community";
import { POLICIES } from "@/lib/data/policies";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";
import { DEFAULT_FILTERS } from "@/lib/filters";

export const MAX_TITLE_LENGTH = 140;
export const MAX_BODY_LENGTH = 2000;
const MAX_REPLY_LENGTH = 1000;
const MAX_ISSUES = 8;
const MAX_LINKS = 2;
const MAX_TOPICS_PER_HOUR = 5;
const MAX_REPLIES_PER_HOUR = 20;
// Much tighter for an agent identity — see community.ts's matching
// constant for why (and src/app/mcp/route.ts for the IP-based layer on top).
const MAX_AGENT_TOPICS_PER_HOUR = 2;
const MAX_AGENT_REPLIES_PER_HOUR = 5;
// Same six reform issues shown on the National Advocacy tab, not every
// CauseSlug.
const VALID_ISSUE_SLUGS = new Set<string>([...POLICIES.map((p) => p.slug), "other"]);

function countLinks(s: string): number {
  return (s.match(/https?:\/\//gi) ?? []).length;
}

// Utilities aren't a DB table — validated against the live-computed slug
// set, same idea as VALID_ISSUE_SLUGS above but derived from project data
// instead of a static list. Re-grouping the whole dataset per submission is
// the same cost /utility/[slug]'s own lookup already pays; topic posting is
// rate-limited (see MAX_TOPICS_PER_HOUR below), so this stays infrequent.
async function isValidUtilitySlug(slug: string): Promise<boolean> {
  const projects = await queryProjects(toFilterState(DEFAULT_FILTERS));
  return groupProjectsByUtility(projects).some((g) => g.slug === slug);
}

async function findProjectByTagSlug(slug: string): Promise<{ slug: string; name: string } | null> {
  const project = await prisma.project.findUnique({ where: { slug }, select: { slug: true, name: true, mergedIntoId: true } });
  if (!project || project.mergedIntoId) return null;
  return { slug: project.slug, name: project.name };
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
  utilitySlug: string | null;
  projectSlug: string | null;
  projectName: string | null;
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

export async function submitTopic(params: {
  anonymousKey?: string;
  agentName?: string;
  title: string;
  body: string;
  issues: string[];
  utilitySlug?: string | null;
  projectSlug?: string | null;
}) {
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title) throw new ForumError("empty_title", "Give your topic a title.");
  if (title.length > MAX_TITLE_LENGTH) throw new ForumError("title_too_long", `Titles are limited to ${MAX_TITLE_LENGTH} characters.`);
  if (!body) throw new ForumError("empty_body", "Write something first.");
  if (body.length > MAX_BODY_LENGTH) throw new ForumError("too_long", `Posts are limited to ${MAX_BODY_LENGTH} characters.`);
  if (countLinks(body) > MAX_LINKS) throw new ForumError("too_many_links", "Please keep it to two links or fewer.");

  const issues = [...new Set(params.issues)].filter((i) => VALID_ISSUE_SLUGS.has(i));
  if (issues.length > MAX_ISSUES) throw new ForumError("too_many_issues", "Pick fewer issues.");

  const utilitySlug = params.utilitySlug?.trim() || null;
  if (utilitySlug && !(await isValidUtilitySlug(utilitySlug))) {
    throw new ForumError("invalid_utility", "That's not a utility we track.");
  }

  const projectSlugInput = params.projectSlug?.trim() || null;
  const taggedProject = projectSlugInput ? await findProjectByTagSlug(projectSlugInput) : null;
  if (projectSlugInput && !taggedProject) {
    throw new ForumError("invalid_project", "That's not a project we track.");
  }

  if (!params.anonymousKey && !params.agentName) throw new ForumError("missing_identity", "No identity provided.");
  let predictor;
  try {
    predictor = params.agentName ? await getOrCreateAgentPredictor(params.agentName) : await getOrCreateHumanPredictor(params.anonymousKey!);
  } catch (err) {
    if (err instanceof PredictionError) throw new ForumError(err.code, err.message);
    throw err;
  }

  const recentCount = await prisma.forumTopic.count({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  const hourlyCap = params.agentName ? MAX_AGENT_TOPICS_PER_HOUR : MAX_TOPICS_PER_HOUR;
  if (recentCount >= hourlyCap) {
    throw new ForumError("rate_limited", "You're posting a lot. Please try again in a bit.");
  }

  const topic = await prisma.forumTopic.create({
    data: { predictorId: predictor.id, title, body, issues, utilitySlug, projectSlug: taggedProject?.slug ?? null },
  });
  return { topic, predictor };
}

export async function submitReply(params: { anonymousKey?: string; agentName?: string; topicId: string; body: string }) {
  const body = params.body.trim();
  if (!body) throw new ForumError("empty", "Write a reply first.");
  if (body.length > MAX_REPLY_LENGTH) throw new ForumError("too_long", `Replies are limited to ${MAX_REPLY_LENGTH} characters.`);
  if (countLinks(body) > MAX_LINKS) throw new ForumError("too_many_links", "Please keep it to two links or fewer.");

  const topic = await prisma.forumTopic.findUnique({ where: { id: params.topicId }, select: { id: true } });
  if (!topic) throw new ForumError("not_found", "That topic is gone.");

  if (!params.anonymousKey && !params.agentName) throw new ForumError("missing_identity", "No identity provided.");
  let predictor;
  try {
    predictor = params.agentName ? await getOrCreateAgentPredictor(params.agentName) : await getOrCreateHumanPredictor(params.anonymousKey!);
  } catch (err) {
    if (err instanceof PredictionError) throw new ForumError(err.code, err.message);
    throw err;
  }

  const recentCount = await prisma.forumReply.count({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  const hourlyCap = params.agentName ? MAX_AGENT_REPLIES_PER_HOUR : MAX_REPLIES_PER_HOUR;
  if (recentCount >= hourlyCap) {
    throw new ForumError("rate_limited", "You're replying a lot. Please try again in a bit.");
  }

  const reply = await prisma.forumReply.create({ data: { topicId: topic.id, predictorId: predictor.id, body } });
  return { reply, predictor };
}

// Topic list, newest first — the Message Board's index page. Pass
// utilitySlug to scope to one utility's own board section instead
// (src/app/utility/[slug]/page.tsx) — same table, just filtered.
export async function getForumTopics(
  offset = 0,
  limit = 20,
  opts: { utilitySlug?: string } = {},
): Promise<{ items: ForumTopicItem[]; hasMore: boolean }> {
  const need = offset + limit + 1;
  const rows = await prisma.forumTopic.findMany({
    where: { predictor: publicPoster, ...(opts.utilitySlug ? { utilitySlug: opts.utilitySlug } : {}) },
    include: { predictor: predictorSelect, _count: { select: { replies: true } } },
    orderBy: { createdAt: "desc" },
    take: need,
  });

  // One batched lookup for every tagged project's current name, rather than
  // N+1 — most pages of topics tag only a handful of distinct projects.
  const projectSlugs = [...new Set(rows.map((t) => t.projectSlug).filter((s): s is string => s != null))];
  const projectNameBySlug =
    projectSlugs.length > 0
      ? new Map(
          (await prisma.project.findMany({ where: { slug: { in: projectSlugs } }, select: { slug: true, name: true } })).map((p) => [p.slug, p.name]),
        )
      : new Map<string, string>();

  const items: ForumTopicItem[] = rows.map((t) => ({
    id: t.id,
    label: labelOf(t.predictor),
    isAgent: t.predictor.agentName != null,
    ...flagsOf(t.predictor),
    pending: isHeld(t.predictor),
    title: t.title,
    body: t.body,
    issues: t.issues,
    utilitySlug: t.utilitySlug,
    projectSlug: t.projectSlug,
    projectName: t.projectSlug ? (projectNameBySlug.get(t.projectSlug) ?? null) : null,
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
      // Same rule as a project's "I Advocated" log (community.ts,
      // getProjectDiscussion): a held post is invisible to everyone,
      // including its own author, until the poster decides how to appear —
      // filtered out here entirely rather than included with a flag.
      replies: { where: { predictor: publicPoster }, include: { predictor: predictorSelect }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) return null;
  // A held topic is invisible the same way — nobody sees it, author
  // included, until they decide.
  if (isHeld(t.predictor)) return null;

  const taggedProject = t.projectSlug ? await findProjectByTagSlug(t.projectSlug) : null;

  return {
    id: t.id,
    label: labelOf(t.predictor),
    isAgent: t.predictor.agentName != null,
    ...flagsOf(t.predictor),
    pending: false,
    title: t.title,
    body: t.body,
    issues: t.issues,
    utilitySlug: t.utilitySlug,
    projectSlug: t.projectSlug,
    projectName: taggedProject?.name ?? null,
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
