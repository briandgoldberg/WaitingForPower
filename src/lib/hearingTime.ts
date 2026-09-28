// Hearing and deadline dates are stored as UTC instants. Shown in UTC, an
// evening hearing on the West Coast (6 p.m. PDT = 01:00 UTC) lands on the
// next day, so dates are formatted in the project's own state's time zone.
// A value stored as exactly midnight UTC has no published time (a bare
// date), so it stays in UTC to keep its calendar day.
import { splitStateCodes } from "@/lib/data/usStates";

const ZONES: Record<string, string> = {
  CA: "America/Los_Angeles", WA: "America/Los_Angeles", OR: "America/Los_Angeles", NV: "America/Los_Angeles",
  AZ: "America/Phoenix",
  CO: "America/Denver", UT: "America/Denver", NM: "America/Denver", MT: "America/Denver", WY: "America/Denver", ID: "America/Boise",
  TX: "America/Chicago", IL: "America/Chicago", MN: "America/Chicago", WI: "America/Chicago", IA: "America/Chicago", MO: "America/Chicago",
  OK: "America/Chicago", KS: "America/Chicago", NE: "America/Chicago", SD: "America/Chicago", ND: "America/Chicago", LA: "America/Chicago",
  AR: "America/Chicago", AL: "America/Chicago", MS: "America/Chicago", TN: "America/Chicago",
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
};

// First state of a (possibly multi-state) project; Eastern by default.
export function timeZoneForState(state: string | null | undefined): string {
  const code = splitStateCodes(state ?? null)[0];
  return (code && ZONES[code]) || "America/New_York";
}

export function isBareDate(iso: string): boolean {
  const d = new Date(iso);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

// The zone to format a stored hearing/deadline instant in.
export function displayZone(iso: string, state: string | null | undefined): string {
  return isBareDate(iso) ? "UTC" : timeZoneForState(state);
}

export function formatHearingDate(iso: string, state: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: displayZone(iso, state) });
}
