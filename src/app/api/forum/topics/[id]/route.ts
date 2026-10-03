import { NextRequest, NextResponse } from "next/server";
import { getForumTopic, deleteTopic, ForumError } from "@/lib/forum";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = await getForumTopic(id);
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  return NextResponse.json(topic);
}

// Lets a poster delete their own topic — ownership is checked server-side
// against the anonymousKey's resolved Predictor row, never trusted from the
// client (see deleteTopic in lib/forum.ts).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const anonymousKey = req.nextUrl.searchParams.get("anonymousKey") ?? "";
  if (!anonymousKey) return NextResponse.json({ error: "Missing anonymousKey." }, { status: 400 });

  try {
    await deleteTopic({ anonymousKey, topicId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForumError) {
      const status = err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("Failed to delete forum topic:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
