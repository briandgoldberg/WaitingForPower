import { Resend } from "resend";

// Same verified sending domain as every other transactional email on this
// site (waitingforpower.com, confirmed verified 2026-09-02).
const FROM = "WaitingForPower Alerts <alerts@waitingforpower.com>";
const TO = "briandgoldberg@gmail.com";

// Real-time, one email per failed run — cron failures are rare and
// high-signal (see LBNL Queued Up's own months-long silent failure this
// email exists to catch next time), unlike the once-daily digest
// (src/lib/dailyDigestEmail.ts), which rolls up routine, expected activity.
export async function sendCronFailureEmail(params: {
  cronName: string;
  error: unknown;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send cron failure email.");
    return { ok: false, error: "not_configured" };
  }
  const resend = new Resend(apiKey);
  const message = params.error instanceof Error ? params.error.message : String(params.error);

  const { error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `Cron failed: ${params.cronName}`,
    text: `${params.cronName} failed:\n\n${message}`,
    html: `<p><strong>${params.cronName}</strong> failed:</p><pre style="white-space:pre-wrap;">${message.replace(/</g, "&lt;")}</pre>`,
  });

  if (error) {
    console.error("Resend error (cron failure email):", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
