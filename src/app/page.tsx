import Link from "next/link";
import { getRecentChanges } from "@/lib/changes";
import { ChangesFeed } from "@/components/ChangesFeed";
import { AdvocacyFeed } from "@/components/AdvocacyFeed";
import { Leaderboard } from "@/components/Leaderboard";
import { getAdvocacyFeed } from "@/lib/advocacyFeed";
import { getTopAdvocates } from "@/lib/leaderboard";
import { STATE_NAMES } from "@/lib/data/usStates";

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
  "profile-saved": "Email confirmed. Your name and history are saved.",
  "email-taken": "That email already has a saved profile. Sign in with it instead.",
};

type HomeFeed = "changes" | "advocating" | "leaders";
const TABS: { value: HomeFeed; label: string; shortLabel: string }[] = [
  { value: "changes", label: "Project changes", shortLabel: "Changes" },
  { value: "advocating", label: "What people are advocating for", shortLabel: "Advocating" },
  { value: "leaders", label: "Top advocates", shortLabel: "Leaders" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; alert?: string; feed?: string }>;
}) {
  const { state: stateParam, alert, feed: feedParam } = await searchParams;
  // Project changes stays the default — the other two tabs start out
  // thinner and will fill in as people actually use the new advocacy tools.
  const feed: HomeFeed = feedParam === "advocating" || feedParam === "leaders" ? feedParam : "changes";
  const state = stateParam && stateParam.toUpperCase() in STATE_NAMES ? stateParam.toUpperCase() : null;
  const alertMessage = alert ? ALERT_MESSAGES[alert] : undefined;

  const [changesResult, advocacyResult, leaders] = await Promise.all([
    feed === "changes" ? getRecentChanges(50, 0, state) : Promise.resolve({ changes: [], hasMore: false }),
    feed === "advocating" ? getAdvocacyFeed(0, 20) : Promise.resolve({ items: [], hasMore: false }),
    feed === "leaders" ? getTopAdvocates(25) : Promise.resolve([]),
  ]);
  const { changes, hasMore } = changesResult;
  // Passed down instead of letting the feed components call `new Date()`
  // themselves — see ChangesFeed's `now` prop comment for the hydration
  // mismatch this fixes.
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
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Track America&rsquo;s energy permitting in real time.
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Projects wait years for a yes or no. That&rsquo;s not a technology problem, it&rsquo;s a paperwork problem.{" "}
            <Link href="/policies" className="font-semibold text-[var(--accent)] underline whitespace-nowrap">
              Advocate now →
            </Link>
          </p>
        </div>

        <div className="flex gap-4 sm:gap-6 border-b border-[var(--border)]" role="tablist">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === "changes" ? "/" : `/?feed=${tab.value}`}
              role="tab"
              aria-selected={feed === tab.value}
              className={`shrink-0 -mb-px px-0.5 pb-2.5 pt-1 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                feed === tab.value ? "border-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text-secondary)]"
              }`}
              style={feed === tab.value ? { color: "var(--accent)" } : undefined}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          ))}
        </div>

        {feed === "changes" && (
          <>
            <h2 className="text-sm font-semibold">Recent changes</h2>
            {/* key={state}: ChangesFeed seeds its own state from initialChanges
                via useState's lazy initializer, which only runs once on mount —
                a client-side navigation to a new ?state= otherwise leaves the
                old filtered list on screen even though this server component
                re-rendered with fresh data. Keying by state forces a real
                remount when the filter changes. */}
            <ChangesFeed key={state ?? "all"} initialChanges={changes} initialHasMore={hasMore} now={now} state={state} />
          </>
        )}
        {feed === "advocating" && (
          <AdvocacyFeed initialItems={advocacyResult.items} initialHasMore={advocacyResult.hasMore} now={now} />
        )}
        {feed === "leaders" && <Leaderboard entries={leaders} />}
      </div>
    </>
  );
}
