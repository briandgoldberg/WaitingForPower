// Monthly point-in-time capture of the entire dataset — see DatasetSnapshot
// in schema.prisma for why this exists (the live DB only ever holds current
// truth, so without this a researcher citing today's numbers has no way to
// re-fetch that exact state later). Deliberately captures every project
// regardless of status bucket (not just "in_permitting") — a snapshot is
// meant to answer "what did the whole dataset say," including
// resolved/cancelled projects, not just the site's default live view.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations — see src/app/api/cron/ingest-eia/route.ts for the same check.
// Upserts by first-of-month id, so a manual re-run the same month overwrites
// rather than duplicating.

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.project.findMany({
    include: { causes: true, sources: true, milestones: true, hearings: true },
  });
  const projects = rows.map(serializeProject);
  const data = projects as unknown as Prisma.InputJsonValue;

  const now = new Date();
  const id = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  await prisma.datasetSnapshot.upsert({
    where: { id },
    create: { id, projectCount: projects.length, data },
    update: { projectCount: projects.length, data, createdAt: now },
  });

  console.log("snapshot-dataset cron:", { id, projectCount: projects.length });
  return NextResponse.json({ ok: true, id, projectCount: projects.length });
}
