// Scheduled EIA Natural Gas Pipeline Projects refresh — see
// src/app/api/cron/ingest-lbnl/route.ts for the pattern this follows
// (CRON_SECRET auth, weekly schedule via vercel.json "crons", quarterly
// source checked weekly because that's cheap and needs no manual step).

import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestCurrentWorkbook } from "@/lib/ingest/eiaPipelineProjects";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await fetchAndIngestCurrentWorkbook();
    console.log("EIA pipeline projects cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("EIA pipeline projects cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
