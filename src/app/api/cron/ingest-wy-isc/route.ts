// Scheduled Wyoming ISC docket refresh — see
// src/app/api/cron/ingest-eia/route.ts for the pattern this follows
// (CRON_SECRET auth, daily schedule via vercel.json "crons").

import { NextRequest, NextResponse } from "next/server";
import { ingestWyIscDockets } from "@/lib/ingest/wyIscDockets";

// One Drive folder fetch per energy-relevant candidate (~38, see the
// module header), politeness-delayed. Kept at the platform max for
// headroom, same as the other per-candidate-fetch sources in this series.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestWyIscDockets();
    console.log("Wyoming ISC cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("Wyoming ISC cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
