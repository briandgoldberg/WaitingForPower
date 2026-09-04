import type { Metadata } from "next";
import Link from "next/link";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { POLICIES } from "@/lib/data/policies";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { ZERO_CARBON_FUELS } from "@/lib/data/taxonomies";

export const metadata: Metadata = {
  title: "Advocacy — WaitingForPower",
  description:
    "Six bipartisan policies to speed up energy permitting decisions, one per bottleneck, inspired by Citizens' Climate Lobby's approach to durable, market-based climate policy.",
  alternates: { canonical: "/policies" },
};

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  // Same DEFAULT_FILTERS scope (status: "in_permitting") the /projects
  // explorer itself defaults to, so this count always matches exactly what
  // a visitor sees after clicking through — not a different, looser total.
  const projects = await queryProjects(toFilterState(DEFAULT_FILTERS));
  const causeCounts = new Map<string, number>();
  const causeMw = new Map<string, number>();
  const causeCleanMw = new Map<string, number>();
  for (const p of projects) {
    for (const c of p.causeSlugs) {
      causeCounts.set(c, (causeCounts.get(c) ?? 0) + 1);
      if (p.capacityUnit === "MW" && p.capacityValue != null) {
        causeMw.set(c, (causeMw.get(c) ?? 0) + p.capacityValue);
        if (ZERO_CARBON_FUELS.includes(p.fuelType)) {
          causeCleanMw.set(c, (causeCleanMw.get(c) ?? 0) + p.capacityValue);
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">What we&rsquo;re advocating for</h1>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">
          Six bipartisan policies to speed up permit decisions, one per bottleneck. No silver
          bullets, real trade-offs included.
        </p>
        <p className="text-xs text-[var(--muted)] mt-2 max-w-2xl">
          Inspired by{" "}
          <a href="https://citizensclimatelobby.org/" target="_blank" rel="noreferrer" className="underline">
            Citizens&rsquo; Climate Lobby
          </a>
          &rsquo;s approach to durable, market-based climate policy, these are some potential
          bipartisan policies to speed up permitting, in this site&rsquo;s own words.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {POLICIES.map((policy) => {
          const cause = CAUSE_CATEGORY_BY_SLUG[policy.slug];
          return (
            <a
              key={policy.slug}
              href={`#${policy.slug}`}
              className="px-2.5 py-1 rounded-full text-xs border border-[var(--border)] hover:opacity-80"
            >
              <span
                className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: cause.color }}
              />
              {policy.badgeLabel ?? cause.shortLabel}
            </a>
          );
        })}
      </nav>

      <div className="flex flex-col gap-5">
        {POLICIES.map((policy) => {
          const cause = CAUSE_CATEGORY_BY_SLUG[policy.slug];
          const count = causeCounts.get(policy.slug) ?? 0;
          const mw = causeMw.get(policy.slug) ?? 0;
          const cleanMw = causeCleanMw.get(policy.slug) ?? 0;

          return (
            <section
              key={policy.slug}
              id={policy.slug}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden scroll-mt-20"
            >
              <div className="h-1.5" style={{ backgroundColor: cause.color }} />
              <div className="p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span
                      className="inline-block text-xs font-medium uppercase tracking-wide rounded-full px-2.5 py-1 text-white mb-1.5"
                      style={{ backgroundColor: cause.color }}
                    >
                      {policy.badgeLabel ?? cause.shortLabel}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight">{policy.title}</h2>
                    <p className="text-sm text-[var(--muted)]">{policy.oneLiner}</p>
                  </div>
                  <div className="shrink-0 self-start flex flex-col items-end gap-1">
                    <Link
                      href={`/projects?cause=${policy.slug}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-accent/10 hover:bg-accent/15 transition-colors whitespace-nowrap"
                      style={{ color: "var(--accent)" }}
                    >
                      See the {count.toLocaleString("en-US")} project{count === 1 ? "" : "s"} blocked by this →
                    </Link>
                    {mw > 0 && (
                      <p className="text-[11px] text-[var(--muted)] text-right">
                        {Math.round(mw).toLocaleString("en-US")} MW blocked
                        {cleanMw > 0 && ` (${Math.round(cleanMw).toLocaleString("en-US")} MW clean energy)`}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-sm leading-relaxed">{policy.summary}</p>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-400 mb-1.5">
                      Strengths
                    </h3>
                    <ul className="text-sm flex flex-col gap-1.5">
                      {policy.strengths.map((s, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-green-600 dark:text-green-500 flex-shrink-0">+</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-500 mb-1.5">
                      Weaknesses
                    </h3>
                    <ul className="text-sm flex flex-col gap-1.5">
                      {policy.weaknesses.map((w, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-amber-600 dark:text-amber-500 flex-shrink-0">−</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="text-xs flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-[var(--border)]">
                  {policy.bills.map((bill) => (
                    <a
                      key={bill.url}
                      href={bill.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] underline font-medium"
                      title={bill.note}
                    >
                      {bill.label}
                    </a>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
