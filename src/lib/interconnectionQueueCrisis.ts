// Computes the real, live numbers behind the interconnection-queue-crisis
// blog post, from this site's own LBNL Queued Up-sourced rows (see
// lbnlQueuedUp.ts — active status only, >=250MW, the same filter this site
// applies everywhere else). "Currently in queue" here always means: this
// project's real, dated entry into an ISO/utility interconnection queue,
// and it hasn't yet been reported operational, withdrawn, or suspended as
// of the current LBNL edition.
import { prisma } from "@/lib/db";

const FIRST_CHART_YEAR = 2017; // earlier years have too few surviving active rows to be meaningful — see below

export interface QueueYear {
  year: number;
  mw: number;
  count: number;
  partial: boolean; // true only for the current calendar year
}

export interface QueueRegion {
  region: string;
  mw: number;
  count: number;
}

export interface InterconnectionQueueCrisisResult {
  years: QueueYear[];
  totalMw: number;
  totalCount: number;
  medianYearsWaiting: number;
  topRegions: QueueRegion[];
  cleanEnergyShareOfMw: number; // solar + wind + storage share of total MW
}

export async function computeInterconnectionQueueCrisis(): Promise<InterconnectionQueueCrisisResult> {
  // Scoped by the currentStatus marker lbnlQueuedUp.ts always sets on every
  // active row (not interconnectionQueueStage, which is null when a row's
  // iaPhase came back empty — that would silently drop real active rows
  // from the headline total).
  const allActiveQueueRows = await prisma.project.findMany({
    where: {
      isAggregateExample: false,
      applicationFiledDate: { not: null },
      capacityValue: { not: null },
      currentStatus: { contains: "Interconnection queue status" },
    },
    select: { applicationFiledDate: true, capacityValue: true, fuelType: true, balancingAuthority: true },
  });

  const currentYear = new Date().getUTCFullYear();
  const byYear = new Map<number, { mw: number; count: number }>();
  for (const r of allActiveQueueRows) {
    const year = r.applicationFiledDate!.getUTCFullYear();
    if (year < FIRST_CHART_YEAR) continue;
    const a = byYear.get(year) ?? { mw: 0, count: 0 };
    a.mw += r.capacityValue!;
    a.count += 1;
    byYear.set(year, a);
  }
  const years: QueueYear[] = [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, { mw, count }]) => ({ year, mw: Math.round(mw), count, partial: year === currentYear }));

  const totalMw = allActiveQueueRows.reduce((s, r) => s + r.capacityValue!, 0);
  const totalCount = allActiveQueueRows.length;

  const now = Date.now();
  const waitYears = allActiveQueueRows
    .map((r) => (now - r.applicationFiledDate!.getTime()) / (365.25 * 24 * 3600 * 1000))
    .sort((a, b) => a - b);
  const medianYearsWaiting = waitYears.length > 0 ? waitYears[Math.floor(waitYears.length / 2)] : 0;

  const byRegion = new Map<string, { mw: number; count: number }>();
  for (const r of allActiveQueueRows) {
    const region = r.balancingAuthority ?? "Unknown";
    const a = byRegion.get(region) ?? { mw: 0, count: 0 };
    a.mw += r.capacityValue!;
    a.count += 1;
    byRegion.set(region, a);
  }
  const topRegions: QueueRegion[] = [...byRegion.entries()]
    .filter(([region]) => region !== "Unknown")
    .sort(([, a], [, b]) => b.mw - a.mw)
    .slice(0, 5)
    .map(([region, { mw, count }]) => ({ region, mw: Math.round(mw), count }));

  const cleanFuels = new Set(["solar", "wind_onshore", "wind_offshore", "storage"]);
  const cleanMw = allActiveQueueRows.filter((r) => cleanFuels.has(r.fuelType)).reduce((s, r) => s + r.capacityValue!, 0);
  const cleanEnergyShareOfMw = totalMw > 0 ? Math.round((cleanMw / totalMw) * 1000) / 10 : 0;

  return {
    years,
    totalMw: Math.round(totalMw),
    totalCount,
    medianYearsWaiting: Math.round(medianYearsWaiting * 100) / 100,
    topRegions,
    cleanEnergyShareOfMw,
  };
}
