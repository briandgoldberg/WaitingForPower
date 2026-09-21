// Daily cross-source duplicate merge (see src/lib/dedupe.ts). Runs after the
// day's ingests so newly appearing projects are matched, and un-merges any
// pair a later ingest no longer supports.

import { NextRequest, NextResponse } from "next/server";
import { syncMerges } from "@/lib/dedupe";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await syncMerges();
    console.log("dedupe cron:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("dedupe cron failed:", err);
    return NextResponse.json({ ok: false, error: "dedupe failed" }, { status: 500 });
  }
}
