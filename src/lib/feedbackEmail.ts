import { Resend } from "resend";

// Same verified sending domain as subscriptionEmail.ts and the contact
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
