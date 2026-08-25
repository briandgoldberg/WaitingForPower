// Scheduled North Carolina NCUC docket refresh — see
// src/app/api/cron/ingest-eia/route.ts for the pattern this follows
// (CRON_SECRET auth, daily schedule via vercel.json "crons").

import { NextRequest, NextResponse } from "next/server";
import { ingestNcNcucDockets } from "@/lib/ingest/ncNcucDockets";

// Two requests per candidate (Dockets search + a per-candidate Orders
// lookup), politeness-delayed — see the module header for real observed
// candidate volume (~21-30 over an 8-year window). Kept at the platform
// max for headroom, same as the other order-lookup-per-candidate sources
// in this series (ND, SD).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestNcNcucDockets();
    console.log("North Carolina NCUC cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("North Carolina NCUC cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
