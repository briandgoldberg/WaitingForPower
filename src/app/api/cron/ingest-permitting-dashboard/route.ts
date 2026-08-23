// Scheduled Federal Permitting Dashboard refresh — see
// src/app/api/cron/ingest-eia/route.ts for the pattern this follows
// (CRON_SECRET auth, weekly schedule via vercel.json "crons"). This source
// is a live Socrata API query (no file download), so it's much cheaper
// than the EIA route — typically a couple seconds, well within any
// duration budget.

import { NextRequest, NextResponse } from "next/server";
import { ingestPermittingDashboard } from "@/lib/ingest/permittingDashboard";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestPermittingDashboard();
    console.log("Permitting Dashboard cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("Permitting Dashboard cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
