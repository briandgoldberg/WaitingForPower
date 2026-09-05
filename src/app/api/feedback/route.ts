import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendFeedbackEmail } from "@/lib/feedbackEmail";

export const dynamic = "force-dynamic";

// Only ever called by FeedbackWidget.tsx when the visitor actually typed
// something — closing the widget without entering anything never calls
// this at all, so every row here has real content.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const feedbackText = String(body.feedbackText ?? "").trim().slice(0, 2000);
  const contactEmail = String(body.contactEmail ?? "").trim().slice(0, 320);
  const path = String(body.path ?? "").slice(0, 500);

  if (!feedbackText && !contactEmail) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const row = await prisma.visitorFeedback.create({
    data: {
      path,
      feedbackText: feedbackText || null,
      contactEmail: contactEmail || null,
    },
  });

  // Fire-and-forget — a visitor shouldn't wait on an email send, and a
  // Resend failure shouldn't surface as an error to them.
  sendFeedbackEmail({ feedbackText: row.feedbackText, contactEmail: row.contactEmail, path }).catch((err) =>
    console.error("Failed to send feedback email:", err),
  );

  return NextResponse.json({ ok: true, id: row.id });
}
