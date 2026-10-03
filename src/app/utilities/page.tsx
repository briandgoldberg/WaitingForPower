import type { Metadata } from "next";
import Link from "next/link";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Energy Projects by Utility Company | WaitingForPower",
  description:
    "Browse U.S. energy projects waiting on permitting approval by utility company — generation, transmission, storage, LNG, and pipeline projects, live and sourced.",
  alternates: { canonical: "/utilities" },
};

export default async function UtilitiesIndexPage() {
  const projects = await queryProjects(toFilterState(DEFAULT_FILTERS));
  const groups = groupProjectsByUtility(projects);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Energy projects by utility company</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          {groups.length} utility companies with at least one project currently waiting on a permitting
          decision, tracked live from public federal and state sources.{" "}
          <Link href="/projects" className="underline text-[var(--accent)]">
            See the full map →
          </Link>
        </p>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {groups.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/utility/${g.slug}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="truncate">{g.utility}</span>
              <span className="text-xs text-[var(--muted)] tabular-nums shrink-0 ml-2">{g.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
