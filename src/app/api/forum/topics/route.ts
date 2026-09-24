import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitTopic, getForumTopics, ForumError } from "@/lib/forum";
import { hashIp } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Message Board topic creation — same anonymous-key identity as everywhere
// else, never a login. Not a documented REST API (see the comment on
// /api/comments) — an agent posts through the dedicated post_board_topic
// MCP tool instead (src/app/mcp/route.ts), which always carries a visible
// agentName identity.
export async function POST(req: NextRequest) {
  const ipHash = hashIp(req);
  if (await isRateLimited("api_forum_topics_write", ipHash, { windowMs: 60_000, max: 10 })) {
    return rateLimitedResponse(60);
  }
  void prisma.apiRequestLog
    .create({ data: { endpoint: "api_forum_topics_write", method: "POST", userAgent: req.headers.get("user-agent"), ipHash } })
    .catch((err) => console.error("Failed to log /api/forum/topics write:", err));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const title = String(body.title ?? "");
  const text = String(body.body ?? "");
  const issues = Array.isArray(body.issues) ? body.issues.filter((i): i is string => typeof i === "string") : [];

  if (!anonymousKey || !title.trim() || !text.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }

  try {
    const { topic, predictor } = await submitTopic({ anonymousKey, title, body: text, issues });
    return NextResponse.json({
      ok: true,
      id: topic.id,
      createdAt: topic.createdAt.toISOString(),
      displayName: predictor.displayName,
      identityDecided: predictor.identityDecidedAt != null,
    });
  } catch (err) {
    if (err instanceof ForumError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "rate_limited" ? 429 : 400 });
    }
    console.error("Failed to submit forum topic:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20));
  const result = await getForumTopics(offset, limit);
  return NextResponse.json(result);
}
