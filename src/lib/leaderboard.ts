// The "Top advocates" home tab — ranks every Predictor by points earned
// across both advocacy tables (a project's "I Advocated" log and a logged
// contact with an official), computed at read time like the rest of this
// app's derived numbers rather than a stored running total, so it's always
// current and never drifts from the actual rows.

import { prisma } from "@/lib/db";
import { pointsFor, CONTACT_POINTS, type AdvocacyType } from "@/lib/data/advocacyPoints";

export interface LeaderboardEntry {
  predictorId: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  points: number;
  actionCount: number;
}

export async function getTopAdvocates(limit = 25): Promise<LeaderboardEntry[]> {
  // Held identities (haven't decided how to appear yet) never earn a public
  // rank — same rule as everywhere else UGC becomes visible on this site.
  const publicPoster = { OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }] };

  const [commentGroups, contactGroups] = await Promise.all([
    prisma.projectComment.groupBy({
      by: ["predictorId", "advocacyType"],
      where: { advocacyType: { not: null }, predictor: publicPoster },
      _count: { _all: true },
    }),
    prisma.advocacyContact.groupBy({
      by: ["predictorId"],
      where: { predictor: publicPoster },
      _count: { _all: true },
    }),
  ]);

  const points = new Map<string, number>();
  const actions = new Map<string, number>();
  const add = (predictorId: string, earned: number, count: number) => {
    points.set(predictorId, (points.get(predictorId) ?? 0) + earned);
    actions.set(predictorId, (actions.get(predictorId) ?? 0) + count);
  };

  for (const g of commentGroups) {
    if (!g.advocacyType) continue;
    add(g.predictorId, pointsFor(g.advocacyType as AdvocacyType) * g._count._all, g._count._all);
  }
  for (const g of contactGroups) {
    add(g.predictorId, CONTACT_POINTS * g._count._all, g._count._all);
  }

  const rankedIds = [...points.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
  if (rankedIds.length === 0) return [];

  const predictors = await prisma.predictor.findMany({
    where: { id: { in: rankedIds } },
    select: { id: true, displayName: true, agentName: true, email: true },
  });
  const byId = new Map(predictors.map((p) => [p.id, p]));

  return rankedIds
    .map((id) => {
      const p = byId.get(id);
      if (!p) return null;
      const human = p.agentName == null;
      const entry: LeaderboardEntry = {
        predictorId: id,
        label: p.displayName ?? p.agentName ?? "anonymous",
        isAgent: !human,
        confirmed: human && p.email != null,
        guest: human && p.email == null,
        points: points.get(id) ?? 0,
        actionCount: actions.get(id) ?? 0,
      };
      return entry;
    })
    .filter((e): e is LeaderboardEntry => e != null);
}
