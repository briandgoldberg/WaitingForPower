import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Very lightweight cron health check: no per-source schedule config to
// keep in sync with vercel.json, just "how long since this source's own
// matchKey prefix last touched a row." A source that's actually running on
// schedule updates at least one row every run (even a no-op re-check
// bumps updatedAt via upsertNormalizedProject), so a prefix that's gone
// quiet past a generous threshold is the signal something didn't fire —
// including the "plan doesn't allow this cron" failure mode, which
// produces no error anywhere else to look at.
//
// A few sources run on the 1st and 15th of the month (see vercel.json) — a
// longer staleness threshold for exactly those; everything else runs every
// 4 days and uses a 5-day threshold (a day of slack for a slow run or a
// source temporarily down).
const WEEKLY_SOURCE_PREFIXES = new Set(["eia", "lbnl", "ornlHydro", "eiaPipelines", "nc-ncuc"]);
// Runs once a week (ingest-local-hearings).
const ONCE_WEEKLY_SOURCE_PREFIXES = new Set(["local"]);
const DAILY_STALE_AFTER_HOURS = 24 * 5; // every 4 days + 1 day's slack
const ONCE_WEEKLY_STALE_AFTER_HOURS = 24 * 9; // every 7 days + 2 days' slack
const WEEKLY_STALE_AFTER_HOURS = 24 * 19; // up to 17 days between the 15th and the 1st + 2 days' slack

export async function GET() {
  const rows = await prisma.project.findMany({
    where: { matchKey: { not: null } },
    select: { matchKey: true, updatedAt: true },
  });

  const bySource = new Map<string, { count: number; lastSeen: Date }>();
  for (const row of rows) {
    const prefix = row.matchKey!.split(":")[0];
    const existing = bySource.get(prefix);
    if (!existing) {
      bySource.set(prefix, { count: 1, lastSeen: row.updatedAt });
    } else {
      existing.count += 1;
      if (row.updatedAt > existing.lastSeen) existing.lastSeen = row.updatedAt;
    }
  }

  const now = Date.now();
  const sources = [...bySource.entries()]
    .map(([source, { count, lastSeen }]) => {
      const hoursSinceLastSeen = (now - lastSeen.getTime()) / (1000 * 60 * 60);
      const onceWeekly = ONCE_WEEKLY_SOURCE_PREFIXES.has(source);
      const staleAfterHours = WEEKLY_SOURCE_PREFIXES.has(source)
        ? WEEKLY_STALE_AFTER_HOURS
        : onceWeekly
          ? ONCE_WEEKLY_STALE_AFTER_HOURS
          : DAILY_STALE_AFTER_HOURS;
      return {
        source,
        projectCount: count,
        lastSeen: lastSeen.toISOString(),
        hoursSinceLastSeen: Math.round(hoursSinceLastSeen * 10) / 10,
        expectedCadence: WEEKLY_SOURCE_PREFIXES.has(source) ? "twice monthly" : onceWeekly ? "weekly" : "every 4 days",
        stale: hoursSinceLastSeen > staleAfterHours,
      };
    })
    .sort((a, b) => b.hoursSinceLastSeen - a.hoursSinceLastSeen);

  const staleSources = sources.filter((s) => s.stale);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ok: staleSources.length === 0,
    staleCount: staleSources.length,
    sources,
  });
}
