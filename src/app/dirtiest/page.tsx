import type { Metadata } from "next";
import Link from "next/link";
import { getDirtiestProjects } from "@/lib/dirtiestProjects";
import { formatCapacity, PROJECT_STAGE_BY_VALUE, type ProjectStage } from "@/lib/data/taxonomies";
import { splitStateCodes, stateName } from "@/lib/data/usStates";
import { HelpTooltip } from "@/components/HelpTooltip";

export const dynamic = "force-dynamic";

const TITLE = "Dirtiest Projects Pending Approval";
const DESCRIPTION =
  "The largest fossil-fuel projects currently awaiting a permitting decision, ranked by size — for advocates looking for the highest-impact place to focus opposition.";

export const metadata: Metadata = {
  title: `${TITLE} | WaitingForPower`,
  description: DESCRIPTION,
  alternates: { canonical: "/dirtiest" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://waitingforpower.com/dirtiest", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const CATEGORY_LABELS: Record<string, string> = {
  gas_generation: "Gas-fired power plants",
  pipeline: "Interstate gas pipelines",
};

export default async function DirtiestProjectsPage() {
  const entries = await getDirtiestProjects();
  const byCategory = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = byCategory.get(e.category) ?? [];
    arr.push(e);
    byCategory.set(e.category, arr);
  }
  for (const arr of byCategory.values()) {
    arr.sort((a, b) => (b.project.capacityValue ?? 0) - (a.project.capacityValue ?? 0));
  }

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-1.5">
          {TITLE}
          <HelpTooltip label={TITLE}>
            <p className="mb-2">
              <strong>Ranked by size, not a precise emissions estimate.</strong> This tracker doesn&rsquo;t have a
              CO₂/pollution figure for any project, so this list uses the closest honest proxy available: the
              largest gas-fired power plants (by MW) and interstate gas pipelines (by MMcf/d of capacity) that are
              past the earliest speculative filing stage and have a real, named permitting docket a member of the
              public could act on.
            </p>
            <p>
              Each project is individually checked by hand before it&rsquo;s added or removed — a project drops off
              once it&rsquo;s approved, cancelled, or no longer being reported.
            </p>
          </HelpTooltip>
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1 max-w-xl">{DESCRIPTION}</p>
        <Link href="/blog/dirtiest-projects-methodology" className="text-sm text-[var(--accent)] underline mt-1 inline-block">
          Read how we picked this list →
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--muted)]">
          Nothing currently qualifies. Check back soon.
        </div>
      ) : (
        Array.from(byCategory.entries()).map(([category, items]) => (
          <div key={category} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mt-2">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <ol className="flex flex-col gap-2">
              {items.map((e, i) => {
                const p = e.project;
                const stateLabel = splitStateCodes(p.state).map(stateName).join(", ");
                return (
                  <li key={p.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="w-6 shrink-0 text-center text-sm font-semibold text-[var(--muted)] mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <Link href={`/project/${p.slug}`} className="font-semibold text-sm hover:underline">
                            {p.name}
                          </Link>
                          <span className="shrink-0 text-sm font-bold text-[var(--accent)] tabular-nums">
                            {formatCapacity(p.capacityValue, p.capacityUnit)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {p.applicant ? `${p.applicant} · ` : ""}
                          {stateLabel || "Location not specified"} · {PROJECT_STAGE_BY_VALUE[p.currentStage as ProjectStage] ?? p.currentStage}
                        </p>
                        {e.blurb && <p className="text-sm mt-1.5 text-[var(--text-secondary)] leading-snug">{e.blurb}</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
    </div>
  );
}
