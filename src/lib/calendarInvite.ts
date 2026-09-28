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

export function buildHearingsIcs(opts: { projectName: string; projectUrl: string; detailsUrl: string | null; hearings: CalendarHearing[]; uidPrefix: string }): string {
  const now = utcStamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WaitingForPower//Hearings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const h of opts.hearings) {
    const start = new Date(h.date);
    if (Number.isNaN(start.getTime())) continue;
    const label = h.label ?? "Public hearing";
    const description = [
      `${label} on ${opts.projectName}. The public can attend and speak.`,
      opts.detailsUrl ? `Hearing details: ${opts.detailsUrl}` : null,
      `Project: ${opts.projectUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push("BEGIN:VEVENT", `UID:${opts.uidPrefix}-${start.getTime()}@waitingforpower.com`, `DTSTAMP:${now}`);
    if (isDateOnly(start)) {
      const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`, `DTEND;VALUE=DATE:${dateStamp(next)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + DEFAULT_DURATION_MS))}`);
    }
    lines.push(`SUMMARY:${esc(`${label}: ${opts.projectName}`)}`, `DESCRIPTION:${esc(description)}`, `URL:${opts.detailsUrl ?? opts.projectUrl}`);
    if (h.location) lines.push(`LOCATION:${esc(h.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
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
