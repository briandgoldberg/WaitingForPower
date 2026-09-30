// Scheduled load of the hand-researched opposition records — see
// src/app/api/cron/ingest-local-hearings/route.ts for the pattern this
// follows (CRON_SECRET auth, daily schedule via vercel.json "crons").
// Runs after the state docket crons so the opposition cause tag it sets is
// the last word for the day.

import { NextRequest, NextResponse } from "next/server";
import { ingestOpposition } from "@/lib/ingest/opposition";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await ingestOpposition();
    console.log("Opposition cron:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("Opposition cron failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
