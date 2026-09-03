import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendFeedbackDetailEmail } from "@/lib/feedbackEmail";

export const dynamic = "force-dynamic";

// Attaches the widget's optional second step (a free-text message and/or an
// email address if the visitor wants a reply) to the VisitorFeedback row
// already created by POST /api/feedback. Both fields stay optional — this
// route is only ever called if the visitor actually typed something before
// hitting "Send" (see IntentWidget.tsx); closing the widget at that step
// never calls this at all.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const feedbackText = String(body.feedbackText ?? "").trim().slice(0, 2000);
  const contactEmail = String(body.contactEmail ?? "").trim().slice(0, 320);

  if (!feedbackText && !contactEmail) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const existing = await prisma.visitorFeedback.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.visitorFeedback.update({
    where: { id },
    data: {
      feedbackText: feedbackText || null,
      contactEmail: contactEmail || null,
    },
  });

  sendFeedbackDetailEmail({
    intent: existing.intent,
    path: existing.path,
    feedbackText: feedbackText || null,
    contactEmail: contactEmail || null,
  }).catch((err) => console.error("Failed to send feedback detail email:", err));

  return NextResponse.json({ ok: true });
}
