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

  // Crawlers (search-engine/directory bots just strolling the internet)
  // are real volume but zero product signal — kept out of the bold
  // headline and the detail lists below, mentioned once, mutedly, in the
  // subline only.
  const headline = `${plural(api.callersByClass.real, "real caller")} · ${api.callersByClass.ambiguous} unidentified`;
  const subline = `${api.newCallers} new today · ${totalApiCalls} calls (${api.callsByClass.real} real · ${api.callsByClass.ambiguous} unidentified, ${api.callsByClass.bot} crawler not shown below)`;
  const f = api.mcpFunnel;
  const funnel = `${f.connected} connected → ${f.initialized} initialized → ${f.listedTools} listed tools → ${f.calledTools} called a tool`;
  // The one line meant to answer "is anyone actually building something on
  // this": a returning caller (seen before today) who got all the way to
  // calling a tool is a real usage pattern, not a one-off page hit or a
  // handshake that never went anywhere.
  const deepReturning = api.callers.filter((c) => c.isNew === false && c.mcpStage === "called tools");
  const signalLine =
    deepReturning.length > 0
      ? `${plural(deepReturning.length, "returning caller")} called tools today, not just new visitors handshaking — the strongest sign someone's actually building on this: ${deepReturning.map((c) => c.label).join(", ")}.`
      : api.mcpFunnel.calledTools > 0
        ? `${plural(api.mcpFunnel.calledTools, "caller")} called a tool today, but none of them were returning callers yet — too early to call it product-market fit.`
        : `Nobody called a tool today — every real/unidentified caller stopped at connect or initialize.`;
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
         <p style="font-size:14px;font-weight:600;margin:0 0 10px;padding:8px 10px;background:#f3f7f3;border-left:3px solid #1B6B3C;">${escapeHtml(signalLine)}</p>
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
          `SIGNAL: ${signalLine}`,
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

  const html = `
    <p style="color:#666;font-size:13px;">WaitingForPower daily digest — ${escapeHtml(data.windowLabel)}</p>
    ${section("API traffic", apiSectionHtml)}
    ${section("Visitor feedback", feedbackSectionHtml)}
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
