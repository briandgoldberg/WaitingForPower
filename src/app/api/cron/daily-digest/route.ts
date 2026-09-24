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
import { describeAdvocacyEntry, describeContactTarget, STANCE_INFO, type AdvocacyType, type ContactTargetType, type Stance } from "@/lib/data/advocacyPoints";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowLabel = `${since.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}–${now.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} UTC`;

  const [apiLogs, feedbackRows, newSubscriptions, newPredictorEmails, newComments, newContacts, newLikeCount] = await Promise.all([
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
    prisma.predictorEmailVerification.findMany({
      where: { confirmedAt: { gte: since } },
      select: { email: true, predictor: { select: { displayName: true, agentName: true } } },
      orderBy: { confirmedAt: "asc" },
    }),
    // The site's "I Advocated" log — advocacyType/stance/hearingDate are set
    // on every current row; null only on a handful of legacy free-text
    // comments written before this existed.
    prisma.projectComment.findMany({
      where: { createdAt: { gte: since } },
      select: {
        body: true,
        createdAt: true,
        parentId: true,
        predictionId: true,
        advocacyType: true,
        hearingDate: true,
        stance: true,
        predictor: { select: { displayName: true, agentName: true, email: true, identityDecidedAt: true } },
        project: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Site-wide "I Reached Out!" entries — not tied to a project.
    prisma.advocacyContact.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        targetType: true,
        state: true,
        targetName: true,
        note: true,
        predictor: { select: { displayName: true, agentName: true, email: true, identityDecidedAt: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.threadLike.count({ where: { createdAt: { gte: since } } }),
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

  // Unified list of what real people and guests actually did: project
  // advocacy entries ("I Advocated") and site-wide official-contact entries
  // ("I Reached Out!"). Agent-authored rows are still included (flagged via
  // isAgent) rather than dropped, since an agent logging a real advocacy
  // action is a meaningfully different signal than an agent bulk-predicting
  // dates ever was.
  const projectUrl = (slug: string) => `https://waitingforpower.com/project/${slug}#comments`;
  const labelOf = (p: { displayName: string | null; agentName: string | null }) => p.displayName ?? p.agentName ?? "anonymous";
  const posts: { at: Date; post: Parameters<typeof sendDailyDigestEmail>[0]["newPosts"][number] }[] = [];
  for (const c of newComments) {
    const isAgent = c.predictor.agentName != null;
    const actionText = c.advocacyType
      ? `${describeAdvocacyEntry(c.advocacyType as AdvocacyType, c.hearingDate?.toISOString())}${c.stance ? ` ${STANCE_INFO[c.stance as Stance].phrase}` : ""}`
      : c.parentId || c.predictionId
        ? "replied"
        : "commented";
    posts.push({
      at: c.createdAt,
      post: {
        kind: "project",
        label: labelOf(c.predictor),
        isAgent,
        guest: !isAgent && c.predictor.email == null,
        held: !isAgent && c.predictor.identityDecidedAt == null,
        projectName: c.project.name,
        url: projectUrl(c.project.slug),
        actionText,
        body: c.body || null,
      },
    });
  }
  for (const contact of newContacts) {
    const isAgent = contact.predictor.agentName != null;
    posts.push({
      at: contact.createdAt,
      post: {
        kind: "contact",
        label: labelOf(contact.predictor),
        isAgent,
        guest: !isAgent && contact.predictor.email == null,
        held: !isAgent && contact.predictor.identityDecidedAt == null,
        projectName: null,
        url: "https://waitingforpower.com/policies",
        actionText: describeContactTarget({ ...contact, targetType: contact.targetType as ContactTargetType }),
        body: contact.note,
      },
    });
  }
  posts.sort((a, b) => a.at.getTime() - b.at.getTime());

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
    newPosts: posts.slice(0, 50).map((x) => x.post),
    newLikeCount,
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
    newPostCount: posts.length,
    newLikeCount,
    newPredictorEmailCount: newPredictorEmails.length,
  };
  console.log("daily-digest cron:", summary);
  return NextResponse.json(summary);
}
