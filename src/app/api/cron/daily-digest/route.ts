// Daily summary email to briandgoldberg@gmail.com covering the previous
// ~24 hours: bot/MCP/API calls (ApiRequestLog), visitor feedback
// (VisitorFeedback — this is now the site's only contact channel, since
// /contact and ContactSubmission were retired in favor of the feedback
// widget), and new feed subscriptions (FeedSubscription). A rolling
// 24-hour window ending at
// run time, not a strict UTC calendar day — same convention as
// notify-feed-subscribers, and simpler than reasoning about calendar-day
// boundaries for a cron that just needs to run once daily.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations — see src/app/api/cron/ingest-eia/route.ts for the same check.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDailyDigestEmail } from "@/lib/dailyDigestEmail";
import { stateName } from "@/lib/data/usStates";
import { classifyUserAgent } from "@/lib/classifyUserAgent";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowLabel = `${since.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}–${now.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} UTC`;

  const [apiLogs, feedbackRows, newSubscriptions, newPredictions, newlyScored, newPredictorEmails] = await Promise.all([
    prisma.apiRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: { endpoint: true, userAgent: true },
    }),
    prisma.visitorFeedback.findMany({
      where: { createdAt: { gte: since } },
      select: { feedbackText: true, contactEmail: true, path: true },
    }),
    prisma.feedSubscription.findMany({
      where: { createdAt: { gte: since } },
      select: { email: true, confirmed: true, state: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.prediction.findMany({
      where: { submittedAt: { gte: since } },
      select: {
        predictedDate: true,
        predictor: { select: { displayName: true, agentName: true } },
        project: { select: { name: true } },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.prediction.findMany({
      where: { scoredAt: { gte: since } },
      select: {
        daysOff: true,
        predictor: { select: { displayName: true, agentName: true } },
        project: { select: { name: true } },
      },
      orderBy: { scoredAt: "asc" },
    }),
    prisma.predictorEmailVerification.findMany({
      where: { confirmedAt: { gte: since } },
      select: { email: true, predictor: { select: { displayName: true, agentName: true } } },
      orderBy: { confirmedAt: "asc" },
    }),
  ]);

  const apiCallsByEndpoint = new Map<string, number>();
  // Real vs. discovery-bot breakdown — see classifyUserAgent.ts for why this
  // exists: raw call counts are dominated by the MCP registry/directory
  // crawler ecosystem (confirmed live 2026-09-08: ~79% of one day's /mcp
  // traffic was self-described liveness/health/census bots), so a plain
  // "N calls today" number reads as far more real usage than it is.
  const trafficBreakdown = { bot: 0, ambiguous: 0, real: 0 };
  const realUaCounts = new Map<string, number>();
  for (const log of apiLogs) {
    apiCallsByEndpoint.set(log.endpoint, (apiCallsByEndpoint.get(log.endpoint) ?? 0) + 1);
    const cls = classifyUserAgent(log.userAgent);
    trafficBreakdown[cls]++;
    if (cls === "real" && log.userAgent) {
      realUaCounts.set(log.userAgent, (realUaCounts.get(log.userAgent) ?? 0) + 1);
    }
  }

  const result = await sendDailyDigestEmail({
    windowLabel,
    apiCalls: [...apiCallsByEndpoint.entries()].map(([endpoint, count]) => ({ endpoint, count })),
    apiTrafficBreakdown: trafficBreakdown,
    // Capped — a genuinely new real client showing up in volume would still
    // be worth seeing, but this isn't meant to survive a targeted flood.
    apiRealUserAgents: [...realUaCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([userAgent, count]) => ({ userAgent, count })),
    feedbackTotal: feedbackRows.length,
    feedbackDetails: feedbackRows.map((r) => ({ feedbackText: r.feedbackText, contactEmail: r.contactEmail, path: r.path })),
    newSubscriptions: newSubscriptions.map((s) => ({ scope: s.state ? stateName(s.state) : "All states", email: s.email, confirmed: s.confirmed })),
    newPredictions: newPredictions.map((p) => ({
      label: p.predictor.displayName ?? p.predictor.agentName ?? "anonymous",
      isAgent: p.predictor.agentName != null,
      projectName: p.project.name,
      predictedDate: p.predictedDate.toISOString(),
    })),
    newlyScored: newlyScored.map((p) => ({
      label: p.predictor.displayName ?? p.predictor.agentName ?? "anonymous",
      isAgent: p.predictor.agentName != null,
      projectName: p.project.name,
      daysOff: p.daysOff ?? 0,
    })),
    newPredictorEmails: newPredictorEmails.map((v) => ({
      email: v.email,
      label: v.predictor.displayName ?? v.predictor.agentName ?? "anonymous",
    })),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const summary = {
    ok: true,
    windowLabel,
    apiCallCount: apiLogs.length,
    apiTrafficBreakdown: trafficBreakdown,
    feedbackCount: feedbackRows.length,
    newSubscriptionCount: newSubscriptions.length,
    newPredictionCount: newPredictions.length,
    newlyScoredCount: newlyScored.length,
    newPredictorEmailCount: newPredictorEmails.length,
  };
  console.log("daily-digest cron:", summary);
  return NextResponse.json(summary);
}
