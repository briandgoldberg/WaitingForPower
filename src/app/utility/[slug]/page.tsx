// A utility-company detail page: the same underlying tracked projects as
// /projects, scoped to one utility's service territory (EIA-861 county
// data — see src/lib/utilityGrouping.ts for the known imprecision), framed
// around the dollar figure a utility stakeholder cares about most — how
// much investment is sitting in permitting limbo in their territory —
// rather than the generic 4-tile stats grid other pages lead with.
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";
import { computeAggregateStats } from "@/lib/stats";
import { formatUsd } from "@/lib/calc/investmentWaiting";
import { StatsHeader } from "@/components/StatsHeader";
import { UtilityProjectsView } from "@/components/UtilityProjectsView";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShareButtons } from "@/components/ShareButtons";
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
  const group = groupProjectsByUtility(projects).find((g) => g.slug === slug);
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <Breadcrumbs items={[{ label: "All projects", href: "/projects" }, { label: "Utility companies", href: "/utilities" }, { label: group.utility }]} />
          <ShareButtons
            url={`https://waitingforpower.com/utility/${group.slug}`}
            text={`${formatUsd(stats.totalInvestmentWaitingUsd)} in construction investment waiting on permitting in ${group.utility}'s service territory. Tracked on WaitingForPower.`}
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">{group.utility}</h1>
      </div>

      <StatsHeader stats={stats} exampleProject={exampleProject} status="in_permitting" />

      <UtilityProjectsView projects={groupProjects} />
    </div>
  );
}
