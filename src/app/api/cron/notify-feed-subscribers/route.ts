// Weekly email to every confirmed FeedSubscription — replaces the retired
// per-project notify-subscribers cron. Unlike that one, this always sends
// (see FeedSubscription's schema.prisma header: a predictable "yes, still
// watching" cadence is the point), saying plainly when there's nothing new
// in scope rather than skipping a subscriber on a quiet week.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations — see src/app/api/cron/ingest-eia/route.ts for the same check.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { splitStateCodes } from "@/lib/data/usStates";
import { sendFeedWeeklyEmail } from "@/lib/feedSubscriptionEmail";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await prisma.feedSubscription.findMany({ where: { confirmed: true } });

  let emailed = 0;
  let failed = 0;

  for (const sub of subs) {
    // See FeedSubscription's schema.prisma header — "" is the DB-level
    // "every state" sentinel; scopeState (possibly null) is what the
    // filtering logic and the email itself use.
    const scopeState = sub.state || null;
    const since = sub.lastNotifiedAt ?? sub.confirmedAt ?? sub.createdAt;
    const rows = await prisma.projectChange.findMany({
      where: { createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      include: { project: { select: { name: true, slug: true, state: true, isAggregateExample: true } } },
    });

    const inScope = rows.filter(
      (r) => !r.project.isAggregateExample && (scopeState == null || splitStateCodes(r.project.state).includes(scopeState)),
    );

    const result = await sendFeedWeeklyEmail({
      to: sub.email,
      state: scopeState,
      summaries: inScope.map((r) => ({ projectName: r.project.name, projectSlug: r.project.slug, summary: r.summary })),
      unsubscribeToken: sub.unsubscribeToken,
    });

    if (result.ok) {
      await prisma.feedSubscription.update({ where: { id: sub.id }, data: { lastNotifiedAt: new Date() } });
      emailed++;
    } else {
      failed++;
    }
  }

  const summary = { ok: true, totalSubscriptions: subs.length, emailed, failed };
  console.log("notify-feed-subscribers cron:", summary);
  return NextResponse.json(summary);
}
