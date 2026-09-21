import Link from "next/link";
import type { UpcomingHearingGroup, DecisionWatchEntry } from "@/lib/hearings";
import { formatCapacity } from "@/lib/data/taxonomies";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

function DecisionList({ title, help, items }: { title: string; help: string; items: DecisionWatchEntry[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title} ({items.length})</h3>
        <p className="text-xs text-[var(--muted)]">{help}</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((d) => (
          <li key={d.slug} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 flex items-baseline justify-between gap-3 flex-wrap">
            <Link href={`/project/${d.slug}`} className="text-sm font-medium hover:underline">
              {d.name}
            </Link>
            <span className="text-xs text-[var(--muted)]">
              {[d.state, d.capacityValue != null ? formatCapacity(d.capacityValue, d.capacityUnit) : null, d.reviewStepAt ? `since ${fmt(d.reviewStepAt)}` : null].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PublicHearingsSection({ groups, decisions = [] }: { groups: UpcomingHearingGroup[]; decisions?: DecisionWatchEntry[] }) {
  const awaiting = decisions.filter((d) => d.reviewStep === "Awaiting commission order");
  const scheduled = decisions.filter((d) => d.reviewStep === "Hearing scheduled");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)] max-w-2xl">
        Speak up at a real public hearing on a project. Upcoming dates are listed below.
      </p>
      <a href="/hearings.rss" className="text-sm text-[var(--accent)] underline">
        RSS feed
      </a>

      <DecisionList title="Decision pending" help="The hearing is over and the commission has not ruled. Now is the time to weigh in." items={awaiting} />
      <DecisionList title="Hearing set" help="A hearing is scheduled. The date is on the docket." items={scheduled} />

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No upcoming public hearings found right now. Check back soon.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li
              key={g.project.slug}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <Link href={`/project/${g.project.slug}`} className="font-semibold hover:underline">
                  {g.project.name}
                </Link>
                {g.project.state && (
                  <span className="shrink-0 text-xs uppercase tracking-wide text-[var(--muted)]">
                    {g.project.state}
                  </span>
                )}
              </div>

              <ul className="flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
                {g.hearings.map((h, i) => (
                  <li key={i}>
                    <div>
                      {new Date(h.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                      {h.endDate &&
                        ` – ${new Date(h.endDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}`}
                      {h.label && <span className="text-[var(--muted)]"> · {h.label}</span>}
                    </div>
                    {h.location && (
                      <div className="text-xs text-[var(--muted)] mt-0.5">Where: {h.location}</div>
                    )}
                  </li>
                ))}
              </ul>

              {g.project.hearingDetailsLink && /^https?:\/\//.test(g.project.hearingDetailsLink) && (
                <a
                  href={g.project.hearingDetailsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[var(--accent)] underline"
                >
                  Hearing Details
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
