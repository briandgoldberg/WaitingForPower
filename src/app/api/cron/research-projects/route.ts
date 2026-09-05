// Scheduled project-research pass — see src/lib/research/projectResearch.ts
// for what this actually does (reasons for/against + comment-period
// extraction, one time per project). Same CRON_SECRET-auth pattern as
// src/app/api/cron/ingest-eia/route.ts.
//
// BATCH_SIZE=30 hourly clears the ~3,637-project one-time backfill in
// roughly 5 days while staying well inside maxDuration and being gentle on
// both the ~40 docket sites this hits and the Anthropic API; ongoing new
// projects from the other ingestion crons join the same oldest-first queue
// automatically (see researchProjects's orderBy).

import { NextRequest, NextResponse } from "next/server";
import { researchProjects } from "@/lib/research/projectResearch";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await researchProjects(BATCH_SIZE);
    console.log("project-research cron:", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("project-research cron failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
