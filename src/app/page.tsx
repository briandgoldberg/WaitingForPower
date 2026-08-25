import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRecentChanges } from "@/lib/changes";
import { ChangesFeed } from "@/components/ChangesFeed";
import { RESOLVED_STAGES } from "@/lib/data/taxonomies";

export const dynamic = "force-dynamic";

// schema.org Dataset markup — lets search engines and AI agents identify
// this as a queryable dataset (with a machine-readable distribution) rather
// than just a webpage. See also /llms.txt and /api/projects.
const DATASET_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "WaitingForPower: U.S. Energy Project Permitting Tracker",
  description:
    "Live, sourced dataset of U.S. energy projects — generation, transmission, storage, LNG, and pipelines, every fuel type — currently stuck waiting on permitting approval, merged from public federal/state sources and refreshed automatically.",
  url: "https://waitingforpower.com",
  license: "https://github.com/briandgoldberg/WaitingForPower/blob/main/LICENSE",
  creator: { "@type": "Person", name: "Brian Goldberg" },
  spatialCoverage: { "@type": "Place", name: "United States" },
  keywords: [
    "energy",
    "permitting reform",
    "renewable energy",
    "transmission",
    "solar",
    "wind",
    "pipelines",
    "clean energy",
    "infrastructure",
  ],
  distribution: {
    "@type": "DataDownload",
    encodingFormat: "application/json",
    contentUrl: "https://waitingforpower.com/api/projects",
  },
};

export default async function HomePage() {
  const [{ changes, hasMore }, totalWaiting] = await Promise.all([
    getRecentChanges(50),
    prisma.project.count({
      where: { currentStage: { notIn: RESOLVED_STAGES }, isAggregateExample: false },
    }),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET_JSON_LD) }}
      />
      <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Know what&rsquo;s changing at America&rsquo;s energy projects.
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
            Real-time intelligence on U.S. energy permitting — every new filing, stage advance,
            approval, and cancellation, as it&rsquo;s detected. This is the same feed a custom
            data feed, API, or notification subscription is built from.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Recent changes
          </h2>
          <Link href="/contact" className="text-xs underline text-[var(--accent)]">
            Get a custom feed →
          </Link>
        </div>

        <ChangesFeed initialChanges={changes} initialHasMore={hasMore} />

        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm">
            <strong>{totalWaiting.toLocaleString("en-US")} projects</strong> currently waiting on
            a permitting decision, across every U.S. state we track.
          </p>
          <Link
            href="/projects"
            className="text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--accent)] text-white hover:opacity-90"
          >
            Explore the map & full list →
          </Link>
        </div>
      </div>
    </>
  );
}
