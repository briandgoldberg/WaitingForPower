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
  // See src/lib/classifyUserAgent.ts — "bot" is a self-described MCP
  // directory/registry crawler, "ambiguous" is a bare generic HTTP client
  // (curl/node/python-httpx/...) with no identifying string either way,
  // "real" is everything else (a real browser, a named company, a
  // specific AI-agent client). Only "real" is a genuine usage signal.
  apiTrafficBreakdown: { bot: number; ambiguous: number; real: number };
  apiRealUserAgents: { userAgent: string; count: number }[];
  feedbackTotal: number;
  feedbackDetails: { feedbackText: string | null; contactEmail: string | null; path: string }[];
  // Everything real people and guests actually did: project "I Advocated"
  // entries and site-wide "I Reached Out!" official-contact entries.
  newPosts: {
    kind: "project" | "contact";
    label: string;
    isAgent: boolean;
    // An anonymous person (no confirmed email); agents are never guests.
    guest: boolean;
    // Not public yet: the poster hasn't chosen how to appear.
    held: boolean;
    // null for a "contact" entry — it isn't tied to one project.
    projectName: string | null;
    url: string;
    // Precomputed human-readable description, e.g. "submitted a comment in
    // support of approval" or "contacted their U.S. Senator for Oregon".
    actionText: string;
    body: string | null;
  }[];
  newLikeCount: number;
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
  const { bot: botCalls, ambiguous: ambiguousCalls, real: realCalls } = data.apiTrafficBreakdown;

  const apiSectionHtml =
    totalApiCalls === 0
      ? "<p>No requests.</p>"
      : `<p style="font-size:22px;font-weight:700;color:#1B6B3C;margin:0;">${realCalls} real</p>
         <p style="color:#666;font-size:12px;margin:2px 0 8px;">${totalApiCalls} total · ${ambiguousCalls} ambiguous · ${botCalls} crawler</p>
         <p style="font-size:13px;margin:0 0 6px;">${data.apiCalls.map((c) => `${escapeHtml(c.endpoint)} (${c.count})`).join(" · ")}</p>
         ${
           data.apiRealUserAgents.length > 0
             ? `<p style="color:#1B6B3C;font-size:13px;margin:0;"><strong>Real clients:</strong> ${data.apiRealUserAgents.map((u) => `${escapeHtml(u.userAgent)} (${u.count})`).join(", ")}</p>`
             : ""
         }`;

  const feedbackSectionHtml =
    data.feedbackTotal === 0
      ? "<p>No responses.</p>"
      : `<p><strong>${data.feedbackTotal}</strong> total.</p>
         <ul>${data.feedbackDetails
           .map(
             (d) =>
               `<li>${d.contactEmail ? `${escapeHtml(d.contactEmail)}` : "(no email)"} <span style="color:#666;font-size:12px;">— ${escapeHtml(d.path)}</span>${d.feedbackText ? `<br>${escapeHtml(d.feedbackText)}` : ""}</li>`,
           )
           .join("")}</ul>`;

  const postWho = (p: DailyDigestData["newPosts"][number]) =>
    `${p.isAgent ? "🤖" : "🙂"} ${p.label}${p.guest ? " (guest)" : ""}${p.held ? " [held, not public yet]" : ""}`;
  const postTarget = (p: DailyDigestData["newPosts"][number]) =>
    p.projectName ? ` on <a href="${escapeHtml(p.url)}"><strong>${escapeHtml(p.projectName)}</strong></a>` : "";

  const postsExtraLines = [data.newLikeCount > 0 ? `${data.newLikeCount} new like${data.newLikeCount === 1 ? "" : "s"}` : null].filter(
    (x): x is string => x != null,
  );

  const postsSectionHtml =
    data.newPosts.length === 0 && postsExtraLines.length === 0
      ? "<p>None.</p>"
      : `${
          data.newPosts.length > 0
            ? `<ul>${data.newPosts
                .map(
                  (p) =>
                    `<li>${escapeHtml(postWho(p))} ${escapeHtml(p.actionText)}${postTarget(p)}${p.body ? `<br><span style="color:#444;font-size:13px;">${escapeHtml(p.body)}</span>` : ""}</li>`,
                )
                .join("")}</ul>`
            : ""
        }${postsExtraLines.length > 0 ? `<p style="color:#666;font-size:13px;">${escapeHtml(postsExtraLines.join(" · "))}</p>` : ""}`;

  const html = `
    <p style="color:#666;font-size:13px;">WaitingForPower daily digest — ${escapeHtml(data.windowLabel)}</p>
    ${section("API traffic", apiSectionHtml)}
    ${section("Visitor feedback", feedbackSectionHtml)}
    ${section(`Advocacy activity (${data.newPosts.length})`, postsSectionHtml)}
  `;

  const text = [
    `WaitingForPower daily digest — ${data.windowLabel}`,
    "",
    "API TRAFFIC",
    totalApiCalls === 0 ? "No requests." : `${realCalls} real (${totalApiCalls} total · ${ambiguousCalls} ambiguous · ${botCalls} crawler)`,
    data.apiCalls.map((c) => `${c.endpoint} (${c.count})`).join(" · "),
    data.apiRealUserAgents.length > 0
      ? `Real clients: ${data.apiRealUserAgents.map((u) => `${u.userAgent} (${u.count})`).join(", ")}`
      : "",
    "",
    "VISITOR FEEDBACK",
    data.feedbackTotal === 0 ? "No responses." : `${data.feedbackTotal} total.`,
    ...data.feedbackDetails.map(
      (d) => `- ${d.contactEmail ?? "(no email)"} — ${d.path}${d.feedbackText ? `\n  ${d.feedbackText}` : ""}`,
    ),
    "",
    `ADVOCACY ACTIVITY (${data.newPosts.length})`,
    data.newPosts.length === 0 && postsExtraLines.length === 0
      ? "None."
      : [
          ...data.newPosts.map(
            (p) => `- ${postWho(p)} ${p.actionText}${p.projectName ? ` on ${p.projectName}` : ""}\n  ${p.url}${p.body ? `\n  ${p.body}` : ""}`,
          ),
          ...postsExtraLines.map((l) => `- ${l}`),
        ].join("\n"),
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
