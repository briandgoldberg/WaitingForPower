import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSubscriptionToken } from "@/lib/subscriptionTokens";
import { sendConfirmEmail } from "@/lib/subscriptionEmail";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!projectId) {
    return NextResponse.json({ error: "Missing project." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, slug: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const existing = await prisma.projectSubscription.findUnique({
    where: { projectId_email: { projectId: project.id, email } },
  });

  if (existing?.confirmed) {
    return NextResponse.json({ ok: true, alreadySubscribed: true });
  }

  // Reuses the same row (and its existing confirmToken) on a repeat
  // request for an unconfirmed address — just resends the same confirm
  // link rather than minting a second live token for the same subscription.
  const confirmToken = existing?.confirmToken ?? generateSubscriptionToken();
  const unsubscribeToken = existing?.unsubscribeToken ?? generateSubscriptionToken();

  await prisma.projectSubscription.upsert({
    where: { projectId_email: { projectId: project.id, email } },
    create: { projectId: project.id, email, confirmToken, unsubscribeToken },
    update: {},
  });

  const result = await sendConfirmEmail({
    to: email,
    projectName: project.name,
    projectSlug: project.slug,
    confirmToken,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send confirmation email. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, alreadySubscribed: false });
}
