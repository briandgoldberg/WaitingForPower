// Daily summary email to briandgoldberg@gmail.com covering the previous
// ~24 hours: bot/MCP/API calls (ApiRequestLog) and visitor feedback
// (VisitorFeedback — this is now the site's only contact channel, since
// /contact and ContactSubmission were retired in favor of the feedback
// widget). A rolling 24-hour window ending at run time, not a strict UTC
// calendar day — same convention as notify-feed-subscribers, and simpler
// than reasoning about calendar-day boundaries for a cron that just needs
// to run once daily.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations — see src/app/api/cron/ingest-eia/route.ts for the same check.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDailyDigestEmail } from "@/lib/dailyDigestEmail";
import { summarizeApiTraffic } from "@/lib/apiTrafficSummary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowLabel = `${since.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}–${now.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} UTC`;

  const [apiLogs, feedbackRows] = await Promise.all([
    prisma.apiRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, endpoint: true, userAgent: true, query: true, rpcMethod: true, toolName: true, clientName: true, ipHash: true, src: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.visitorFeedback.findMany({
      where: { createdAt: { gte: since } },
      select: { feedbackText: true, contactEmail: true, path: true },
    }),
  ]);

  const apiCallsByEndpoint = new Map<string, number>();
  for (const log of apiLogs) apiCallsByEndpoint.set(log.endpoint, (apiCallsByEndpoint.get(log.endpoint) ?? 0) + 1);

  // Which of today's callers have been seen before — the difference between
  // "someone new found the MCP server" and "the same script ran again".
  const todaysIpHashes = [...new Set(apiLogs.map((l) => l.ipHash).filter((h): h is string => h != null))];
  const priorRows =
    todaysIpHashes.length === 0
      ? []
      : await prisma.apiRequestLog.findMany({
          where: { createdAt: { lt: since }, ipHash: { in: todaysIpHashes } },
          select: { ipHash: true },
          distinct: ["ipHash"],
        });
  // Real vs. discovery-bot classification lives in summarizeApiTraffic —
  // see classifyUserAgent.ts for why raw call counts mislead.
  const apiSummary = summarizeApiTraffic(apiLogs, new Set(priorRows.map((r) => r.ipHash!)));

  const result = await sendDailyDigestEmail({
    windowLabel,
    apiCalls: [...apiCallsByEndpoint.entries()].map(([endpoint, count]) => ({ endpoint, count })),
    api: apiSummary,
    feedbackTotal: feedbackRows.length,
    feedbackDetails: feedbackRows.map((r) => ({ feedbackText: r.feedbackText, contactEmail: r.contactEmail, path: r.path })),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const summary = {
    ok: true,
    windowLabel,
    apiCallCount: apiLogs.length,
    apiTrafficBreakdown: apiSummary.callsByClass,
    apiCallersByClass: apiSummary.callersByClass,
    mcpFunnel: apiSummary.mcpFunnel,
    feedbackCount: feedbackRows.length,
  };
  console.log("daily-digest cron:", summary);
  return NextResponse.json(summary);
}
