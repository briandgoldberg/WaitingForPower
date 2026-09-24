// The home page's "What people are advocating for" tab: every structured
// advocacy action across the site, merged from three sources — a project's
// own "I Advocated" log (src/lib/community.ts, ProjectComment.advocacyType),
// a logged contact with a regulator or member of Congress
// (src/lib/advocacyContacts.ts, AdvocacyContact), and new Message Board
// topics (src/lib/forum.ts, ForumTopic) — since a visitor shouldn't have to
// care which table a given entry actually lives in. Board topics carry
// points: 0 and are never counted by the leaderboard (see leaderboard.ts):
// they're conversation, not a verified civic action.

import { prisma } from "@/lib/db";
import { labelOf, flagsOf, isHeld } from "@/lib/community";
import { pointsFor, CONTACT_POINTS, type AdvocacyType, type Stance } from "@/lib/data/advocacyPoints";
import type { ContactTargetType } from "@/lib/data/advocacyPoints";

export interface AdvocacyFeedItem {
  id: string;
  kind: "project" | "contact" | "board";
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  createdAt: string;
  points: number;
  note: string | null;
  // "project" entries only
  advocacyType?: AdvocacyType;
  hearingDate?: string | null;
  stance?: Stance | null;
  projectSlug?: string;
  projectName?: string;
  // "contact" entries only
  targetType?: ContactTargetType;
  state?: string;
  targetName?: string | null;
  // "contact" and "board" entries
  issues?: string[];
  // "board" entries only
  topicId?: string;
  title?: string;
  replyCount?: number;
}

export async function getAdvocacyFeed(offset = 0, limit = 20): Promise<{ items: AdvocacyFeedItem[]; hasMore: boolean }> {
  const need = offset + limit + 1;
  const publicPoster = { OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }] };
  const predictorSelect = {
    select: { id: true, displayName: true, agentName: true, email: true, identityDecidedAt: true },
  } as const;

  const [comments, contacts, topics] = await Promise.all([
    prisma.projectComment.findMany({
      where: { predictor: publicPoster, advocacyType: { not: null } },
      include: { predictor: predictorSelect, project: { select: { slug: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: need,
    }),
    prisma.advocacyContact.findMany({
      where: { predictor: publicPoster },
      include: { predictor: predictorSelect },
      orderBy: { createdAt: "desc" },
      take: need,
    }),
    prisma.forumTopic.findMany({
      where: { predictor: publicPoster },
      include: { predictor: predictorSelect, _count: { select: { replies: true } } },
      orderBy: { createdAt: "desc" },
      take: need,
    }),
  ]);

  const fromComments: AdvocacyFeedItem[] = comments.map((c) => {
    const advocacyType = c.advocacyType as AdvocacyType;
    return {
      id: c.id,
      kind: "project",
      label: labelOf(c.predictor),
      isAgent: c.predictor.agentName != null,
      ...flagsOf(c.predictor),
      pending: isHeld(c.predictor),
      createdAt: c.createdAt.toISOString(),
      points: pointsFor(advocacyType),
      note: c.body || null,
      advocacyType,
      hearingDate: c.hearingDate ? c.hearingDate.toISOString() : null,
      stance: c.stance as Stance | null,
      projectSlug: c.project.slug,
      projectName: c.project.name,
    };
  });

  const fromContacts: AdvocacyFeedItem[] = contacts.map((r) => ({
    id: r.id,
    kind: "contact",
    label: labelOf(r.predictor),
    isAgent: r.predictor.agentName != null,
    ...flagsOf(r.predictor),
    pending: isHeld(r.predictor),
    createdAt: r.createdAt.toISOString(),
    points: CONTACT_POINTS,
    note: r.note,
    targetType: r.targetType as ContactTargetType,
    state: r.state,
    targetName: r.targetName,
    issues: r.issues,
  }));

  const fromTopics: AdvocacyFeedItem[] = topics.map((t) => ({
    id: t.id,
    kind: "board",
    label: labelOf(t.predictor),
    isAgent: t.predictor.agentName != null,
    ...flagsOf(t.predictor),
    pending: isHeld(t.predictor),
    createdAt: t.createdAt.toISOString(),
    points: 0,
    note: null,
    issues: t.issues,
    topicId: t.id,
    title: t.title,
    replyCount: t._count.replies,
  }));

  const merged = [...fromComments, ...fromContacts, ...fromTopics].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items: merged.slice(offset, offset + limit), hasMore: merged.length > offset + limit };
}
