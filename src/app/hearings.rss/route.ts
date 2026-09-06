import { getUpcomingPublicHearingGroups } from "@/lib/hearings";

// RSS 2.0 feed of every real upcoming public hearing across all tracked
// projects — the same data as the Advocacy page's "Public Hearings" tab
// (see src/lib/hearings.ts), just syndicated for feed readers, Zapier's
// "New Item in Feed" trigger, IFTTT's RSS applet, etc. rather than requiring
// anyone to scrape the HTML page. Refreshed on every request from the same
// live data — no separate cache/cron needed, this is cheap to compute.
export const dynamic = "force-dynamic";

const BASE_URL = "https://waitingforpower.com";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateRange(date: string, endDate: string | null): string {
  const start = new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (!endDate) return start;
  const end = new Date(endDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${start} – ${end}`;
}

export async function GET() {
  const groups = await getUpcomingPublicHearingGroups();

  // One <item> per hearing (not per project) — an RSS reader/automation
  // wants "here's a specific thing happening on a specific date," not a
  // project-level rollup, and a project with several hearings should show
  // up more than once rather than only ever surfacing its earliest one.
  const items = groups.flatMap((g) =>
    g.hearings.map((h) => {
      const link = `${BASE_URL}/project/${g.project.slug}`;
      const titleParts = [g.project.name];
      if (g.project.state) titleParts.push(`(${g.project.state})`);
      const title = `${titleParts.join(" ")} — ${formatDateRange(h.date, h.endDate)}${h.label ? ` · ${h.label}` : ""}`;
      const descriptionParts = [];
      if (h.location) descriptionParts.push(`Where: ${h.location}`);
      if (g.project.hearingDetailsLink && /^https?:\/\//.test(g.project.hearingDetailsLink)) {
        descriptionParts.push(`Hearing details: ${g.project.hearingDetailsLink}`);
      }

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(`${g.project.slug}-${h.date}`)}</guid>
      <pubDate>${new Date(h.date).toUTCString()}</pubDate>
      <description>${escapeXml(descriptionParts.join(" — ") || "See project page for details.")}</description>
    </item>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>WaitingForPower — Upcoming Public Hearings</title>
    <link>${BASE_URL}/policies?tab=hearings</link>
    <description>Real upcoming public hearings across U.S. energy permitting projects — dates, locations, and links, refreshed continuously.</description>
    <language>en-us</language>
    <ttl>60</ttl>${items.join("")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
