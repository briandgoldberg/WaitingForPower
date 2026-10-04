// Scheduled refresh of individually-filed public comments from CEC docket
// logs — see src/app/api/cron/ingest-eia/route.ts for the pattern this
// follows (CRON_SECRET auth, vercel.json "crons"). Separate from
// ingest-ca-cec (which tracks project status/hearings) since this reads a
// different set of rows off the same docket pages — see
// src/lib/ingest/caCecComments.ts.

import { NextRequest, NextResponse } from "next/server";
import { ingestCaCecComments } from "@/lib/ingest/caCecComments";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestCaCecComments();
    console.log("California CEC public comments cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("California CEC public comments cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
