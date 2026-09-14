import { Resend } from "resend";

// Same verified sending domain as every other transactional email on this
// site (waitingforpower.com, confirmed verified 2026-09-02).
const FROM = "WaitingForPower Predictions <alerts@waitingforpower.com>";

export async function sendPredictorVerificationEmail(params: {
  to: string;
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send predictor verification email.");
    return { ok: false, error: "not_configured" };
  }
  const resend = new Resend(apiKey);

  const confirmUrl = `https://waitingforpower.com/api/predictions/verify?token=${params.token}`;

  const html = `
    <p>Confirm your email to save your prediction history to a permanent profile — no password, just this link.</p>
    <p><a href="${confirmUrl}">Save my profile</a></p>
    <p style="color:#666;font-size:13px;">If you didn't request this, you can ignore this email.</p>
  `;
  const text = `Confirm your email to save your prediction history to a permanent profile — no password, just this link.\n\n${confirmUrl}\n\nIf you didn't request this, you can ignore this email.`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Save your WaitingForPower prediction profile",
    text,
    html,
  });

  if (error) {
    console.error("Resend error (predictor verification):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
