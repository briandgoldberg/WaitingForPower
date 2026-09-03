// Daily summary email to briandgoldberg@gmail.com covering the previous
// ~24 hours: bot/MCP/API calls (ApiRequestLog), visitor feedback
// (VisitorFeedback), contact form submissions (ContactSubmission), and new
// project-notification subscriptions (ProjectSubscription). A rolling
// 24-hour window ending at run time, not a strict UTC calendar day — same
// convention as notify-subscribers, and simpler than reasoning about
// calendar-day boundaries for a cron that just needs to run once daily.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations — see src/app/api/cron/ingest-eia/route.ts for the same check.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDailyDigestEmail } from "@/lib/dailyDigestEmail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowLabel = `${since.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}–${now.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} UTC`;

  const [apiLogs, feedbackRows, contactSubmissions, newSubscriptions] = await Promise.all([
    prisma.apiRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: { endpoint: true, userAgent: true },
    }),
    prisma.visitorFeedback.findMany({
      where: { createdAt: { gte: since } },
      select: { intent: true, feedbackText: true, contactEmail: true, path: true },
    }),
    prisma.contactSubmission.findMany({
      where: { createdAt: { gte: since } },
      select: { topic: true, name: true, email: true, organization: true, message: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectSubscription.findMany({
      where: { createdAt: { gte: since } },
      select: { email: true, confirmed: true, project: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const apiCallsByEndpoint = new Map<string, number>();
  const userAgentSet = new Set<string>();
  for (const log of apiLogs) {
    apiCallsByEndpoint.set(log.endpoint, (apiCallsByEndpoint.get(log.endpoint) ?? 0) + 1);
    if (log.userAgent) userAgentSet.add(log.userAgent);
  }

  const feedbackByIntent = new Map<string, number>();
  for (const row of feedbackRows) {
    feedbackByIntent.set(row.intent, (feedbackByIntent.get(row.intent) ?? 0) + 1);
  }

  const result = await sendDailyDigestEmail({
    windowLabel,
    apiCalls: [...apiCallsByEndpoint.entries()].map(([endpoint, count]) => ({ endpoint, count })),
    // Capped — a runaway crawler shouldn't blow up the email with hundreds
    // of near-duplicate UA strings.
    apiUserAgents: [...userAgentSet].slice(0, 20),
    feedback: [...feedbackByIntent.entries()].map(([intent, count]) => ({ intent, count })),
    feedbackTotal: feedbackRows.length,
    feedbackDetails: feedbackRows
      .filter((r) => r.feedbackText || r.contactEmail)
      .map((r) => ({ intent: r.intent, feedbackText: r.feedbackText, contactEmail: r.contactEmail, path: r.path })),
    contactSubmissions,
    newSubscriptions: newSubscriptions.map((s) => ({ projectName: s.project.name, email: s.email, confirmed: s.confirmed })),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const summary = {
    ok: true,
    windowLabel,
    apiCallCount: apiLogs.length,
    feedbackCount: feedbackRows.length,
    contactSubmissionCount: contactSubmissions.length,
    newSubscriptionCount: newSubscriptions.length,
  };
  console.log("daily-digest cron:", summary);
  return NextResponse.json(summary);
}
