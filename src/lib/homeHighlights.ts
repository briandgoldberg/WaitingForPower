// Data for the home page's storage hearings section — a small aggregate
// query so the landing page stays fast.

import { prisma } from "@/lib/db";
import { RESOLVED_STAGES } from "@/lib/data/taxonomies";
import { isPublicHearing } from "@/lib/advocacyActions";
import { LOCAL_HEARINGS } from "@/lib/ingest/localHearings";

const WAITING = { mergedIntoId: null, noLongerReported: false, isAggregateExample: false, currentStage: { notIn: RESOLVED_STAGES } };

export interface SpeakUpHearing {
  slug: string;
  name: string;
  state: string | null;
  fuelType: string;
  capacityValue: number | null;
  capacityUnit: string | null;
  hearingLink: string | null;
  hearings: { date: string; label: string | null; location: string | null }[];
}

// The next local battery-storage hearings the public can speak at: the
// hand-verified ones (localHearings.ts, matchKey "local:"), soonest first.
// The home page's message is that clean energy needs storage, and these are
// the local fights where a few supporters make a difference.
export async function getStorageHearings(limit = 3): Promise<SpeakUpHearing[]> {
  const rows = await prisma.projectHearing.findMany({
    where: { date: { gte: new Date() }, project: { ...WAITING, fuelType: "storage", matchKey: { startsWith: "local:" } } },
    orderBy: { date: "asc" },
    take: 200,
    select: {
      date: true,
      label: true,
      location: true,
      project: {
        select: { slug: true, name: true, state: true, fuelType: true, capacityValue: true, capacityUnit: true, hearingDetailsLink: true, matchKey: true },
      },
    },
  });

  const bySlug = new Map<string, SpeakUpHearing>();
  for (const r of rows) {
    if (!isPublicHearing(r)) continue;
    const p = r.project;
    const h = { date: r.date.toISOString(), label: r.label, location: r.location };
    const existing = bySlug.get(p.slug);
    if (existing) {
      existing.hearings.push(h);
      continue;
    }
    bySlug.set(p.slug, {
      slug: p.slug,
      name: p.name,
      state: p.state,
      fuelType: p.fuelType,
      capacityValue: p.capacityValue,
      capacityUnit: p.capacityUnit,
      hearingLink: p.hearingDetailsLink,
      hearings: [h],
    });
  }
  // These are hand-checked entries whose source of truth is localHearings.ts,
  // so their hearing details come from the deployed code rather than the
  // last daily load: a corrected time or venue shows up on deploy.
  const codeByKey = new Map(LOCAL_HEARINGS.map((e) => [`local:${e.id}`, e]));
  const matchKeys = new Map(rows.map((r) => [r.project.slug, r.project.matchKey]));
  const now = Date.now();
  return [...bySlug.values()]
    .map((g) => {
      const entry = codeByKey.get(matchKeys.get(g.slug) ?? "");
      if (!entry) return g;
      const hearings = entry.hearings
        .filter((h) => new Date(h.date).getTime() >= now)
        .map((h) => ({ date: new Date(h.date).toISOString(), label: h.label, location: h.location }));
      return hearings.length > 0 ? { ...g, name: `${entry.name} (${entry.authority})`, capacityValue: entry.capacityMw, capacityUnit: entry.capacityMw != null ? "MW" : null, hearings } : g;
    })
    .slice(0, limit);
}
