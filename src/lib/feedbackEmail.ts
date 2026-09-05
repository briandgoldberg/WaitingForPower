import { Resend } from "resend";

// Same verified sending domain as feedSubscriptionEmail.ts and the contact
// form (waitingforpower.com, confirmed verified 2026-09-02).
const FROM = "WaitingForPower Alerts <alerts@waitingforpower.com>";
const TO = "briandgoldberg@gmail.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Real-time, one email per submission — separate from the once-daily
// digest (src/lib/dailyDigestEmail.ts), which also rolls these up in bulk.
// Only ever called with at least one of feedbackText/contactEmail set —
// see src/app/api/feedback/route.ts.
export async function sendFeedbackEmail(params: {
  feedbackText: string | null;
  contactEmail: string | null;
  path: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send feedback email.");
    return { ok: false, error: "not_configured" };
  }
  const resend = new Resend(apiKey);
  const url = `https://waitingforpower.com${params.path}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `Visitor feedback${params.contactEmail ? " (wants a reply)" : ""}`,
    text: [
      "A visitor left feedback on WaitingForPower.",
      params.feedbackText ? `\nMessage: ${params.feedbackText}` : "",
      params.contactEmail ? `\nWants a reply at: ${params.contactEmail}` : "",
      `\nPage: ${url}`,
    ].join(""),
    html: `
      <p>A visitor left feedback on WaitingForPower.</p>
      ${params.feedbackText ? `<p><strong>Message:</strong> ${escapeHtml(params.feedbackText)}</p>` : ""}
      ${params.contactEmail ? `<p><strong>Wants a reply at:</strong> ${escapeHtml(params.contactEmail)}</p>` : ""}
      <p>Page: <a href="${url}">${url}</a></p>
    `,
  });

  if (error) {
    console.error("Resend error (feedback):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
