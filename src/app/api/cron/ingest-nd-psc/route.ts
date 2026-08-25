// Scheduled North Dakota PSC docket refresh — see
// src/app/api/cron/ingest-eia/route.ts for the pattern this follows
// (CRON_SECRET auth, weekly schedule via vercel.json "crons").

import { NextRequest, NextResponse } from "next/server";
import { ingestNdPscDockets } from "@/lib/ingest/ndPscDockets";

// This module's real timing (see the module header) runs closer to the
// 300s ceiling than any other source in this series (order-PDF fetch +
// parse per resolved candidate) — maxDuration is kept at the platform
// max, not shortened, for headroom.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestNdPscDockets();
    console.log("North Dakota PSC cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("North Dakota PSC cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
