// Scheduled LBNL Queued Up refresh — triggered by Vercel Cron (see
// vercel.json "crons"). LBNL only republishes this dataset annually, but
// this runs weekly like the other sources: cheap (one HTML fetch on weeks
// the current edition hasn't changed) and picks up a new edition within a
// week of publication with no manual step.
//
// See src/app/api/cron/ingest-eia/route.ts for the CRON_SECRET auth pattern
// and why maxDuration is generous — same reasoning applies here (15MB
// workbook download + parse + batched upsert).

import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestCurrentWorkbook } from "@/lib/ingest/lbnlQueuedUp";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await fetchAndIngestCurrentWorkbook();
    console.log("LBNL Queued Up cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("LBNL Queued Up cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
