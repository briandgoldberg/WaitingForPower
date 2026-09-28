// Data for the home page's headline number and "Speak up" hearings strip.
// Both are small aggregate queries so the landing page stays fast.

import { prisma } from "@/lib/db";
import { RESOLVED_STAGES, ZERO_CARBON_FUELS } from "@/lib/data/taxonomies";
import { homesPowered } from "@/lib/calc/homesPowered";
import { isPublicHearing } from "@/lib/advocacyActions";

const WAITING = { mergedIntoId: null, noLongerReported: false, isAggregateExample: false, currentStage: { notIn: RESOLVED_STAGES } };

// Homes the clean generation still waiting on a decision could power, by the
// same method as the Projects tab (calc/homesPowered.ts). Summed per fuel in
// the database rather than loading every project; merged duplicates are
// already excluded by mergedIntoId, so it tracks the Projects tab closely.
export async function getCleanEnergyWaiting(): Promise<{ homes: number; mw: number }> {
  const rows = await prisma.project.groupBy({
    by: ["fuelType"],
    where: { ...WAITING, capacityUnit: "MW", capacityValue: { not: null }, fuelType: { in: ZERO_CARBON_FUELS } },
    _sum: { capacityValue: true },
  });
  let homes = 0;
  let mw = 0;
  for (const r of rows) {
    const sum = r._sum.capacityValue ?? 0;
    mw += sum;
    homes += homesPowered(r.fuelType, sum, "MW") ?? 0;
  }
  return { homes, mw };
}

export interface SpeakUpHearing {
  slug: string;
  name: string;
  state: string | null;
  fuelType: string;
  capacityValue: number | null;
  capacityUnit: string | null;
  hearingLink: string | null;
  handResearched: boolean;
  hearings: { date: string; label: string | null; location: string | null }[];
}

// The next few projects with a public hearing the public can speak at.
// Hand-verified local hearings (localHearings.ts, matchKey "local:") come
// first since they're the ones residents can most easily attend, then the
// rest by date.
export async function getSpeakUpHearings(limit = 3): Promise<SpeakUpHearing[]> {
  const rows = await prisma.projectHearing.findMany({
    where: { date: { gte: new Date() }, project: WAITING },
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
      handResearched: p.matchKey?.startsWith("local:") ?? false,
      hearings: [h],
    });
  }
  const all = [...bySlug.values()];
  return [...all.filter((g) => g.handResearched), ...all.filter((g) => !g.handResearched)].slice(0, limit);
}
