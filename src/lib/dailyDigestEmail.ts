import { Resend } from "resend";
import type { ApiTrafficSummary, ApiCaller } from "@/lib/apiTrafficSummary";

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
  // See src/lib/apiTrafficSummary.ts and classifyUserAgent.ts — "bot" is a
  // self-described MCP directory/registry crawler, "ambiguous" is a bare
  // generic HTTP client (curl/python/node/...) with no identifying string
  // either way, "real" is everything else (a real browser, a named company,
  // a specific AI-agent client). Only "real" is a genuine usage signal.
  api: ApiTrafficSummary;
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

  const api = data.api;
  const totalApiCalls = api.totalCalls;
  const muted = (t: string) => `<span style="color:#666;">${t}</span>`;
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const headline = `${plural(api.callersByClass.real, "real caller")} · ${api.callersByClass.ambiguous} unidentified · ${api.callersByClass.bot} crawlers`;
  const subline = `${api.newCallers} new today · ${totalApiCalls} calls (${api.callsByClass.real} real · ${api.callsByClass.ambiguous} unidentified · ${api.callsByClass.bot} crawler)`;
  const f = api.mcpFunnel;
  const funnel = `${f.connected} connected → ${f.initialized} initialized → ${f.listedTools} listed tools → ${f.calledTools} called a tool`;
  const callerDetail = (c: ApiCaller) =>
    [
      plural(c.calls, "call"),
      c.mcpStage && c.mcpStage !== "called tools" ? `stopped at: ${c.mcpStage}` : null,
      c.tools.length > 0 ? c.tools.map((t) => `${t.name}×${t.count}`).join(", ") : null,
      c.endpoints.filter((e) => e !== "mcp").join(", ") || null,
    ]
      .filter(Boolean)
      .join(" · ");
  const callerTag = (c: ApiCaller) => `${c.cls === "ambiguous" ? "[unidentified] " : ""}${c.isNew ? "[NEW] " : ""}`;

  const apiSectionHtml =
    totalApiCalls === 0
      ? "<p>No requests.</p>"
      : `<p style="font-size:22px;font-weight:700;color:#1B6B3C;margin:0;">${escapeHtml(headline)}</p>
         <p style="color:#666;font-size:12px;margin:2px 0 10px;">${escapeHtml(subline)}</p>
         <p style="font-size:13px;margin:0 0 4px;"><strong>MCP funnel</strong> ${muted("(non-crawler callers)")}: ${escapeHtml(funnel)}</p>
         <p style="font-size:13px;margin:0 0 10px;"><strong>Tools called:</strong> ${
           api.toolCalls.length === 0
             ? muted("none")
             : api.toolCalls.map((t) => `${escapeHtml(t.name)} ${muted(`${t.calls}× by ${plural(t.callers, "caller")}`)}`).join(" · ")
         }</p>
         ${
           api.callers.length > 0
             ? `<p style="font-size:13px;margin:0 0 2px;"><strong>Who called</strong> ${muted("(crawlers hidden)")}</p>
                <ul style="font-size:13px;margin:0 0 10px;padding-left:20px;">${api.callers
                  .map((c) => `<li><strong>${escapeHtml(callerTag(c))}${escapeHtml(c.label)}</strong> ${muted(escapeHtml(callerDetail(c)))}</li>`)
                  .join("")}</ul>`
             : ""
         }
         ${
           api.questions.length > 0
             ? `<p style="font-size:13px;margin:0 0 2px;"><strong>What they asked</strong></p>
                <ul style="font-size:12px;margin:0 0 10px;padding-left:20px;font-family:ui-monospace,Menlo,monospace;">${api.questions
                  .map(
                    (q) =>
                      `<li>${muted(escapeHtml(fmtTime(q.at)))} ${escapeHtml(q.caller)}: ${escapeHtml(q.what)}${q.count > 1 ? ` ${muted(`×${q.count}`)}` : ""}</li>`,
                  )
                  .join("")}</ul>`
             : ""
         }
         ${api.sources.length > 0 ? `<p style="font-size:13px;margin:0 0 6px;"><strong>?src= tags:</strong> ${escapeHtml(api.sources.map((x) => `${x.src} (${x.count})`).join(" · "))}</p>` : ""}
         <p style="color:#666;font-size:12px;margin:0;">${escapeHtml(data.apiCalls.map((c) => `${c.endpoint} (${c.count})`).join(" · "))}</p>`;

  const apiText =
    totalApiCalls === 0
      ? ["No requests."]
      : [
          headline,
          subline,
          `MCP funnel (non-crawler callers): ${funnel}`,
          `Tools called: ${api.toolCalls.length === 0 ? "none" : api.toolCalls.map((t) => `${t.name} ${t.calls}× by ${plural(t.callers, "caller")}`).join(" · ")}`,
          ...(api.callers.length > 0 ? ["", "Who called (crawlers hidden):", ...api.callers.map((c) => `- ${callerTag(c)}${c.label} — ${callerDetail(c)}`)] : []),
          ...(api.questions.length > 0
            ? ["", "What they asked:", ...api.questions.map((q) => `- ${fmtTime(q.at)} ${q.caller}: ${q.what}${q.count > 1 ? ` ×${q.count}` : ""}`)]
            : []),
          ...(api.sources.length > 0 ? ["", `?src= tags: ${api.sources.map((x) => `${x.src} (${x.count})`).join(" · ")}`] : []),
          "",
          data.apiCalls.map((c) => `${c.endpoint} (${c.count})`).join(" · "),
        ];

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
    ...apiText,
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
