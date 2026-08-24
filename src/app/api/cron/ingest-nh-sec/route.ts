// Scheduled New Hampshire SEC docket refresh — see
// src/app/api/cron/ingest-eia/route.ts for the pattern this follows
// (CRON_SECRET auth, weekly schedule via vercel.json "crons").

import { NextRequest, NextResponse } from "next/server";
import { ingestNhSecDockets } from "@/lib/ingest/nhSecDockets";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestNhSecDockets();
    console.log("New Hampshire SEC cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("New Hampshire SEC cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
