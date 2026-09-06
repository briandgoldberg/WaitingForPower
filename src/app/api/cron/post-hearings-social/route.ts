// Auto-posts newly-found upcoming public hearings to Bluesky and/or
// Mastodon (see src/lib/social/postHearing.ts) — either, both, or neither
// platform can be configured via env vars; unconfigured platforms are a
// silent no-op so this cron is safe to ship and enable before any social
// account actually exists yet.
//
// Capped at POSTS_PER_RUN per run so turning this on for the first time
// (with ~39 real hearings already sitting in the DB) doesn't dump a burst
// of decades-old-feeling posts all at once — it trickles out over several
// days instead, same cadence a human would naturally post at.
//
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations — see src/app/api/cron/ingest-eia/route.ts for the same check.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUpcomingPublicHearingGroups } from "@/lib/hearings";
import { buildHearingPostText, postToBluesky, postToMastodon } from "@/lib/social/postHearing";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const POSTS_PER_RUN = 3;
const PLATFORMS = ["bluesky", "mastodon"] as const;

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await getUpcomingPublicHearingGroups();
  const allHearings = groups
    .flatMap((g) => g.hearings.map((h) => ({ project: g.project, hearing: h })))
    .sort((a, b) => new Date(a.hearing.date).getTime() - new Date(b.hearing.date).getTime());

  const alreadyPosted = await prisma.hearingSocialPost.findMany({
    select: { projectId: true, date: true, platform: true },
  });
  const postedKey = (projectId: string, date: string, platform: string) => `${projectId}|${date}|${platform}`;
  const postedSet = new Set(alreadyPosted.map((p) => postedKey(p.projectId, p.date.toISOString(), p.platform)));

  let posted = 0;
  let skippedNoPlatform = 0;
  const errors: string[] = [];

  for (const { project, hearing } of allHearings) {
    if (posted >= POSTS_PER_RUN) break;

    // Find the project's real id (project here only has slug/name/state/
    // hearingDetailsLink — see UpcomingHearingGroup — so look it up once
    // per candidate hearing rather than widening that shared query for
    // every other caller of getUpcomingPublicHearingGroups).
    const fullProject = await prisma.project.findUnique({ where: { slug: project.slug }, select: { id: true } });
    if (!fullProject) continue;

    const unpostedPlatforms = PLATFORMS.filter((p) => !postedSet.has(postedKey(fullProject.id, hearing.date, p)));
    if (unpostedPlatforms.length === 0) continue;

    const text = buildHearingPostText({
      projectName: project.name,
      state: project.state,
      dateLabel: dateLabel(hearing.date),
      location: hearing.location,
    });
    const url = `https://waitingforpower.com/project/${project.slug}`;

    let postedThisHearing = false;
    for (const platform of unpostedPlatforms) {
      const result = platform === "bluesky" ? await postToBluesky({ text, url }) : await postToMastodon({ text, url });
      if (result.skipped) {
        skippedNoPlatform++;
        continue;
      }
      if (!result.ok) {
        errors.push(`${platform} (${project.slug}): ${result.error}`);
        continue;
      }
      await prisma.hearingSocialPost.create({
        data: { projectId: fullProject.id, date: new Date(hearing.date), platform },
      });
      postedThisHearing = true;
    }
    if (postedThisHearing) posted++;
  }

  const summary = { ok: errors.length === 0, posted, skippedNoPlatform, errors };
  console.log("post-hearings-social cron:", summary);
  return NextResponse.json(summary);
}
