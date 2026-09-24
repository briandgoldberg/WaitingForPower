import { NextRequest, NextResponse } from "next/server";
import { getAdvocacyFeed } from "@/lib/advocacyFeed";

export const dynamic = "force-dynamic";

// Paging for the home "What people are advocating for" tab — see
// src/components/AdvocacyFeed.tsx.
export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20));
  const { items, hasMore } = await getAdvocacyFeed(offset, limit);
  return NextResponse.json({ items, hasMore });
}
