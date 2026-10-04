// Internal feed of real, individually-filed public comments pulled from
// project dockets (see src/lib/ingest/caCecComments.ts for the first
// source — California Energy Commission docket logs). Deliberately not
// linked from nav/sitemap/robots — an unannounced path to look at the raw
// feed while this is still a first pass covering one state's docket
// system, not a finished, publicized feature.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const PAGE_SIZE = 100;

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function Test1Page() {
  const comments = await prisma.publicComment.findMany({
    orderBy: { filedDate: "desc" },
    take: PAGE_SIZE,
    include: { project: { select: { name: true, slug: true, state: true, fuelType: true } } },
  });

  const total = await prisma.publicComment.count();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Public comments feed (internal)</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {total.toLocaleString("en-US")} real, individually-filed public comments pulled from project docket
          filing indexes, newest first. First source: California Energy Commission docket logs — see{" "}
          <code className="text-xs">src/lib/ingest/caCecComments.ts</code>. Not every state's docket system is
          covered yet.
        </p>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No comments ingested yet. The cron hasn&rsquo;t run, or hasn&rsquo;t found any CEC-sourced projects.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {comments.map((c) => {
            const stateLabel = splitStateCodes(c.project.state).map((code) => STATE_NAMES[code] ?? code).join(", ");
            return (
              <li key={c.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3.5 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/project/${c.project.slug}`} className="font-semibold text-sm text-[var(--accent)] underline">
                    {c.project.name}
                  </Link>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{fmt(c.filedDate)}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {stateLabel || "Location not specified"} · Docket {c.docketLabel}
                  {c.filerName && <> · Filed by {c.filerName}</>}
                </p>
                <p className="text-sm">{c.title}</p>
                <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--accent)] underline w-fit">
                  View filing →
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
