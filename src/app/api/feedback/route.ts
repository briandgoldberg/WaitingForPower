import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendFeedbackNotificationEmail } from "@/lib/feedbackEmail";

export const dynamic = "force-dynamic";

// Fixed set matching IntentWidget.tsx's own INTENT_OPTIONS — validated here
// too so a malformed/scripted POST can't pollute the daily digest with
// junk values.
const VALID_INTENTS = new Set([
  "researcher_journalist",
  "developer_consultant",
  "investor",
  "policy_advocacy",
  "just_exploring",
]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const intent = String(body.intent ?? "");
  const path = String(body.path ?? "").slice(0, 500);

  if (!VALID_INTENTS.has(intent)) {
    return NextResponse.json({ error: "Invalid intent." }, { status: 400 });
  }

  const row = await prisma.visitorFeedback.create({ data: { intent, path } });

  // Fire-and-forget — a visitor answering a one-question widget shouldn't
  // wait on an email send, and a Resend failure shouldn't surface as an
  // error to them. See sendFeedbackNotificationEmail's own header for why
  // this is immediate rather than only rolled up in the daily digest.
  sendFeedbackNotificationEmail({ intent, path }).catch((err) =>
    console.error("Failed to send feedback notification email:", err),
  );

  // `id` lets the widget's optional second step (a message and/or contact
  // email — see src/app/api/feedback/[id]) attach to this same row instead
  // of creating a second one.
  return NextResponse.json({ ok: true, id: row.id });
}
