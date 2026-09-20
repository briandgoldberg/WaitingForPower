import { NextRequest, NextResponse } from "next/server";
import { getCommunityFeed } from "@/lib/community";

export const dynamic = "force-dynamic";

// Paging for the home "What people think" feed — see CommunityFeed.tsx.
export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20));
  const { items, hasMore } = await getCommunityFeed(offset, limit);
  return NextResponse.json({ items, hasMore });
}
