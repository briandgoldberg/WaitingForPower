import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitReply, ForumError } from "@/lib/forum";
import { hashIp } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Message Board reply — same identity/rate-limit pattern as topic creation.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ipHash = hashIp(req);
  if (await isRateLimited("api_forum_replies_write", ipHash, { windowMs: 60_000, max: 20 })) {
    return rateLimitedResponse(60);
  }
  void prisma.apiRequestLog
    .create({ data: { endpoint: "api_forum_replies_write", method: "POST", userAgent: req.headers.get("user-agent"), ipHash } })
    .catch((err) => console.error("Failed to log /api/forum/topics/[id]/replies write:", err));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const text = String(body.body ?? "");
  if (!anonymousKey || !text.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }

  try {
    const { reply, predictor } = await submitReply({ anonymousKey, topicId: id, body: text });
    return NextResponse.json({
      ok: true,
      id: reply.id,
      createdAt: reply.createdAt.toISOString(),
      displayName: predictor.displayName,
      identityDecided: predictor.identityDecidedAt != null,
    });
  } catch (err) {
    if (err instanceof ForumError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "rate_limited" ? 429 : 400 });
    }
    console.error("Failed to submit forum reply:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
