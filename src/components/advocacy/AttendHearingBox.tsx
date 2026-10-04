"use client";

import { useState } from "react";
import {
  buildHearingsIcs,
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarHearing,
  type HearingInviteContext,
} from "@/lib/calendarInvite";
import { trackAttributedAction } from "@/lib/attribution";
import { formatHearingDate } from "@/lib/hearingTime";

type CalendarChoice = "google" | "outlook" | "office365" | "ics";

const CHOICES: { id: CalendarChoice; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "outlook", label: "Outlook.com" },
  { id: "office365", label: "Microsoft 365" },
  { id: "ics", label: "Apple / other" },
];

// The visitor's calendar, remembered on this device so later clicks skip the
// menu. Storage can be missing or throw (private windows), so both are
// wrapped and the menu simply shows every time.
const STORAGE_KEY = "wfp_calendar";

function readChoice(): CalendarChoice | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return CHOICES.some((c) => c.id === v) ? (v as CalendarChoice) : null;
  } catch {
    return null;
  }
}

function saveChoice(c: CalendarChoice | null): void {
  try {
    if (c) window.localStorage.setItem(STORAGE_KEY, c);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered; the menu shows next time.
  }
}


// "Attend and speak" on an advocacy project card: lists the public hearings,
// and clicking it adds them to the visitor's calendar of choice. Google and
// Outlook links carry one event each, so with several hearings the menu offers
// one link per date; the .ics file holds them all.
// `compact` renders just an "Add to calendar" button (and its menu), for cards
// that show the hearing details themselves.
export function AttendHearingBox({
  hearings,
  ctx,
  slug,
  state,
  compact = false,
}: {
  hearings: CalendarHearing[];
  ctx: HearingInviteContext;
  slug: string;
  state: string | null;
  compact?: boolean;
}) {
  const fmtShort = (iso: string) => formatHearingDate(iso, state);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<CalendarChoice | null>(null);
  // After a one-click add with the remembered calendar, says where it went
  // and offers the menu to switch.
  const [justAdded, setJustAdded] = useState(false);

  const add = (choice: CalendarChoice, h?: CalendarHearing) => {
    if (choice === "ics") {
      downloadIcs(buildHearingsIcs({ ...ctx, hearings, uidPrefix: slug }), `hearing-${slug}.ics`.slice(0, 120));
    } else {
      const target = h ?? hearings[0];
      const url = choice === "google" ? googleCalendarUrl(target, ctx) : outlookCalendarUrl(target, ctx, choice);
      if (url) window.open(url, "_blank", "noopener");
    }
    trackAttributedAction("Hearing added to calendar");
  };

  const choose = (choice: CalendarChoice, h?: CalendarHearing) => {
    saveChoice(choice);
    setSaved(choice);
    add(choice, h);
    // With several hearings a web calendar needs one click per date, so the
    // menu stays open for the rest.
    if (choice === "ics" || hearings.length === 1) setOpen(false);
  };

  const onBoxClick = () => {
    const remembered = readChoice();
    setSaved(remembered);
    if (remembered && (remembered === "ics" || hearings.length === 1)) {
      add(remembered);
      setJustAdded(true);
    } else {
      setJustAdded(false);
      setOpen((o) => !o);
    }
  };

  const linkClass = "rounded-full border border-emerald-400/70 dark:border-emerald-600/70 px-2.5 py-1 font-medium text-emerald-900 dark:text-emerald-300 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/40";

  const trigger = compact ? (
    <button
      type="button"
      onClick={onBoxClick}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
    >
      <span aria-hidden>📅</span> Add to calendar
    </button>
  ) : (
    <button
      type="button"
      onClick={onBoxClick}
      aria-expanded={open}
      title="Add to your calendar"
      className="w-full text-left rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/35 px-3 py-2.5 flex gap-2.5 cursor-pointer transition-colors"
    >
      <span aria-hidden className="w-4 shrink-0 text-center">
        📅
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-emerald-800 dark:text-emerald-400">
          Attend and speak
          <span className="ml-2 font-medium underline">Add to calendar</span>
        </div>
        {hearings.map((h, i) => (
          <div key={i} className="text-[var(--muted)]">
            {fmtShort(h.date)} · {h.label ?? "Public hearing"}
            {h.location ? " · " + h.location : ""}
          </div>
        ))}
      </div>
    </button>
  );
  // Menu rows line up under the text in the full box, flush in compact mode.
  const indent = compact ? "px-0 pt-2" : "px-3 pl-9";

  return (
    <div className={compact ? "text-xs" : "rounded-lg border-l-4 border-emerald-400 dark:border-emerald-600 bg-emerald-100/70 dark:bg-emerald-900/20 text-xs"}>
      {trigger}

      {justAdded && !open && saved && (
        <div className={`${indent} pb-2.5 flex flex-wrap gap-x-2 text-[var(--muted)]`}>
          <span>{saved === "ics" ? "Calendar file downloaded." : `Opened in ${CHOICES.find((c) => c.id === saved)?.label}.`}</span>
          <button
            type="button"
            onClick={() => {
              setJustAdded(false);
              setOpen(true);
            }}
            className="underline"
          >
            Use a different calendar
          </button>
        </div>
      )}

      {open && (
        <div className={`${indent} pb-3 flex flex-col gap-2`}>
          <span className="font-medium">Add to which calendar?</span>
          {hearings.length === 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {CHOICES.map((c) => (
                <button key={c.id} type="button" onClick={() => choose(c.id)} className={linkClass}>
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              {hearings.map((h, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[var(--muted)]">{fmtShort(h.date)}</span>
                  {CHOICES.filter((c) => c.id !== "ics").map((c) => (
                    <button key={c.id} type="button" onClick={() => choose(c.id, h)} className={linkClass}>
                      {c.label}
                    </button>
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-14 shrink-0 text-[var(--muted)]">All dates</span>
                <button type="button" onClick={() => choose("ics")} className={linkClass}>
                  Apple / other
                </button>
              </div>
            </>
          )}
          {saved && (
            <button
              type="button"
              onClick={() => {
                saveChoice(null);
                setSaved(null);
              }}
              className="w-fit text-[var(--muted)] underline"
            >
              Forget my calendar ({CHOICES.find((c) => c.id === saved)?.label})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
