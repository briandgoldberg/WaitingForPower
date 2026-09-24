import { NextRequest, NextResponse } from "next/server";
import { getForumTopic } from "@/lib/forum";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = await getForumTopic(id);
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  return NextResponse.json(topic);
}
