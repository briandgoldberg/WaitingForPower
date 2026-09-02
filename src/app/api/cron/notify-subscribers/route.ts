// Daily digest for per-project email subscriptions (see ProjectSubscription
// in schema.prisma). Runs once a day, after the day's ingestion crons have
// had a chance to write ProjectChange rows — finds each confirmed
// subscriber's project changes since their lastNotifiedAt, sends one email
// per subscription (never more than once a day even if a project changed
// multiple times), and advances the cursor. A failed send leaves
// lastNotifiedAt untouched so that subscriber is retried on the next run.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations — see src/app/api/cron/ingest-eia/route.ts for the same check.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDigestEmail } from "@/lib/subscriptionEmail";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await prisma.projectSubscription.findMany({
    where: { confirmed: true },
    include: { project: { select: { name: true, slug: true } } },
  });

  let emailed = 0;
  let skippedNoChanges = 0;
  let failed = 0;

  for (const sub of subs) {
    const since = sub.lastNotifiedAt ?? sub.confirmedAt ?? sub.createdAt;
    const changes = await prisma.projectChange.findMany({
      where: { projectId: sub.projectId, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      select: { summary: true },
    });

    if (changes.length === 0) {
      skippedNoChanges++;
      continue;
    }

    const result = await sendDigestEmail({
      to: sub.email,
      projectName: sub.project.name,
      projectSlug: sub.project.slug,
      summaries: changes.map((c) => c.summary),
      unsubscribeToken: sub.unsubscribeToken,
    });

    if (result.ok) {
      await prisma.projectSubscription.update({
        where: { id: sub.id },
        data: { lastNotifiedAt: new Date() },
      });
      emailed++;
    } else {
      failed++;
    }
  }

  const summary = { ok: true, totalSubscriptions: subs.length, emailed, skippedNoChanges, failed };
  console.log("notify-subscribers cron:", summary);
  return NextResponse.json(summary);
}
