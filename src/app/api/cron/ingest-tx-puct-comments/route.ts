// Scheduled refresh of individually-filed public comments from Texas PUCT
// docket filing indexes — see src/app/api/cron/ingest-eia/route.ts for the
// pattern this follows (CRON_SECRET auth, vercel.json "crons"). Separate
// from ingest-tx-puct (which tracks project status/resolution) since this
// reads a different subset of the same filings rows — see
// src/lib/ingest/txPuctComments.ts.

import { NextRequest, NextResponse } from "next/server";
import { ingestTxPuctComments } from "@/lib/ingest/txPuctComments";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestTxPuctComments();
    console.log("Texas PUCT public comments cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("Texas PUCT public comments cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
