import Link from "next/link";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";

export interface ReadableComment {
  id: string;
  filedDate: string; // ISO
  filerName: string | null;
  title: string;
  sourceUrl: string;
  docketLabel: string;
  projectName: string;
  projectSlug: string;
  projectState: string | null;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

// Real, individually-filed public comments pulled from project docket
// filing indexes — see src/lib/ingest/caCecComments.ts for the first
// source (California). Read-only: this is other people's real public
// input, not something submitted through this site.
export function ReadPublicCommentsSection({ comments, total }: { comments: ReadableComment[]; total: number }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-3xl font-bold tracking-tight max-w-2xl">See what people are telling regulators.</h2>

      {comments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Coming soon!</p>
      ) : (
        <>
        <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
          {total.toLocaleString("en-US")} real public comments pulled from project docket filings, newest first. Not
          every state&rsquo;s docket system is covered yet.
        </p>
        <ul className="flex flex-col gap-2.5">
          {comments.map((c) => {
            const stateLabel = splitStateCodes(c.projectState).map((code) => STATE_NAMES[code] ?? code).join(", ");
            return (
              <li key={c.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3.5 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/project/${c.projectSlug}`} className="font-semibold text-sm text-[var(--accent)] underline">
                    {c.projectName}
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
        </>
      )}
    </div>
  );
}
