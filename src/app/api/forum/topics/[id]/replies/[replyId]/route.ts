import { NextRequest, NextResponse } from "next/server";
import { deleteReply, ForumError } from "@/lib/forum";

export const dynamic = "force-dynamic";

// Lets a poster delete their own reply — same ownership check as the topic
// DELETE handler (see deleteReply in lib/forum.ts).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  const { replyId } = await params;
  const anonymousKey = req.nextUrl.searchParams.get("anonymousKey") ?? "";
  if (!anonymousKey) return NextResponse.json({ error: "Missing anonymousKey." }, { status: 400 });

  try {
    await deleteReply({ anonymousKey, replyId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForumError) {
      const status = err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("Failed to delete forum reply:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
