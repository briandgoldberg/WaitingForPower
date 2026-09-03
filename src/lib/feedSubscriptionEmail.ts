import { Resend } from "resend";
import { stateName } from "@/lib/data/usStates";

// Same verified sending domain as every other transactional email on this
// site (waitingforpower.com, confirmed verified 2026-09-02).
const FROM = "WaitingForPower Feed <alerts@waitingforpower.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scopeLabel(state: string | null): string {
  return state ? stateName(state) : "every state";
}

// UTC calendar day, not the recipient's local day — same reasoning as
// ChangesFeed's dateGroupLabel (src/components/ChangesFeed.tsx): a fixed,
// unambiguous boundary rather than one that depends on who's reading and
// when. Unlike that component's Today/Yesterday labels (relative to the
// viewer's "now"), this always shows a real calendar date — an email is
// read at an unknown later time, so "Yesterday" would be wrong by the time
// it's opened.
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

interface FeedSummary {
  projectName: string;
  projectSlug: string;
  summary: string;
  createdAt: string;
}

// Groups already-chronological summaries (oldest first, per
// notify-feed-subscribers' `orderBy: { createdAt: "asc" }` query) into
// consecutive same-day buckets, preserving that order.
function groupByDay(summaries: FeedSummary[]): { label: string; items: FeedSummary[] }[] {
  const groups: { label: string; items: FeedSummary[] }[] = [];
  for (const s of summaries) {
    const label = dayLabel(s.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }
  return groups;
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send feed subscription email.");
    return null;
  }
  return new Resend(apiKey);
}

export async function sendFeedConfirmEmail(params: {
  to: string;
  state: string | null;
  confirmToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "not_configured" };

  const scope = scopeLabel(params.state);
  const confirmUrl = `https://waitingforpower.com/api/feed-subscribe/confirm?token=${params.confirmToken}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Confirm: weekly updates for ${scope}`,
    text: [
      `You asked for a weekly email of energy permitting changes in ${scope}.`,
      "",
      `Confirm this subscription: ${confirmUrl}`,
      "",
      "If you didn't request this, you can ignore this email — nothing happens until you click the link above.",
    ].join("\n"),
    html: `
      <p>You asked for a weekly email of energy permitting changes in <strong>${escapeHtml(scope)}</strong>.</p>
      <p><a href="${confirmUrl}">Confirm this subscription</a></p>
      <p style="color:#666;font-size:13px;">If you didn't request this, you can ignore this email — nothing happens until you click the link above.</p>
    `,
  });

  if (error) {
    console.error("Resend error (feed confirm email):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function sendFeedWeeklyEmail(params: {
  to: string;
  state: string | null;
  summaries: FeedSummary[];
  unsubscribeToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "not_configured" };

  const scope = scopeLabel(params.state);
  const feedUrl = params.state ? `https://waitingforpower.com/?state=${params.state}` : "https://waitingforpower.com/";
  const unsubscribeUrl = `https://waitingforpower.com/api/feed-subscribe/unsubscribe?token=${params.unsubscribeToken}`;
  const hasUpdates = params.summaries.length > 0;
  const days = groupByDay(params.summaries);

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: hasUpdates ? `${params.summaries.length} update${params.summaries.length === 1 ? "" : "s"} in ${scope}` : `No updates in ${scope} this week`,
    text: [
      hasUpdates ? `${params.summaries.length} update(s) in ${scope}:` : `No new permitting changes in ${scope} this week.`,
      "",
      ...days.flatMap((day) => [
        day.label,
        ...day.items.map((s) => `- ${s.projectName}: ${s.summary} (https://waitingforpower.com/project/${s.projectSlug})`),
        "",
      ]),
      `Full feed: ${feedUrl}`,
      "",
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join("\n"),
    html: `
      <p>${hasUpdates ? `<strong>${params.summaries.length}</strong> update${params.summaries.length === 1 ? "" : "s"} in <strong>${escapeHtml(scope)}</strong>:` : `No new permitting changes in <strong>${escapeHtml(scope)}</strong> this week.`}</p>
      ${days
        .map(
          (day) => `
        <h3 style="font-size:14px;margin:16px 0 4px;">${escapeHtml(day.label)}</h3>
        <ul style="margin:0;">${day.items
          .map(
            (s) =>
              `<li><a href="https://waitingforpower.com/project/${s.projectSlug}">${escapeHtml(s.projectName)}</a> — ${escapeHtml(s.summary)}</li>`,
          )
          .join("")}</ul>`,
        )
        .join("")}
      <p><a href="${feedUrl}">Full feed</a></p>
      <p style="color:#666;font-size:13px;"><a href="${unsubscribeUrl}">Unsubscribe</a></p>
    `,
  });

  if (error) {
    console.error("Resend error (feed weekly email):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
