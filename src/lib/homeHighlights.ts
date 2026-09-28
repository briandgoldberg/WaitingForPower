// Data for the home page's headline number and storage hearings.
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
        select: { slug: true, name: true, state: true, fuelType: true, capacityValue: true, capacityUnit: true, hearingDetailsLink: true },
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
  return [...bySlug.values()].slice(0, limit);
}
