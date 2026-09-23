import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashIp, srcTag } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ipHash = hashIp(request);
  prisma.apiRequestLog
    .create({
      data: { endpoint: "api_snapshots", method: "GET", userAgent: request.headers.get("user-agent"), query: id, ipHash, src: srcTag(request) },
    })
    .catch((err) => console.error("Failed to log /api/snapshots/[id] request:", err));

  // Each snapshot is the whole dataset's worth of data, so a tighter cap
  // than the lightweight listing endpoint above.
  if (await isRateLimited("api_snapshots", ipHash, { windowMs: 60_000, max: 20 })) {
    return rateLimitedResponse(60, CORS_HEADERS);
  }

  const snapshot = await prisma.datasetSnapshot.findUnique({ where: { id } });
  if (!snapshot) {
    return NextResponse.json({ error: `No snapshot found for "${id}". See /api/snapshots for available ids.` }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json(snapshot, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
