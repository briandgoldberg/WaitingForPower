import Link from "next/link";
import type { SpeakUpHearing } from "@/lib/homeHighlights";
import { AttendHearingBox } from "@/components/advocacy/AttendHearingBox";
import { talkingPointsFor } from "@/lib/data/talkingPoints";
import { FUEL_TYPE_BY_VALUE, formatCapacity } from "@/lib/data/taxonomies";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";
import { displayZone, isBareDate } from "@/lib/hearingTime";

function dateParts(iso: string, state: string | null) {
  const d = new Date(iso);
  const dateOnly = isBareDate(iso);
  const timeZone = displayZone(iso, state);
  return {
    month: d.toLocaleDateString("en-US", { month: "short", timeZone }),
    day: d.toLocaleDateString("en-US", { day: "numeric", timeZone }),
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone }),
    time: dateOnly ? null : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(":00", ""),
  };
}

export function SpeakUpHearings({ groups }: { groups: SpeakUpHearing[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--accent-2)]">Speak up</span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Show up at a public hearing</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
          Local boards hear mostly from opponents. A few supportive neighbors at the microphone can change the outcome.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {groups.map((g) => {
          const first = dateParts(g.hearings[0].date, g.state);
          const place = splitStateCodes(g.state).map((c) => STATE_NAMES[c] ?? c).join(", ");
          const fuel = FUEL_TYPE_BY_VALUE[g.fuelType as keyof typeof FUEL_TYPE_BY_VALUE]?.label ?? g.fuelType;
          return (
            <article key={g.slug} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-3 min-w-0">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-14 rounded-lg overflow-hidden border border-[var(--border)] text-center">
                  <div className="bg-[var(--accent-2)] text-white text-[11px] font-bold uppercase py-0.5">{first.month}</div>
                  <div className="text-2xl font-bold leading-tight py-0.5">{first.day}</div>
                  <div className="text-[10px] text-[var(--muted)] pb-1">{first.weekday}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--muted)]">
                    {place || "Location n/a"} · {fuel}
                    {g.capacityValue != null && <> · {formatCapacity(g.capacityValue, g.capacityUnit)}</>}
                    {first.time && <> · {first.time}</>}
                  </div>
                  <Link href={`/project/${g.slug}`} className="font-semibold text-sm leading-snug text-[var(--accent)] underline line-clamp-3">
                    {g.name}
                  </Link>
                </div>
              </div>

              <AttendHearingBox
                hearings={g.hearings}
                ctx={{
                  projectName: g.name,
                  projectUrl: `https://waitingforpower.com/project/${g.slug}`,
                  detailsUrl: g.hearingLink && /^https?:\/\//.test(g.hearingLink) ? g.hearingLink : null,
                }}
                slug={g.slug}
                state={g.state}
              />

              <details className="group text-xs">
                <summary className="cursor-pointer font-semibold text-[var(--accent)] select-none list-none flex items-center gap-1">
                  <span className="transition-transform group-open:rotate-90" aria-hidden>
                    ▸
                  </span>
                  What to say
                </summary>
                <ul className="mt-2 ml-4 list-disc flex flex-col gap-1.5 text-[var(--text-secondary)]">
                  {talkingPointsFor(g.fuelType).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[var(--muted)]">
                  Keep it to two minutes, say you live nearby if you do, and be specific about why the project matters to you.
                </p>
              </details>
            </article>
          );
        })}
      </div>
      <Link href="/policies?tab=hearings" className="text-sm font-medium text-[var(--accent)] underline w-fit">
        See every upcoming hearing →
      </Link>
    </section>
  );
}
