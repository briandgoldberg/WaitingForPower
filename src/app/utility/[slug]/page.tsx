// A utility-company detail page: the same underlying tracked projects as
// /projects, scoped to one utility's service territory (EIA-861 county
// data — see src/lib/utilityGrouping.ts for the known imprecision), framed
// around the dollar figure a utility stakeholder cares about most — how
// much investment is sitting in permitting limbo in their territory —
// rather than the generic 4-tile stats grid other pages lead with.
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";
import { computeAggregateStats } from "@/lib/stats";
import { formatUsd } from "@/lib/calc/investmentWaiting";
import { StatsHeader } from "@/components/StatsHeader";
import { ProjectList } from "@/components/ProjectList";
import { Map } from "@/components/Map";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbs";

export const dynamic = "force-dynamic";

// Deduped per-request via React's cache() so generateMetadata and the page
// component (both invoked separately by Next.js for the same request)
// don't double the DB round trip — same pattern as /project/[id].
const getUtility = cache(async (slug: string) => {
  const full = await queryProjects(toFilterState({}));
  // Same trim as /projects — neither StatsHeader/Map/ProjectList reads
  // these relation arrays here, and a project can land in several utility
  // groups at once (see utilityGrouping.ts), so duplicating them per group
  // would balloon this page's hydration payload.
  const projects = full.map((p) => ({ ...p, sources: [], milestones: [], statusHistory: [], hearings: [], opposition: [] }));
  // minCount: 1 — a utility linked from a smaller /state/[code] accordion
  // should never 404 just because it's under the 3-project noise floor
  // used for the /utilities hub and sitemap listing (see those for why).
  const group = groupProjectsByUtility(projects, { minCount: 1 }).find((g) => g.slug === slug);
  if (!group) return null;
  const groupProjects = projects.filter((p) => group.projectSlugs.includes(p.slug));
  return { group, groupProjects };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getUtility(slug);
  if (!data) return {};
  const { group, groupProjects } = data;
  const stats = computeAggregateStats(groupProjects);

  const title = `${group.utility} — Energy Projects Waiting on Permitting | WaitingForPower`;
  const description =
    stats.totalProjects > 0
      ? `${formatUsd(stats.totalInvestmentWaitingUsd)} in construction investment waiting on permitting across ${stats.totalProjects} project${stats.totalProjects === 1 ? "" : "s"} in ${group.utility}’s service territory — live, sourced tracking of U.S. energy projects.`
      : `Energy projects in ${group.utility}’s service territory currently waiting on permitting approval, tracked live from public federal and state sources.`;

  return {
    title,
    description,
    alternates: { canonical: `/utility/${group.slug}` },
    // Thin content below the /utilities hub's own noise floor (3 projects)
    // stays reachable (so a state-page link never 404s) but isn't promoted
    // for indexing — same precedent as /state/[code]/opposition's
    // empty-state noindex.
    ...(group.count < 3 ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      url: `https://waitingforpower.com/utility/${group.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function UtilityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getUtility(slug);
  if (!data) notFound();
  const { group, groupProjects } = data;

  const stats = computeAggregateStats(groupProjects);
  const exampleProject = groupProjects.find((p) => p.investmentWaiting.applicable) ?? groupProjects[0] ?? null;

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: "https://waitingforpower.com" },
    { name: "Projects", url: "https://waitingforpower.com/projects" },
    { name: "Utility companies", url: "https://waitingforpower.com/utilities" },
    { name: group.utility },
  ]);

  // Same schema.org Dataset markup as /projects and /state/[code], scoped to
  // this utility's service territory.
  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `WaitingForPower: ${group.utility} Energy Project Permitting Tracker`,
    description: `Live, sourced dataset of energy projects in ${group.utility}’s service territory — generation, transmission, storage, LNG, and pipelines, every fuel type — currently waiting on permitting approval.`,
    url: `https://waitingforpower.com/utility/${group.slug}`,
    license: "https://github.com/briandgoldberg/WaitingForPower/blob/main/LICENSE",
    creator: { "@type": "Person", name: "Brian Goldberg" },
    spatialCoverage: { "@type": "Place", name: "United States" },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "https://waitingforpower.com/api/projects",
    },
  };

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 flex flex-col gap-4">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />

      <div>
        <Breadcrumbs items={[{ label: "All projects", href: "/projects" }, { label: "Utility companies", href: "/utilities" }, { label: group.utility }]} />
        <h1 className="text-3xl font-bold tracking-tight mt-1">{group.utility}</h1>
      </div>

      {/* Money-first hero: the one number a utility/investor audience for
          this page cares about most, well above the generic stats grid. */}
      <div className="rounded-2xl border-2 border-violet-400/60 dark:border-violet-700/60 bg-gradient-to-br from-violet-50 to-[var(--panel)] dark:from-violet-950/40 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <svg viewBox="0 0 24 24" aria-hidden className="h-14 w-14 sm:h-16 sm:w-16 shrink-0">
          <circle cx="12" cy="12" r="10" className="fill-violet-500 dark:fill-violet-400" />
          <circle cx="12" cy="12" r="7.6" fill="none" strokeWidth="1" className="stroke-violet-200 dark:stroke-violet-800" />
          <text x="12" y="16.4" textAnchor="middle" fontSize="12.5" fontWeight="700" className="fill-white dark:fill-violet-950">
            $
          </text>
        </svg>
        <div className="min-w-0">
          <div className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
            {formatUsd(stats.totalInvestmentWaitingUsd)}
          </div>
          <div className="text-sm sm:text-base text-[var(--text-secondary)] mt-1">
            in construction investment waiting on permitting across {stats.totalProjects.toLocaleString("en-US")}{" "}
            project{stats.totalProjects === 1 ? "" : "s"} in {group.utility}&rsquo;s service territory — money that
            could start flowing as soon as these clear review.
          </div>
          <div className="text-xs text-[var(--muted)] mt-2">
            {stats.investmentWaitingCoverageCount}/{stats.totalProjects} projects have an applicable cost estimate.{" "}
            <Link href="/methodology" className="underline">
              See methodology
            </Link>
            .
          </div>
        </div>
      </div>

      <StatsHeader stats={stats} exampleProject={exampleProject} status="in_permitting" />

      <p className="text-xs text-[var(--muted)]">
        Grouped by utility service territory (EIA-861 county data). A county often lists several utilities, so a
        project may appear under more than one utility&rsquo;s page — this is a known approximation, not a precise
        match.
      </p>

      <div className="h-[55vh] min-h-[320px] lg:h-[460px]">
        <Map projects={groupProjects} />
      </div>

      <ProjectList projects={groupProjects} />
    </div>
  );
}
