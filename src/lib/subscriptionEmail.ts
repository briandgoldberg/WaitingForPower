import { Resend } from "resend";

// waitingforpower.com is verified as a Resend sending domain (confirmed
// 2026-09-02), so subscriber notifications go out from it directly rather
// than the onboarding@resend.dev sandbox address the contact form still
// uses (src/app/api/contact/route.ts) — that address can only deliver to
// the account's own verified email, which would silently break delivery to
// real subscribers.
const FROM = "WaitingForPower Alerts <alerts@waitingforpower.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send subscription email.");
    return null;
  }
  return new Resend(apiKey);
}

export async function sendConfirmEmail(params: {
  to: string;
  projectName: string;
  projectSlug: string;
  confirmToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "not_configured" };

  const confirmUrl = `https://waitingforpower.com/api/subscribe/confirm?token=${params.confirmToken}`;
  const projectUrl = `https://waitingforpower.com/project/${params.projectSlug}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Confirm: alerts for ${params.projectName}`,
    text: [
      `You asked to be emailed when there's an update on "${params.projectName}" (${projectUrl}).`,
      "",
      `Confirm this subscription: ${confirmUrl}`,
      "",
      "If you didn't request this, you can ignore this email — nothing happens until you click the link above.",
    ].join("\n"),
    html: `
      <p>You asked to be emailed when there's an update on <strong>${escapeHtml(params.projectName)}</strong>.</p>
      <p><a href="${confirmUrl}">Confirm this subscription</a></p>
      <p style="color:#666;font-size:13px;">If you didn't request this, you can ignore this email — nothing happens until you click the link above.</p>
    `,
  });

  if (error) {
    console.error("Resend error (confirm email):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function sendDigestEmail(params: {
  to: string;
  projectName: string;
  projectSlug: string;
  summaries: string[];
  unsubscribeToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "not_configured" };

  const projectUrl = `https://waitingforpower.com/project/${params.projectSlug}`;
  const unsubscribeUrl = `https://waitingforpower.com/api/subscribe/unsubscribe?token=${params.unsubscribeToken}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Update: ${params.projectName}`,
    text: [
      `${params.projectName} has an update:`,
      "",
      ...params.summaries.map((s) => `- ${s}`),
      "",
      `Full details: ${projectUrl}`,
      "",
      `Unsubscribe from alerts for this project: ${unsubscribeUrl}`,
    ].join("\n"),
    html: `
      <p><strong>${escapeHtml(params.projectName)}</strong> has an update:</p>
      <ul>${params.summaries.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
      <p><a href="${projectUrl}">Full details</a></p>
      <p style="color:#666;font-size:13px;"><a href="${unsubscribeUrl}">Unsubscribe from alerts for this project</a></p>
    `,
  });

  if (error) {
    console.error("Resend error (digest email):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
