import Link from "next/link";
import { getDirtiestProjects } from "@/lib/dirtiestProjects";
import { formatCapacity } from "@/lib/data/taxonomies";
import { splitStateCodes, stateName } from "@/lib/data/usStates";

const CATEGORY_LABELS: Record<string, string> = {
  gas_generation: "Gas-fired power plants",
  pipeline: "Interstate gas pipelines",
};

export async function DirtiestProjects() {
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
    <div className="flex flex-col gap-5">
      <div className="text-sm leading-relaxed">
        <p>
          No permitting docket publishes an emissions number, so &ldquo;dirtiest&rdquo; here means the largest
          fossil-fuel infrastructure still awaiting approval &mdash; gas plants by megawatts, pipelines by MMcf/d,
          each individually verified, not just size-sorted. Click through for the docket, hearing dates, and how to
          advocate.
        </p>
      </div>

      {Array.from(byCategory.entries()).map(([category, items]) => (
        <div key={category} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mt-1">
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
                        {stateLabel || "Location not specified"}
                      </p>
                      {e.blurb && <p className="text-sm mt-1.5 text-[var(--text-secondary)] leading-snug">{e.blurb}</p>}
                      <Link
                        href={`/project/${p.slug}#comments`}
                        className="inline-flex items-center gap-1 mt-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
                      >
                        Advocate on this project →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
