import { Resend } from "resend";

// Same verified sending domain as feedSubscriptionEmail.ts and the contact
// form (waitingforpower.com, confirmed verified 2026-09-02).
const FROM = "WaitingForPower Alerts <alerts@waitingforpower.com>";
const TO = "briandgoldberg@gmail.com";

const INTENT_LABELS: Record<string, string> = {
  researcher_journalist: "Researcher / journalist",
  developer_consultant: "Energy developer / consultant",
  investor: "Investor",
  policy_advocacy: "Policy / advocacy",
  just_exploring: "Just exploring",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Real-time, one email per response — separate from the once-daily digest
// (src/lib/dailyDigestEmail.ts), which also rolls these up in bulk. This is
// deliberately immediate, matching the contact form's existing behavior,
// since intent-widget answers are the closest thing this site has to
// unsolicited visitor signal and are rare enough that per-response email
// isn't spammy.
export async function sendFeedbackNotificationEmail(params: {
  intent: string;
  path: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send feedback notification email.");
    return { ok: false, error: "not_configured" };
  }
  const resend = new Resend(apiKey);
  const label = INTENT_LABELS[params.intent] ?? params.intent;
  const url = `https://waitingforpower.com${params.path}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `Visitor feedback: ${label}`,
    text: `A visitor answered the intent widget: "${label}"\nPage: ${url}`,
    html: `<p>A visitor answered the intent widget: <strong>${label}</strong></p><p>Page: <a href="${url}">${url}</a></p>`,
  });

  if (error) {
    console.error("Resend error (feedback notification):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// Distinct, higher-signal notification for the widget's optional second
// step (a message and/or an email if they want a reply) — separate from
// sendFeedbackNotificationEmail above so a visitor who adds real detail
// doesn't get buried in a subject line that just says "Investor" like
// every other response. Only ever called when at least one of the two
// optional fields is non-empty — see src/app/api/feedback/[id]/route.ts.
export async function sendFeedbackDetailEmail(params: {
  intent: string;
  path: string;
  feedbackText: string | null;
  contactEmail: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send feedback detail email.");
    return { ok: false, error: "not_configured" };
  }
  const resend = new Resend(apiKey);
  const label = INTENT_LABELS[params.intent] ?? params.intent;
  const url = `https://waitingforpower.com${params.path}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `Visitor left a message${params.contactEmail ? " (wants a reply)" : ""}`,
    text: [
      `A visitor (${label}) left detail on the intent widget.`,
      params.feedbackText ? `\nMessage: ${params.feedbackText}` : "",
      params.contactEmail ? `\nWants a reply at: ${params.contactEmail}` : "",
      `\nPage: ${url}`,
    ].join(""),
    html: `
      <p>A visitor (<strong>${label}</strong>) left detail on the intent widget.</p>
      ${params.feedbackText ? `<p><strong>Message:</strong> ${escapeHtml(params.feedbackText)}</p>` : ""}
      ${params.contactEmail ? `<p><strong>Wants a reply at:</strong> ${escapeHtml(params.contactEmail)}</p>` : ""}
      <p>Page: <a href="${url}">${url}</a></p>
    `,
  });

  if (error) {
    console.error("Resend error (feedback detail):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
