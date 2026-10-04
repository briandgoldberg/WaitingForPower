import Link from "next/link";
import type { SpeakUpHearing } from "@/lib/homeHighlights";
import { AttendHearingBox } from "@/components/advocacy/AttendHearingBox";
import { talkingPointsFor, talkingPointsAgainst } from "@/lib/data/talkingPoints";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { displayZone, isBareDate } from "@/lib/hearingTime";

function dateParts(iso: string, state: string | null) {
  const d = new Date(iso);
  const timeZone = displayZone(iso, state);
  return {
    month: d.toLocaleDateString("en-US", { month: "short", timeZone }),
    day: d.toLocaleDateString("en-US", { day: "numeric", timeZone }),
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone }),
    time: isBareDate(iso) ? null : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(":00", ""),
  };
}

// Local-hearing project names end with the deciding body in parentheses
// ("Seaflower BESS (Menifee Planning Commission)"); split it off to show on
// its own line.
function splitName(name: string): { project: string; body: string | null } {
  const m = /^(.*\S)\s*\(([^()]+)\)$/.exec(name);
  return m ? { project: m[1], body: m[2] } : { project: name, body: null };
}

// Home page: upcoming local battery-storage hearings (see getStorageHearings).
export function SpeakUpHearings({ groups }: { groups: SpeakUpHearing[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-10 pb-12 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--accent-2)]">Clean energy needs storage</span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">A few supporters can make the difference</h2>
        <p className="text-sm sm:text-base font-semibold text-[var(--accent-2)] max-w-2xl">
          Solar and wind need batteries to provide power 24 hours a day. Local boards mostly hear from opponents, so
          a handful of neighbors speaking up can change permitting outcomes.
        </p>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          <span className="font-semibold">Advocate for battery storage</span> at one of the meetings below or{" "}
          <Link href="/policies?tab=hearings" className="font-semibold text-[var(--accent)] underline">
            browse all upcoming public hearing →
          </Link>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => {
          const h = g.hearings[0];
          const when = dateParts(h.date, g.state);
          const { project, body } = splitName(g.name);
          const state = splitStateCodes(g.state).map((c) => STATE_NAMES[c] ?? c).join(", ");
          const venue = h.location;
          return (
            <article key={g.slug} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 flex flex-col gap-4 min-w-0 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 rounded-xl overflow-hidden border border-[var(--border)] text-center">
                  <div className="bg-[var(--accent-2)] text-white text-xs font-bold uppercase py-1">{when.month}</div>
                  <div className="text-3xl font-bold leading-tight pt-0.5">{when.day}</div>
                  <div className="text-[11px] text-[var(--muted)] pb-1">{when.weekday}</div>
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {state}
                    {when.time && <> · {when.time}</>}
                  </div>
                  <Link href={`/project/${g.slug}`} className="font-bold leading-snug hover:underline">
                    {project}
                  </Link>
                  {body && <div className="text-sm text-[var(--text-secondary)]">{body}</div>}
                  {venue && (
                    <div className="text-sm text-[var(--text-secondary)] flex gap-1">
                      <span aria-hidden>📍</span>
                      <span>{venue}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <AttendHearingBox
                  compact
                  hearings={g.hearings.map((x) => ({ ...x, label: x.label?.replace(/\s*\(date per [^)]*\)/i, "") ?? null }))}
                  ctx={{
                    projectName: project,
                    projectUrl: `https://waitingforpower.com/project/${g.slug}`,
                    detailsUrl: g.hearingLink && /^https?:\/\//.test(g.hearingLink) ? g.hearingLink : null,
                  }}
                  slug={g.slug}
                  state={g.state}
                />
                <details className="group text-sm">
                  <summary className="cursor-pointer font-semibold text-[var(--accent)] select-none list-none flex items-center gap-1">
                    <span className="transition-transform group-open:rotate-90" aria-hidden>
                      ▸
                    </span>
                    What to say
                  </summary>
                  <div className="mt-2 flex flex-col gap-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">If you support it</span>
                      <ul className="mt-1 ml-4 list-disc flex flex-col gap-1.5 text-[var(--text-secondary)]">
                        {talkingPointsFor(g.fuelType).map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">Common concerns raised against it</span>
                      <ul className="mt-1 ml-4 list-disc flex flex-col gap-1.5 text-[var(--text-secondary)]">
                        {talkingPointsAgainst(g.fuelType).map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">Two minutes is plenty. Say you live nearby if you do.</p>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
