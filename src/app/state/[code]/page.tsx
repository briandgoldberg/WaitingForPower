import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { computeAggregateStats } from "@/lib/stats";
import { STATE_NAMES, splitStateCodes, stateName } from "@/lib/data/usStates";
import { StatsHeader } from "@/components/StatsHeader";
import { ProjectList } from "@/components/ProjectList";
import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function isValidCode(code: string): boolean {
  return code in STATE_NAMES;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!isValidCode(upper)) return {};

  const name = stateName(upper);
  const projects = await queryProjects(toFilterState({ state: upper }));
  const stats = computeAggregateStats(projects);

  const title = `${name} Energy Projects Waiting for Approval | WaitingForPower`;
  const description =
    stats.totalProjects > 0
      ? `${stats.totalProjects} energy project${stats.totalProjects === 1 ? "" : "s"} in ${name}, totaling ${Math.round(stats.totalCapacityMw).toLocaleString("en-US")} MW, currently waiting on permitting approval — live, sourced tracking of generation, transmission, storage, LNG, and pipeline projects.`
      : `Energy projects in ${name} currently waiting on permitting approval, tracked live from public federal and state sources.`;

  return {
    title,
    description,
    alternates: { canonical: `/state/${upper}` },
    openGraph: {
      title,
      description,
      url: `https://waitingforpower.com/state/${upper}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function StatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!isValidCode(upper)) notFound();

  const name = stateName(upper);
  const projects = await queryProjects(toFilterState({ state: upper }));
  const stats = computeAggregateStats(projects);
  // Projects in this state with opposition on record, for the link to
  // /state/[code]/opposition. Counts resolved projects too, like that page.
  const contested = (
    await prisma.project.findMany({
      where: { mergedIntoId: null, state: { contains: upper }, opposition: { some: {} } },
      select: { state: true },
    })
  ).filter((r) => splitStateCodes(r.state).includes(upper)).length;

  // Same "grounds the stat tooltips in a real project" pattern as the
  // /projects Explorer — see src/components/Explorer.tsx.
  const exampleProject =
    projects.find((p) => !p.isAggregateExample && p.investmentWaiting.applicable) ??
    projects.find((p) => !p.isAggregateExample) ??
    null;

  // Same schema.org Dataset markup as /projects, scoped to this state — see
  // that page for why (lets search engines and AI agents identify this as a
  // queryable dataset, not just a webpage).
  const DATASET_JSON_LD = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `WaitingForPower: ${name} Energy Project Permitting Tracker`,
    description: `Live, sourced dataset of energy projects in ${name} — generation, transmission, storage, LNG, and pipelines, every fuel type — currently waiting on permitting approval.`,
    url: `https://waitingforpower.com/state/${upper}`,
    license: "https://github.com/briandgoldberg/WaitingForPower/blob/main/LICENSE",
    creator: { "@type": "Person", name: "Brian Goldberg" },
    spatialCoverage: { "@type": "State", name },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `https://waitingforpower.com/api/projects?state=${upper}`,
    },
  };

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: "https://waitingforpower.com" },
    { name: "Projects", url: "https://waitingforpower.com/projects" },
    { name },
  ]);

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-2 flex flex-col gap-3 flex-1">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div>
        <Breadcrumbs items={[{ label: "All projects", href: "/projects" }, { label: name }]} />
        <h1 className="text-2xl font-bold tracking-tight mt-1">{name} energy projects waiting for approval</h1>
      </div>

      <StatsHeader
        stats={stats}
        exampleProject={exampleProject}
        status="in_permitting"
        opposition={{ count: contested, href: `/state/${upper}/opposition` }}
      />

      {projects.length > 0 ? (
        <ProjectList projects={projects} />
      ) : (
        <p className="text-sm text-[var(--muted)]">
          No projects are currently tracked as waiting in {name}.{" "}
          <Link href="/projects" className="underline">
            See every state →
          </Link>
        </p>
      )}
    </div>
  );
}
