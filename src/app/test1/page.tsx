// UNLINKED preview page — not in nav, no canonical/sitemap entry, not meant
// to be found. One-shot mockup of "projects grouped by utility service
// territory" instead of by state, per EIA-861's Service Territory file
// (county -> utility names). See src/lib/data/utilityServiceTerritory.json
// (generated once from EIA-861 2024 data, not a live ingest module yet).
//
// Known imprecision, intentionally left as-is for this preview: a county
// often has several utilities on file (small municipal/co-op utilities
// alongside the main investor-owned one) — EIA-861's own data doesn't say
// which utility serves which specific parcel within a county, so a project
// is listed under every utility on file for its county rather than guessing
// which one actually serves it. This double (or triple-)counts some
// projects across utilities; a real build would need finer-than-county
// location data (or GIS service-territory polygons) to fix.
import territoryData from "@/lib/data/utilityServiceTerritory.json";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { ProjectList } from "@/components/ProjectList";
import { formatCapacity } from "@/lib/data/taxonomies";
import { formatUsd } from "@/lib/calc/investmentWaiting";

export const dynamic = "force-dynamic";
// Keeps this out of the sitemap and tells crawlers not to index it even if
// someone finds the URL — it's not linked from anywhere, but belt and
// suspenders for an unfinished preview.
export const metadata = { robots: { index: false, follow: false } };

const TERRITORY: Record<string, string[]> = territoryData;

export default async function Test1Page() {
  const projects = await queryProjects(toFilterState({}));

  const byUtility = new Map<string, typeof projects>();
  for (const p of projects) {
    if (!p.state || !p.county) continue;
    for (const stateCode of p.state.split(",").map((s) => s.trim())) {
      // County field sometimes carries multiple counties too (e.g. for a
      // transmission line) — split the same way.
      for (const countyName of p.county.split(",").map((c) => c.trim())) {
        const key = `${stateCode.toUpperCase()}|${countyName.toUpperCase()}`;
        const utilities = TERRITORY[key];
        if (!utilities) continue;
        for (const utility of utilities) {
          const list = byUtility.get(utility) ?? [];
          if (!list.some((x) => x.slug === p.slug)) list.push(p);
          byUtility.set(utility, list);
        }
      }
    }
  }

  const utilityRows = [...byUtility.entries()]
    .map(([utility, list]) => ({
      utility,
      projects: list,
      count: list.length,
      totalCapacityMw: list.reduce((s, p) => (p.capacityUnit === "MW" && p.capacityValue != null ? s + p.capacityValue : s), 0),
      totalInvestment: list.reduce((s, p) => s + (p.investmentWaiting.applicable ? (p.investmentWaiting.estimatedUsd ?? 0) : 0), 0),
    }))
    .filter((u) => u.count >= 3) // drop tiny single-project municipal utilities for this preview — too noisy to be useful
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
        <strong>Unlinked preview — /test1.</strong> Projects grouped by utility service territory
        (EIA-861 county-to-utility data) instead of by state. A county often lists several
        utilities, so a project may appear under more than one — see the comment at the top of
        this page&rsquo;s source for the known imprecision. Not indexed, not in nav.
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Energy projects waiting, by utility</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{utilityRows.length} utilities with 3+ tracked projects in their service territory</p>
      </div>

      <div className="flex flex-col gap-3">
        {utilityRows.map((u) => (
          <details key={u.utility} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{u.utility}</span>
              <span className="text-sm text-[var(--muted)]">
                {u.count} projects · {formatCapacity(u.totalCapacityMw, "MW")} ·{" "}
                {u.totalInvestment > 0 ? formatUsd(u.totalInvestment) : "—"} deferred investment
              </span>
            </summary>
            <div className="mt-4">
              <ProjectList projects={u.projects} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
