// Builds an .ics calendar file (RFC 5545) for public hearings, so "Attend and
// speak" can drop them straight into the visitor's calendar. Browser-only
// download helper at the bottom.

export interface CalendarHearing {
  date: string; // ISO date-time
  label: string | null;
  location: string | null;
}

// Hearings stored as a bare date (no time published) come through as exactly
// midnight UTC; those become all-day events instead of a made-up 7 p.m. slot.
const isDateOnly = (d: Date) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;

const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const dateStamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

// Text values escape backslash, semicolon, comma and newlines.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 octets are folded (CRLF + space). Folding by UTF-16
// code units at 70 keeps well under the limit for mostly-ASCII text.
function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 70) parts.push(line.slice(i, i + 70));
  return parts.join("\r\n ");
}

// Timed hearings get a two-hour block; the notices don't publish end times.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface HearingInviteContext {
  projectName: string;
  projectUrl: string;
  detailsUrl: string | null;
}

interface EventDetails {
  title: string;
  description: string;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
}

// The one place an event's wording and times are decided, shared by the .ics
// file and the Google/Outlook links. Null for an unparseable date.
function eventDetails(h: CalendarHearing, ctx: HearingInviteContext): EventDetails | null {
  const start = new Date(h.date);
  if (Number.isNaN(start.getTime())) return null;
  const label = h.label ?? "Public hearing";
  const allDay = isDateOnly(start);
  return {
    title: `${label}: ${ctx.projectName}`,
    description: [
      `${label} on ${ctx.projectName}. The public can attend and speak.`,
      ctx.detailsUrl ? `Hearing details: ${ctx.detailsUrl}` : null,
      `Project: ${ctx.projectUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: h.location,
    start,
    end: new Date(start.getTime() + (allDay ? DAY_MS : DEFAULT_DURATION_MS)),
    allDay,
  };
}

export function buildHearingsIcs(opts: HearingInviteContext & { hearings: CalendarHearing[]; uidPrefix: string }): string {
  const now = utcStamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WaitingForPower//Hearings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const h of opts.hearings) {
    const e = eventDetails(h, opts);
    if (!e) continue;
    lines.push("BEGIN:VEVENT", `UID:${opts.uidPrefix}-${e.start.getTime()}@waitingforpower.com`, `DTSTAMP:${now}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.start)}`, `DTEND;VALUE=DATE:${dateStamp(e.end)}`);
    else lines.push(`DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`);
    lines.push(`SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.description)}`, `URL:${opts.detailsUrl ?? opts.projectUrl}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// Google Calendar's "new event" page, prefilled (one event per link).
export function googleCalendarUrl(h: CalendarHearing, ctx: HearingInviteContext): string | null {
  const e = eventDetails(h, ctx);
  if (!e) return null;
  const dates = e.allDay ? `${dateStamp(e.start)}/${dateStamp(e.end)}` : `${utcStamp(e.start)}/${utcStamp(e.end)}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details: e.description });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

// Outlook's "new event" page, prefilled: outlook.live.com for personal
// accounts, outlook.office.com for Microsoft 365 (work/school).
export function outlookCalendarUrl(h: CalendarHearing, ctx: HearingInviteContext, kind: "outlook" | "office365"): string | null {
  const e = eventDetails(h, ctx);
  if (!e) return null;
  const host = kind === "outlook" ? "outlook.live.com" : "outlook.office.com";
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    body: e.description,
    startdt: e.allDay ? e.start.toISOString().slice(0, 10) : e.start.toISOString(),
    enddt: e.allDay ? e.end.toISOString().slice(0, 10) : e.end.toISOString(),
    allday: String(e.allDay),
  });
  if (e.location) q.set("location", e.location);
  return `https://${host}/calendar/0/deeplink/compose?${q}`;
}

// Hands the file to the browser. On iOS/macOS Safari this opens the "Add to
// Calendar" sheet; elsewhere it downloads a file the calendar app opens.
export function downloadIcs(ics: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
