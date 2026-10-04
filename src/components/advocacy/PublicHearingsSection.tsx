"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { isPublicHearing } from "@/lib/advocacyActions";
import { displayZone, isBareDate } from "@/lib/hearingTime";
import { splitStateCodes, STATE_NAMES } from "@/lib/data/usStates";
import { talkingPointsFor } from "@/lib/data/talkingPoints";
import { AttendHearingBox } from "@/components/advocacy/AttendHearingBox";

interface Entry {
  date: string; // ISO
  label: string | null;
  location: string | null;
  virtual: boolean;
  projectName: string;
  projectSlug: string;
  fuelType: string;
  state: string | null;
  hearingLink: string | null;
}

const PAGE_SIZE = 20;

// A location is "virtual" if the source's own text says so — covers the
// real phrasings seen in practice ("Virtual", "via videoconference",
// "Enforcement Action Public Hearing via Zoom Conferencing", "Microsoft
// Teams; ...", "Hybrid: In-Person and Remote"). No per-hearing join URL is
// published anywhere in this dataset, so there's nothing to deep-link to —
// the best honest next step is the hearing's own details page (relabeled
// "Join virtual hearing" below) or, failing that, the location text itself,
// which often doubles as the join instructions.
const VIRTUAL_RE = /virtual|zoom|teams|webex|videoconf|telephon(ic)?|\bremote\b|\bonline\b|internet broadcast|call-in|dial-in/i;

function isVirtualLocation(location: string | null): boolean {
  return !!location && VIRTUAL_RE.test(location);
}

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

type LocationFilter = "all" | "virtual" | "in-person";

export function PublicHearingsSection({ projects }: { projects: AdvocacyProject[] }) {
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [state, setState] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const allEntries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const p of projects) {
      for (const h of p.hearings) {
        if (!isPublicHearing(h)) continue;
        out.push({
          date: h.date,
          label: h.label,
          location: h.location,
          virtual: isVirtualLocation(h.location),
          projectName: p.name,
          projectSlug: p.slug,
          fuelType: p.fuelType,
          state: p.state,
          hearingLink: p.hearingLink,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [projects]);

  const locationFiltered = useMemo(
    () => (locationFilter === "all" ? allEntries : allEntries.filter((e) => (locationFilter === "virtual" ? e.virtual : !e.virtual))),
    [allEntries, locationFilter],
  );

  const stateOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const e of locationFiltered) for (const c of splitStateCodes(e.state)) if (STATE_NAMES[c]) codes.add(c);
    return [...codes].sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));
  }, [locationFiltered]);

  const entries = useMemo(
    () => (state ? locationFiltered.filter((e) => splitStateCodes(e.state).includes(state)) : locationFiltered),
    [locationFiltered, state],
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-3xl font-bold tracking-tight max-w-2xl">Attend a public hearing and speak.</h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
        Every upcoming hearing where the public can attend and speak, soonest first.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1 bg-[var(--panel)] w-fit">
          {(["all", "in-person", "virtual"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setLocationFilter(f);
                setState("");
                setVisible(PAGE_SIZE);
              }}
              className={`px-3 py-1 text-sm rounded-md capitalize ${locationFilter === f ? "bg-[var(--accent)] text-white" : ""}`}
            >
              {f === "all" ? "All" : f === "in-person" ? "In person" : "Virtual"}
            </button>
          ))}
        </div>
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          aria-label="Filter by state"
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="">All states</option>
          {stateOptions.map((c) => (
            <option key={c} value={c}>
              {STATE_NAMES[c]}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--muted)]">{entries.length} hearings</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No upcoming hearings match that.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entries.slice(0, visible).map((e, i) => {
            const when = dateParts(e.date, e.state);
            const stateLabel = splitStateCodes(e.state).map((c) => STATE_NAMES[c] ?? c).join(", ");
            const hasHearingLink = e.hearingLink && /^https?:\/\//.test(e.hearingLink);
            return (
              <article key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 flex flex-col gap-4 min-w-0 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-16 rounded-xl overflow-hidden border border-[var(--border)] text-center">
                    <div className="bg-[var(--accent-2)] text-white text-xs font-bold uppercase py-1">{when.month}</div>
                    <div className="text-3xl font-bold leading-tight pt-0.5">{when.day}</div>
                    <div className="text-[11px] text-[var(--muted)] pb-1">{when.weekday}</div>
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {stateLabel || "Location not specified"}
                      {when.time && <> · {when.time}</>}
                    </div>
                    <Link href={`/project/${e.projectSlug}`} className="font-bold leading-snug hover:underline">
                      {e.projectName}
                    </Link>
                    {e.label && <div className="text-sm text-[var(--text-secondary)]">{e.label}</div>}
                    {e.location && (
                      <div className="text-sm text-[var(--text-secondary)] flex gap-1">
                        <span aria-hidden>{e.virtual ? "📹" : "📍"}</span>
                        <span>{e.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <AttendHearingBox
                      compact
                      hearings={[{ date: e.date, label: e.label, location: e.location }]}
                      ctx={{
                        projectName: e.projectName,
                        projectUrl: `https://waitingforpower.com/project/${e.projectSlug}`,
                        detailsUrl: hasHearingLink ? e.hearingLink : null,
                      }}
                      slug={e.projectSlug}
                      state={e.state}
                    />
                    {hasHearingLink && (
                      <a href={e.hearingLink!} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--accent)] underline">
                        {e.virtual ? "Join virtual hearing →" : "Hearing details"}
                      </a>
                    )}
                  </div>
                  <details className="group text-sm">
                    <summary className="cursor-pointer font-semibold text-[var(--accent)] select-none list-none flex items-center gap-1">
                      <span className="transition-transform group-open:rotate-90" aria-hidden>
                        ▸
                      </span>
                      What to say
                    </summary>
                    <ul className="mt-2 ml-4 list-disc flex flex-col gap-1.5 text-[var(--text-secondary)]">
                      {talkingPointsFor(e.fuelType).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-[var(--muted)]">Two minutes is plenty. Say you live nearby if you do.</p>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {entries.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="text-sm font-medium px-3 py-2 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 w-fit"
        >
          Show more
        </button>
      )}

      <a href="/hearings.rss" className="text-xs text-[var(--muted)] underline w-fit">
        Hearings RSS feed
      </a>
    </div>
  );
}
