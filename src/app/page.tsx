import Link from "next/link";
import { getRecentChanges } from "@/lib/changes";
import { ChangesFeed } from "@/components/ChangesFeed";
import { StateFeedFilter } from "@/components/StateFeedFilter";
import { FeedSubscribeBox } from "@/components/FeedSubscribeBox";
import { STATE_NAMES, stateName } from "@/lib/data/usStates";

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

const ALERT_MESSAGES: Record<string, string> = {
  confirmed: "You're subscribed — we'll email you weekly with updates.",
  unsubscribed: "You've been unsubscribed from weekly feed updates.",
  invalid: "That link has expired or was already used.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; alert?: string }>;
}) {
  const { state: stateParam, alert } = await searchParams;
  const state = stateParam && stateParam.toUpperCase() in STATE_NAMES ? stateParam.toUpperCase() : null;
  const alertMessage = alert ? ALERT_MESSAGES[alert] : undefined;

  const { changes, hasMore } = await getRecentChanges(50, 0, state);
  // Passed down instead of letting ChangesFeed call `new Date()` itself —
  // see ChangesFeed's `now` prop comment for the hydration mismatch this
  // fixes.
  const now = new Date().toISOString();

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET_JSON_LD) }}
      />
      <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
        {alertMessage && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
            {alertMessage}
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Track America&rsquo;s energy permitting in real time.
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
            Every new filing, stage advance, approval, and cancellation, as it&rsquo;s detected.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)] whitespace-nowrap">
              Recent changes{state && ` in ${stateName(state)}`}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <StateFeedFilter state={state} />
              <FeedSubscribeBox state={state} />
              <Link
                href="/projects"
                className="self-start text-xs font-semibold px-3.5 py-1.5 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                View all projects →
              </Link>
            </div>
          </div>
        </div>

        {/* key={state}: ChangesFeed seeds its own state from initialChanges
            via useState's lazy initializer, which only runs once on mount —
            a client-side navigation to a new ?state= otherwise leaves the
            old filtered list on screen even though this server component
            re-rendered with fresh data (confirmed live: the "Recent changes
            in New York" heading updated but the cards below didn't). Keying
            by state forces a real remount when the filter changes. */}
        <ChangesFeed key={state ?? "all"} initialChanges={changes} initialHasMore={hasMore} now={now} state={state} />
      </div>
    </>
  );
}
