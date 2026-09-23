import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashIp, srcTag } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

// Lists available point-in-time snapshots (id + metadata only, not the
// full `data` payload — see DatasetSnapshot in schema.prisma) so a caller
// can pick one before fetching it in full via GET /api/snapshots/[id].
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function GET(request: Request) {
  const ipHash = hashIp(request);
  prisma.apiRequestLog
    .create({
      data: { endpoint: "api_snapshots", method: "GET", userAgent: request.headers.get("user-agent"), ipHash, src: srcTag(request) },
    })
    .catch((err) => console.error("Failed to log /api/snapshots request:", err));

  if (await isRateLimited("api_snapshots", ipHash, { windowMs: 60_000, max: 30 })) {
    return rateLimitedResponse(60, CORS_HEADERS);
  }

  const snapshots = await prisma.datasetSnapshot.findMany({
    select: { id: true, createdAt: true, projectCount: true },
    orderBy: { id: "desc" },
  });

  return NextResponse.json({ snapshots }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
