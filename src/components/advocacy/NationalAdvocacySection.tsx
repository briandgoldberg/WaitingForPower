import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { POLICIES } from "@/lib/data/policies";
import { LetterBuilder } from "./LetterBuilder";

export function NationalAdvocacySection() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-[var(--muted)] max-w-2xl">
          Six bipartisan policies to speed up permit decisions, one per bottleneck. Inspired by{" "}
          <a href="https://citizensclimatelobby.org/" target="_blank" rel="noreferrer" className="underline">
            Citizens&rsquo; Climate Lobby
          </a>
          .
        </p>
      </div>

      <LetterBuilder />

      <div className="flex flex-col gap-5">
        {POLICIES.map((policy) => {
          const cause = CAUSE_CATEGORY_BY_SLUG[policy.slug];

          return (
            <section
              key={policy.slug}
              id={policy.slug}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden scroll-mt-20"
            >
              <div className="h-1.5" style={{ backgroundColor: cause.color }} />
              <div className="p-4 sm:p-5 flex flex-col gap-3">
                <div>
                  <span
                    className="inline-block text-xs font-medium uppercase tracking-wide rounded-full px-2.5 py-1 text-white mb-1.5"
                    style={{ backgroundColor: cause.color }}
                  >
                    {policy.badgeLabel ?? cause.shortLabel}
                  </span>
                  <h3 className="text-xl font-bold tracking-tight">{policy.title}</h3>
                  <p className="text-sm text-[var(--muted)]">{policy.oneLiner}</p>
                </div>

                <p className="text-sm leading-relaxed">{policy.summary}</p>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-400 mb-1.5">
                      Strengths
                    </h4>
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
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-500 mb-1.5">
                      Weaknesses
                    </h4>
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
