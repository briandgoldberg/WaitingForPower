// Scheduled EIA-860M refresh — triggered by Vercel Cron (see vercel.json
// "crons"). EIA republishes the "Planned" generator inventory monthly;
// this runs weekly and just no-ops most weeks once it finds the same file
// it already ingested — cheap, and simpler than trying to predict EIA's
// exact release day. Weekly (not daily) is a deliberate cost tradeoff: it
// bounds staleness to ~1 week behind EIA's own publish rather than ~3 days,
// in exchange for a fraction of the invocation volume.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations once CRON_SECRET is set in the project's env vars — checked
// below so this endpoint can't be triggered by a random request hitting the
// URL. See https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
//
// Runtime budget: ingestion used to be ~5 sequential DB round trips per
// project (minutes for a few hundred rows) — too slow for a serverless
// function's time limit. upsertNormalizedProjects (src/lib/ingest/common.ts)
// batches with bounded concurrency instead, which is what makes running
// this on a schedule feasible at all. maxDuration below is set generously
// in case of a slow day on EIA's or the database's end; typical runs should
// finish in well under it.

import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestCurrentWorkbook } from "@/lib/ingest/eia860mPlanned";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await fetchAndIngestCurrentWorkbook();
    console.log("EIA-860M cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("EIA-860M cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
