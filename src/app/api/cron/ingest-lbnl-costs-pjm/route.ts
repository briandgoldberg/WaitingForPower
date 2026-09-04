// Scheduled PJM interconnection-cost join — triggered by Vercel Cron (see
// vercel.json "crons"). Unlike EIA-860M or LBNL Queued Up, this source is a
// fixed historical analysis (through 2022), not a periodically-republished
// current file — runs monthly, not weekly, since there's nothing new to
// pick up most weeks. See src/lib/ingest/lbnlInterconnectionCostsPjm.ts for
// the join logic and src/app/api/cron/ingest-eia/route.ts for the
// CRON_SECRET auth pattern.

import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestPjmInterconnectionCosts } from "@/lib/ingest/lbnlInterconnectionCostsPjm";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await fetchAndIngestPjmInterconnectionCosts();
    console.log("PJM interconnection cost cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("PJM interconnection cost cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
