import Link from "next/link";
import { GreenlightVote } from "@/components/GreenlightVote";
import type { UpcomingHearingGroup } from "@/lib/hearings";

export function PublicHearingsSection({ groups }: { groups: UpcomingHearingGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      <a href="/hearings.rss" className="text-sm text-[var(--accent)] underline">
        RSS feed
      </a>

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

              <GreenlightVote
                slug={g.project.slug}
                initialGreen={g.project.greenVotes}
                initialRed={g.project.redVotes}
                compact
              />

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
