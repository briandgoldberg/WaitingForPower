import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitComment, getProjectDiscussion, CommentError } from "@/lib/community";

export const dynamic = "force-dynamic";

// Human comment submission — same anonymous key + required nickname as
// predictions (see /api/predictions). Never a login.
export async function POST(req: NextRequest) {
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
  const replyToPredictionId = String(body.replyToPredictionId ?? "").trim() || undefined;

  if (!projectId || !anonymousKey || !text.trim()) {
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
      replyToPredictionId,
    });
    return NextResponse.json({
      ok: true,
      id: comment.id,
      createdAt: comment.createdAt.toISOString(),
      displayName: predictor.displayName,
      hasSavedProfile: predictor.email != null,
      nameChosen: predictor.nameChosenAt != null,
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
  // lets the reply say which posts this visitor liked and what they predicted.
  const anonymousKey = req.headers.get("x-anonymous-key") ?? undefined;
  const discussion = await getProjectDiscussion(project.id, anonymousKey);
  return NextResponse.json(discussion);
}
