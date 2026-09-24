// The home page's "What people are advocating for" tab: every structured
// advocacy action across the site, merged from two sources — a project's
// own "I Advocated" log (src/lib/community.ts, ProjectComment.advocacyType)
// and a logged contact with a regulator or member of Congress
// (src/lib/advocacyContacts.ts, AdvocacyContact) — since both count toward
// the same points and the same leaderboard, a visitor shouldn't have to
// care which table a given entry actually lives in.

import { prisma } from "@/lib/db";
import { labelOf, flagsOf, isHeld } from "@/lib/community";
import { pointsFor, CONTACT_POINTS, type AdvocacyType } from "@/lib/data/advocacyPoints";
import type { ContactTargetType } from "@/lib/data/advocacyPoints";

export interface AdvocacyFeedItem {
  id: string;
  kind: "project" | "contact";
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
  projectSlug?: string;
  projectName?: string;
  // "contact" entries only
  targetType?: ContactTargetType;
  state?: string;
  targetName?: string | null;
  issues?: string[];
}

export async function getAdvocacyFeed(offset = 0, limit = 20): Promise<{ items: AdvocacyFeedItem[]; hasMore: boolean }> {
  const need = offset + limit + 1;
  const publicPoster = { OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }] };
  const predictorSelect = {
    select: { id: true, displayName: true, agentName: true, email: true, identityDecidedAt: true },
  } as const;

  const [comments, contacts] = await Promise.all([
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

  const merged = [...fromComments, ...fromContacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items: merged.slice(offset, offset + limit), hasMore: merged.length > offset + limit };
}
