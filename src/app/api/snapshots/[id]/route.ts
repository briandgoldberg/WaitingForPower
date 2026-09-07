import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  prisma.apiRequestLog
    .create({ data: { endpoint: "api_snapshots", method: "GET", userAgent: request.headers.get("user-agent"), query: id } })
    .catch((err) => console.error("Failed to log /api/snapshots/[id] request:", err));

  const snapshot = await prisma.datasetSnapshot.findUnique({ where: { id } });
  if (!snapshot) {
    return NextResponse.json({ error: `No snapshot found for "${id}". See /api/snapshots for available ids.` }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json(snapshot, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
