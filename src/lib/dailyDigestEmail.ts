import { Resend } from "resend";

// Same verified sending domain as feedSubscriptionEmail.ts (see that file's
// header — waitingforpower.com, confirmed verified 2026-09-02).
const FROM = "WaitingForPower Digest <digest@waitingforpower.com>";
const TO = "briandgoldberg@gmail.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface DailyDigestData {
  windowLabel: string;
  apiCalls: { endpoint: string; count: number }[];
  apiUserAgents: string[];
  feedbackTotal: number;
  feedbackDetails: { feedbackText: string | null; contactEmail: string | null; path: string }[];
  contactSubmissions: { topic: string; name: string; email: string; organization: string | null; message: string }[];
  // scope is already the human label ("California" or "All states") — see
  // src/app/api/cron/daily-digest/route.ts.
  newSubscriptions: { scope: string; email: string; confirmed: boolean }[];
  // Support/Against votes cast on the community verdict widget (see
  // GreenlightVote.tsx / ProjectVerdict in schema.prisma) in this window.
  votes: { projectName: string; projectSlug: string; vote: "green" | "red" }[];
}

function section(title: string, bodyHtml: string): string {
  return `<div style="margin-bottom:24px;"><h2 style="font-size:15px;margin:0 0 8px;">${escapeHtml(title)}</h2>${bodyHtml}</div>`;
}

export async function sendDailyDigestEmail(data: DailyDigestData): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send daily digest email.");
    return { ok: false, error: "not_configured" };
  }
  const resend = new Resend(apiKey);

  const totalApiCalls = data.apiCalls.reduce((s, c) => s + c.count, 0);

  const apiSectionHtml =
    totalApiCalls === 0
      ? "<p>No requests.</p>"
      : `<p><strong>${totalApiCalls}</strong> total.</p>
         <ul>${data.apiCalls.map((c) => `<li>${escapeHtml(c.endpoint)}: ${c.count}</li>`).join("")}</ul>
         ${data.apiUserAgents.length > 0 ? `<p style="color:#666;font-size:13px;">User-agents seen: ${data.apiUserAgents.map(escapeHtml).join(", ")}</p>` : ""}`;

  const feedbackSectionHtml =
    data.feedbackTotal === 0
      ? "<p>No responses.</p>"
      : `<p><strong>${data.feedbackTotal}</strong> total.</p>
         <ul>${data.feedbackDetails
           .map(
             (d) =>
               `<li>${d.contactEmail ? `${escapeHtml(d.contactEmail)}` : "(no email)"}${d.feedbackText ? `<br>${escapeHtml(d.feedbackText)}` : ""}</li>`,
           )
           .join("")}</ul>`;

  const contactSectionHtml =
    data.contactSubmissions.length === 0
      ? "<p>None.</p>"
      : `<ul>${data.contactSubmissions
          .map(
            (c) =>
              `<li><strong>${escapeHtml(c.topic)}</strong> — ${escapeHtml(c.name)} (${escapeHtml(c.email)})${c.organization ? ` — ${escapeHtml(c.organization)}` : ""}<br>${escapeHtml(c.message)}</li>`,
          )
          .join("")}</ul>`;

  const subsSectionHtml =
    data.newSubscriptions.length === 0
      ? "<p>None.</p>"
      : `<ul>${data.newSubscriptions
          .map((s) => `<li>${escapeHtml(s.email)} — ${escapeHtml(s.scope)}${s.confirmed ? "" : " (unconfirmed)"}</li>`)
          .join("")}</ul>`;

  const greenVoteCount = data.votes.filter((v) => v.vote === "green").length;
  const redVoteCount = data.votes.length - greenVoteCount;
  const votesSectionHtml =
    data.votes.length === 0
      ? "<p>None.</p>"
      : `<p><strong>${data.votes.length}</strong> total (${greenVoteCount} support, ${redVoteCount} against).</p>
         <ul>${data.votes
           .map(
             (v) =>
               `<li><a href="https://waitingforpower.com/project/${escapeHtml(v.projectSlug)}">${escapeHtml(v.projectName)}</a> — ${v.vote === "green" ? "Support" : "Against"}</li>`,
           )
           .join("")}</ul>`;

  const html = `
    <p style="color:#666;font-size:13px;">WaitingForPower daily digest — ${escapeHtml(data.windowLabel)}</p>
    ${section("Bot / MCP / API calls", apiSectionHtml)}
    ${section("Visitor feedback", feedbackSectionHtml)}
    ${section("Contact form submissions", contactSectionHtml)}
    ${section("New feed subscriptions", subsSectionHtml)}
    ${section("Community votes", votesSectionHtml)}
  `;

  const text = [
    `WaitingForPower daily digest — ${data.windowLabel}`,
    "",
    "BOT / MCP / API CALLS",
    totalApiCalls === 0 ? "No requests." : `${totalApiCalls} total.`,
    ...data.apiCalls.map((c) => `- ${c.endpoint}: ${c.count}`),
    data.apiUserAgents.length > 0 ? `User-agents seen: ${data.apiUserAgents.join(", ")}` : "",
    "",
    "VISITOR FEEDBACK",
    data.feedbackTotal === 0 ? "No responses." : `${data.feedbackTotal} total.`,
    ...data.feedbackDetails.map(
      (d) => `- ${d.contactEmail ?? "(no email)"}${d.feedbackText ? `\n  ${d.feedbackText}` : ""}`,
    ),
    "",
    "CONTACT FORM SUBMISSIONS",
    data.contactSubmissions.length === 0
      ? "None."
      : data.contactSubmissions
          .map((c) => `- ${c.topic} — ${c.name} (${c.email})${c.organization ? ` — ${c.organization}` : ""}\n  ${c.message}`)
          .join("\n"),
    "",
    "NEW FEED SUBSCRIPTIONS",
    data.newSubscriptions.length === 0
      ? "None."
      : data.newSubscriptions.map((s) => `- ${s.email} — ${s.scope}${s.confirmed ? "" : " (unconfirmed)"}`).join("\n"),
    "",
    "COMMUNITY VOTES",
    data.votes.length === 0
      ? "None."
      : `${data.votes.length} total (${greenVoteCount} support, ${redVoteCount} against).`,
    ...data.votes.map(
      (v) => `- ${v.projectName} (https://waitingforpower.com/project/${v.projectSlug}) — ${v.vote === "green" ? "Support" : "Against"}`,
    ),
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `WaitingForPower daily digest — ${data.windowLabel}`,
    text,
    html,
  });

  if (error) {
    console.error("Resend error (daily digest):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
