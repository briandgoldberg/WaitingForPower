import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitComment, getProjectDiscussion, CommentError } from "@/lib/community";
import { ADVOCACY_TYPES, STANCES, pointsFor, type AdvocacyType, type Stance } from "@/lib/data/advocacyPoints";
import { hashIp } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Human comment submission — anonymous key + optional nickname, never a
// login. Not documented in the public API docs (openapi.json only ever
// documents GET here) — an agent posts through the dedicated
// log_project_advocacy MCP tool instead (src/app/mcp/route.ts), which
// always carries a visible agentName identity, never an anonymous key.
// The per-predictor rate limit inside submitComment stops one identity from
// spamming; this IP check (mirroring /mcp's) stops a script from getting
// around that by minting unlimited fresh anonymous keys.
export async function POST(req: NextRequest) {
  const ipHash = hashIp(req);
  if (await isRateLimited("api_comments_write", ipHash, { windowMs: 60_000, max: 20 })) {
    return rateLimitedResponse(60);
  }
  void prisma.apiRequestLog
    .create({ data: { endpoint: "api_comments_write", method: "POST", userAgent: req.headers.get("user-agent"), ipHash } })
    .catch((err) => console.error("Failed to log /api/comments write:", err));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const text = String(body.body ?? "");
  const parentCommentId = String(body.parentCommentId ?? "").trim() || undefined;
  const advocacyTypeRaw = String(body.advocacyType ?? "").trim();
  const advocacyType = ADVOCACY_TYPES.includes(advocacyTypeRaw as AdvocacyType) ? (advocacyTypeRaw as AdvocacyType) : undefined;
  const hearingDate = String(body.hearingDate ?? "").trim() || undefined;
  const stanceRaw = String(body.stance ?? "").trim();
  const stance = STANCES.includes(stanceRaw as Stance) ? (stanceRaw as Stance) : undefined;

  // Text is required for a plain post; a structured "I Advocated" entry
  // (advocacyType set) can be submitted with no note at all.
  if (!projectId || !anonymousKey || (!text.trim() && !advocacyType)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }

  try {
    const { comment, predictor } = await submitComment({
      projectId,
      anonymousKey,
      body: text,
      parentCommentId,
      advocacyType,
      hearingDate,
      stance,
    });
    return NextResponse.json({
      ok: true,
      id: comment.id,
      createdAt: comment.createdAt.toISOString(),
      displayName: predictor.displayName,
      hasSavedProfile: predictor.email != null,
      nameChosen: predictor.nameChosenAt != null,
      identityDecided: predictor.identityDecidedAt != null,
      pointsEarned: advocacyType ? pointsFor(advocacyType) : 0,
    });
  } catch (err) {
    if (err instanceof CommentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "rate_limited" ? 429 : 400 });
    }
    console.error("Failed to submit comment:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!projectId && !slug) {
    return NextResponse.json({ error: "Provide slug or projectId." }, { status: 400 });
  }
  const project = await prisma.project.findUnique({
    where: projectId ? { id: projectId } : { slug },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  // The optional header (not a query string, so it stays out of URLs and logs)
  // lets the reply say which posts this visitor liked.
  const anonymousKey = req.headers.get("x-anonymous-key") ?? undefined;
  const discussion = await getProjectDiscussion(project.id, anonymousKey);
  return NextResponse.json(discussion);
}
