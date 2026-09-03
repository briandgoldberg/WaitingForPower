import { NextResponse } from "next/server";
import { getRecentChanges } from "@/lib/changes";

// Public, read-only, no key required — same CORS-open convention as
// /api/projects. Backs the homepage feed's "Load more" pagination
// (src/components/ChangesFeed.tsx), but also usable directly by anyone who
// wants a raw feed of recent project changes.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get("limit")) || PAGE_SIZE));
  const state = searchParams.get("state");

  const { changes, hasMore } = await getRecentChanges(limit, offset, state);

  return NextResponse.json({ changes, hasMore, nextOffset: offset + changes.length }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
