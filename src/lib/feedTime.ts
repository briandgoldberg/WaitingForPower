// Time formatting and day-grouping shared by the home feeds (ChangesFeed and
// CommunityFeed). See the comments below for why `now` is always passed in.

// `now` is passed in rather than read via `Date.now()` here — see the
// `now` prop on ChangesFeed below for why: this function runs once during
// SSR and again during client hydration, and if each call computed its own
// "current" time independently, the two passes would almost always render
// different text (or, worse, group items under different Today/Yesterday
// headers — a structural mismatch, not just a text one), which is exactly
// what triggers React's hydration-mismatch error. Threading one shared
// timestamp through both passes keeps the first render byte-identical.
export function relativeTime(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 14) return `${Math.round(days)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Same day-bucketing most social/notification feeds use (GitHub, Slack,
// etc.): Today / Yesterday / This Week / This Month, then by calendar
// month for anything older. Deliberately bucketed by UTC calendar day, not
// the viewer's own local day, even though "local" was the original intent
// (see git history) — confirmed live 2026-08-28 that local-day bucketing
// is a second, independent source of the same hydration-mismatch error the
// shared `now` prop above was meant to fix: threading one timestamp
// through both passes guarantees server and client agree on *which
// instant* "now" is, but getFullYear()/getMonth()/getDate() are LOCAL-
// timezone getters, so the exact same instant still resolves to a
// different calendar day (and therefore a different set of Today/
// Yesterday groups — a structural DOM mismatch, not just stale text) on a
// server that always runs UTC versus a browser in any other timezone. Only
// invisible in local dev because the dev server and the browser checking
// it happen to share one machine's timezone. Bucketing by UTC day on both
// sides trades a few hours of edge-of-day fuzziness for a guarantee that
// never depends on where either side happens to be running.
export function dateGroupLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = startOfDay(now);
  const changeDay = startOfDay(date);
  const dayDiff = Math.round((today - changeDay) / (1000 * 60 * 60 * 24));

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff <= 7) return "This Week";
  if (date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth()) return "This Month";
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return date.toLocaleDateString("en-US", { month: "long", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

export function groupByDate<T extends { createdAt: string }>(changes: T[], now: Date): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const c of changes) {
    const label = dateGroupLabel(c.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(c);
    } else {
      groups.push({ label, items: [c] });
    }
  }
  return groups;
}
