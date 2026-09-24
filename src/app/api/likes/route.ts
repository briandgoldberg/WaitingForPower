import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toggleLike, CommentError } from "@/lib/community";
import { hashIp } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Like or unlike a comment. Needs only the anonymous browser key, so
// reacting never requires a name, and never exposed as an MCP tool or a
// documented API — same IP-based limit as the other write endpoints, on top
// of the per-predictor one inside toggleLike.
export async function POST(req: NextRequest) {
  const ipHash = hashIp(req);
  if (await isRateLimited("api_likes", ipHash, { windowMs: 60_000, max: 40 })) {
    return rateLimitedResponse(60);
  }
  void prisma.apiRequestLog
    .create({ data: { endpoint: "api_likes", method: "POST", userAgent: req.headers.get("user-agent"), ipHash } })
    .catch((err) => console.error("Failed to log /api/likes write:", err));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const targetId = String(body.targetId ?? "").trim();

  if (!targetId || targetId.length > 200) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }

  try {
    const result = await toggleLike({ anonymousKey, targetId });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof CommentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "rate_limited" ? 429 : 400 });
    }
    console.error("Failed to toggle like:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
