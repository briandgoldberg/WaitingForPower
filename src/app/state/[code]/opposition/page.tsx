import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import type { ProjectDTO } from "@/lib/types";
import { STATE_NAMES, splitStateCodes, stateName } from "@/lib/data/usStates";
import { FUEL_TYPE_BY_VALUE, formatCapacity, PROJECT_STAGE_BY_VALUE } from "@/lib/data/taxonomies";
import { outcomeOf } from "@/lib/projectOutcome";
import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbs";

export const dynamic = "force-dynamic";

// Every tracked project in a state with sourced opposition on record,
// grouped by county, so a search like "<county> solar opposition" lands on
// something useful. Reached only from the state page, not the site nav.
const getContested = cache(async (code: string): Promise<ProjectDTO[]> => {
  const rows = await prisma.project.findMany({
    where: { mergedIntoId: null, state: { contains: code }, opposition: { some: {} } },
    include: { causes: true, sources: true, milestones: true, hearings: true, opposition: true },
  });
  return rows
    .filter((r) => splitStateCodes(r.state).includes(code))
    .map((r) => serializeProject(r))
    .sort((a, b) => (b.opposition[0]?.date ?? "").localeCompare(a.opposition[0]?.date ?? ""));
});

function statusText(p: ProjectDTO): string {
  const outcome = outcomeOf(p);
  if (outcome === "approved") return "Approved";
  if (outcome === "cancelled") return "Cancelled";
  if (outcome === "no_longer_reported") return "No longer listed";
  return `Pending: ${PROJECT_STAGE_BY_VALUE[p.currentStage] ?? p.currentStage}`;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!(upper in STATE_NAMES)) return {};
  const name = stateName(upper);
  const projects = await getContested(upper);
  const counties = [...new Set(projects.map((p) => p.county).filter(Boolean))];
  const title = `${name} Energy Project Opposition | WaitingForPower`;
  const description =
    projects.length > 0
      ? `${projects.length} ${name} energy project${projects.length === 1 ? "" : "s"} with opposition on record${counties.length > 0 ? `, in ${counties.slice(0, 3).join(", ")}${counties.length > 3 ? " and more" : ""}` : ""}: intervenors, local votes, moratoria and lawsuits, each with its source.`
      : `Sourced opposition to energy projects in ${name}: intervenors, local votes, moratoria and lawsuits.`;
  return {
    title,
    description,
    alternates: { canonical: `/state/${upper}/opposition` },
    // An empty page isn't worth indexing.
    ...(projects.length === 0 ? { robots: { index: false } } : {}),
    openGraph: { title, description, url: `https://waitingforpower.com/state/${upper}/opposition`, type: "website" },
  };
}

export default async function StateOppositionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!(upper in STATE_NAMES)) notFound();
  const name = stateName(upper);
  const projects = await getContested(upper);

  const byCounty = new Map<string, ProjectDTO[]>();
  for (const p of projects) {
    const county = p.county ?? "County not listed";
    byCounty.set(county, [...(byCounty.get(county) ?? []), p]);
  }
  const counties = [...byCounty.keys()].sort((a, b) =>
    a === "County not listed" ? 1 : b === "County not listed" ? -1 : a.localeCompare(b),
  );

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: "https://waitingforpower.com" },
    { name: "Projects", url: "https://waitingforpower.com/projects" },
    { name, url: `https://waitingforpower.com/state/${upper}` },
    { name: "Opposition" },
  ]);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-4 flex flex-col gap-5">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href={`/state/${upper}`} className="underline">
            {name}
          </Link>{" "}
          ›
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-1">{name} energy project opposition</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Sourced public records, by county. Not a complete list.</p>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          None on record yet.{" "}
          <Link href={`/state/${upper}`} className="underline">
            Back to {name} →
          </Link>
        </p>
      ) : (
        counties.map((county) => (
          <section key={county} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{county}</h2>
            {byCounty.get(county)!.map((p) => (
              <article key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
                <h3 className="font-semibold">
                  <Link href={`/project/${p.slug}`} className="text-[var(--accent)] underline">
                    {p.name}
                  </Link>
                </h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {[
                    p.capacityValue != null ? formatCapacity(p.capacityValue, p.capacityUnit) : null,
                    FUEL_TYPE_BY_VALUE[p.fuelType]?.label,
                    p.applicant,
                    statusText(p),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {p.opposition.map((o, i) => (
                    <li key={i} className="text-sm leading-snug">
                      <span className="font-medium">{o.party}</span>
                      <span className="text-[var(--text-secondary)]">: {o.action}</span>
                      {o.date && <span className="text-[var(--muted)]"> ({fmt(o.date)})</span>}{" "}
                      <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] underline">
                        Source
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
