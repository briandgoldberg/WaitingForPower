import Link from "next/link";
import { AdvocacyFeed } from "@/components/AdvocacyFeed";
import { Leaderboard } from "@/components/Leaderboard";
import { getAdvocacyFeed } from "@/lib/advocacyFeed";
import { getTopAdvocates } from "@/lib/leaderboard";

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

type HomeFeed = "advocating" | "leaders";
const TABS: { value: HomeFeed; label: string }[] = [
  { value: "advocating", label: "Advocacy activity" },
  { value: "leaders", label: "Top advocates" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string; feed?: string }>;
}) {
  const { alert, feed: feedParam } = await searchParams;
  // Project changes now lives on /projects — this defaults to advocacy
  // activity instead.
  const feed: HomeFeed = feedParam === "leaders" ? "leaders" : "advocating";
  const alertMessage = alert ? ALERT_MESSAGES[alert] : undefined;

  const [advocacyResult, leaders] = await Promise.all([
    feed === "advocating" ? getAdvocacyFeed(0, 20) : Promise.resolve({ items: [], hasMore: false }),
    feed === "leaders" ? getTopAdvocates(25) : Promise.resolve([]),
  ]);
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
        <div className="flex flex-col gap-3">
          {/* The opening statement carries the weight; the rest is supporting detail in a lighter tone. */}
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight max-w-2xl">
            America&rsquo;s energy projects are stuck in permitting.{" "}
            <span className="font-normal text-[var(--muted)]">
              Every year of delay means higher bills, more pollution, and a grid falling further behind demand. We
              track every project and push for faster permitting decisions.
            </span>
          </h1>
          <Link
            href="/policies"
            className="flex items-center justify-center gap-1.5 self-stretch sm:self-start min-h-[48px] rounded-full bg-accent px-6 text-sm font-semibold shadow-sm hover:bg-accent/90 transition-colors"
            style={{ color: "white" }}
          >
            Advocate Now →
          </Link>
        </div>

        <div className="flex justify-between sm:justify-start gap-2 sm:gap-6 border-b border-[var(--border)]" role="tablist">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === "advocating" ? "/" : `/?feed=${tab.value}`}
              role="tab"
              aria-selected={feed === tab.value}
              className={`shrink-0 -mb-px px-0.5 pb-2.5 pt-1 max-[359px]:text-xs text-[13px] min-[400px]:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                feed === tab.value ? "border-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text-secondary)]"
              }`}
              style={feed === tab.value ? { color: "var(--accent)" } : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {feed === "advocating" && (
          <AdvocacyFeed initialItems={advocacyResult.items} initialHasMore={advocacyResult.hasMore} now={now} />
        )}
        {feed === "leaders" && <Leaderboard entries={leaders} />}
      </div>
    </>
  );
}
