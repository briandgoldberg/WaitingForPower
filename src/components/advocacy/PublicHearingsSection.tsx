"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdvocacyProject } from "@/lib/advocacyProjects";
import { isPublicHearing } from "@/lib/advocacyActions";
import { displayZone } from "@/lib/hearingTime";
import { googleCalendarUrl } from "@/lib/calendarInvite";

interface Entry {
  date: string; // ISO
  label: string | null;
  location: string | null;
  projectName: string;
  projectSlug: string;
  state: string | null;
  hearingLink: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Calendar-day key in the hearing's own displayed time zone, so a late-night
// Pacific hearing lands on the same day a visitor there would expect —
// matching formatHearingDate's own zone choice elsewhere on this page.
function dayKey(iso: string, state: string | null): string {
  const zone = displayZone(iso, state);
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { timeZone: zone }); // YYYY-MM-DD
}

// A hearing stored as exactly midnight UTC has no published time (a bare
// date) — see isBareDate in hearingTime.ts.
function fmtTime(iso: string, state: string | null): string | null {
  const d = new Date(iso);
  const hasTime = !(d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0);
  return hasTime ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: displayZone(iso, state) }).replace(":00", "") : null;
}

export function PublicHearingsSection({ projects }: { projects: AdvocacyProject[] }) {
  const entries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const p of projects) {
      for (const h of p.hearings) {
        if (!isPublicHearing(h)) continue;
        out.push({ date: h.date, label: h.label, location: h.location, projectName: p.name, projectSlug: p.slug, state: p.state, hearingLink: p.hearingLink });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [projects]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = dayKey(e.date, e.state);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const todayKey = today.toLocaleDateString("en-CA");
  const firstDayWithHearing = entries[0] ? dayKey(entries[0].date, entries[0].state) : todayKey;
  const [selectedDay, setSelectedDay] = useState(firstDayWithHearing);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { key: string; dayNum: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    const dayNum = daysInPrevMonth - startOffset + i + 1;
    const m = viewMonth === 0 ? 12 : viewMonth;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ key: `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`, dayNum, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, dayNum: d, inMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    const [y, m, d] = last.key.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    cells.push({ key: next.toLocaleDateString("en-CA"), dayNum: next.getDate(), inMonth: false });
    if (cells.length >= 42) break;
  }

  function goMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const selected = byDay.get(selectedDay) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-3xl font-bold tracking-tight max-w-2xl">Attend a public hearing and speak.</h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
        Every upcoming hearing on a project in permitting where the public can attend and speak — not an evidentiary
        or parties-only session.
      </p>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            className="h-8 w-8 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
          >
            ‹
          </button>
          <span className="font-semibold text-sm">{monthLabel}</span>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            className="h-8 w-8 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c) => {
            const hearingsThatDay = byDay.get(c.key) ?? [];
            const isSelected = c.key === selectedDay;
            const isToday = c.key === todayKey;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedDay(c.key)}
                className={`relative aspect-square rounded-md text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  !c.inMonth ? "text-[var(--muted)]/50" : "text-[var(--foreground)]"
                } ${isSelected ? "bg-[var(--accent)] text-white" : hearingsThatDay.length > 0 ? "bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
              >
                <span className={isToday && !isSelected ? "font-bold underline" : undefined}>{c.dayNum}</span>
                {hearingsThatDay.length > 0 && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[var(--accent)]"}`}
                    aria-label={`${hearingsThatDay.length} hearing${hearingsThatDay.length === 1 ? "" : "s"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold">
          {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h3>
        {selected.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No public hearings on this day. Pick a highlighted day above.</p>
        ) : (
          selected.map((e, i) => {
            const time = fmtTime(e.date, e.state);
            const gcalUrl = googleCalendarUrl(
              { date: e.date, label: e.label, location: e.location },
              { projectName: e.projectName, projectUrl: `https://waitingforpower.com/project/${e.projectSlug}`, detailsUrl: e.hearingLink && /^https?:\/\//.test(e.hearingLink) ? e.hearingLink : null },
            );
            return (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3.5 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/project/${e.projectSlug}`} className="font-semibold text-sm text-[var(--accent)] underline">
                    {e.projectName}
                  </Link>
                  {time && <span className="shrink-0 text-xs text-[var(--muted)]">{time}</span>}
                </div>
                {e.label && <p className="text-xs text-[var(--muted)]">{e.label}</p>}
                {e.location && <p className="text-xs text-[var(--text-secondary)]">📍 {e.location}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                  {gcalUrl && (
                    <a href={gcalUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
                      Add to calendar
                    </a>
                  )}
                  {e.hearingLink && /^https?:\/\//.test(e.hearingLink) && (
                    <a href={e.hearingLink} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">
                      Hearing details
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <a href="/hearings.rss" className="text-xs text-[var(--muted)] underline w-fit">
        Hearings RSS feed
      </a>
    </div>
  );
}
