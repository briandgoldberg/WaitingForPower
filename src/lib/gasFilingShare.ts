// Computes gas's share of newly-filed generation capacity by year, for the
// gas-taking-over-new-filings blog post. "Newly filed" = applicationFiledDate
// falls in that year; only rows with a real MW capacity figure count toward
// the MW totals (LNG's MTPA and pipeline length/diameter figures aren't
// comparable tonnage, so they're excluded rather than mixed in).
import { prisma } from "@/lib/db";

const FIRST_YEAR = 2019; // earlier years have too few tracked filings to be meaningful

export interface GasShareYear {
  year: number;
  totalMw: number;
  gasMw: number;
  gasSharePct: number;
  partial: boolean; // true only for the current calendar year (still filling in)
}

export interface GasFilingShareResult {
  years: GasShareYear[];
  firstYearPct: number;
  latestFullYearPct: number;
  latestFullYear: number;
}

export async function computeGasFilingShareByYear(): Promise<GasFilingShareResult> {
  const projects = await prisma.project.findMany({
    where: {
      isAggregateExample: false,
      applicationFiledDate: { not: null },
      capacityValue: { not: null },
      capacityUnit: "MW",
    },
    select: { applicationFiledDate: true, fuelType: true, capacityValue: true },
  });

  const currentYear = new Date().getUTCFullYear();
  const byYear = new Map<number, { total: number; gas: number }>();
  for (const p of projects) {
    const year = p.applicationFiledDate!.getUTCFullYear();
    if (year < FIRST_YEAR || year > currentYear) continue;
    const a = byYear.get(year) ?? { total: 0, gas: 0 };
    a.total += p.capacityValue!;
    if (p.fuelType === "gas") a.gas += p.capacityValue!;
    byYear.set(year, a);
  }

  const years: GasShareYear[] = [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, { total, gas }]) => ({
      year,
      totalMw: Math.round(total),
      gasMw: Math.round(gas),
      gasSharePct: total > 0 ? Math.round((gas / total) * 1000) / 10 : 0,
      partial: year === currentYear,
    }));

  const fullYears = years.filter((y) => !y.partial);
  const latest = fullYears[fullYears.length - 1];

  return {
    years,
    firstYearPct: years[0]?.gasSharePct ?? 0,
    latestFullYearPct: latest?.gasSharePct ?? 0,
    latestFullYear: latest?.year ?? FIRST_YEAR,
  };
}
