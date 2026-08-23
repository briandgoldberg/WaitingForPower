// Scheduled Ohio Power Siting Board refresh — see
// src/app/api/cron/ingest-eia/route.ts for the pattern this follows
// (CRON_SECRET auth, weekly schedule via vercel.json "crons").

import { NextRequest, NextResponse } from "next/server";
import { ingestOhOpsbCases } from "@/lib/ingest/ohOpsbCases";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestOhOpsbCases();
    console.log("Ohio OPSB cron ingestion:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("Ohio OPSB cron ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
