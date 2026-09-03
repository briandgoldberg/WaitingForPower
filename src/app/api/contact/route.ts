import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";

const CONTACT_EMAIL = "briandgoldberg@gmail.com";

const TOPIC_LABELS: Record<string, string> = {
  "data-access": "Data feeds, API access, or custom data",
  partnership: "Partnership, press, or media",
  data: "Add a project or data source",
  feedback: "Feedback or a technical issue",
  other: "Something else",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const topic = String(body.topic ?? "");
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const organization = String(body.organization ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!TOPIC_LABELS[topic]) {
    return NextResponse.json({ error: "Please choose a topic." }, { status: 400 });
  }
  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length > 5000) {
    return NextResponse.json({ error: "Please enter a message (up to 5,000 characters)." }, { status: 400 });
  }
  if (organization.length > 200) {
    return NextResponse.json({ error: "Organization name is too long." }, { status: 400 });
  }

  // Persisted before the email send attempt — previously this route sent
  // an email and kept no other record, so a submission was only as durable
  // as Brian's inbox. Persisting first means a submission is on record for
  // the daily digest even if the Resend send below fails.
  try {
    await prisma.contactSubmission.create({
      data: { topic, name, email, organization: organization || null, message },
    });
  } catch (err) {
    console.error("Failed to persist contact submission:", err);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send contact form email.");
    return NextResponse.json(
      { error: "Contact form isn't configured yet — try emailing directly instead." },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);
  const topicLabel = TOPIC_LABELS[topic];

  try {
    const { error } = await resend.emails.send({
      from: "WaitingForPower Contact Form <onboarding@resend.dev>",
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[WaitingForPower] ${topicLabel} — ${name}`,
      text: [
        `Topic: ${topicLabel}`,
        `Name: ${name}`,
        `Email: ${email}`,
        organization ? `Organization: ${organization}` : null,
        "",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <p><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${organization ? `<p><strong>Organization:</strong> ${escapeHtml(organization)}</p>` : ""}
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form send failed:", err);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
