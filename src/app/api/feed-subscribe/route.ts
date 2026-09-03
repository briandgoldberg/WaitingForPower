import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STATE_NAMES } from "@/lib/data/usStates";
import { generateSubscriptionToken } from "@/lib/subscriptionTokens";
import { sendFeedConfirmEmail } from "@/lib/feedSubscriptionEmail";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const stateRaw = String(body.state ?? "").trim().toUpperCase();
  const state = stateRaw && stateRaw in STATE_NAMES ? stateRaw : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (stateRaw && !state) {
    return NextResponse.json({ error: "Unrecognized state." }, { status: 400 });
  }

  // See FeedSubscription's schema.prisma header — "" is the DB-level "every
  // state" sentinel; `state` (possibly null) is what the rest of this route
  // and the email use.
  const dbState = state ?? "";

  const existing = await prisma.feedSubscription.findUnique({
    where: { email_state: { email, state: dbState } },
  });

  if (existing?.confirmed) {
    return NextResponse.json({ ok: true, alreadySubscribed: true });
  }

  // Reuses the same row (and its existing confirmToken) on a repeat
  // request for an unconfirmed address — just resends the same confirm
  // link rather than minting a second live token for the same subscription.
  const confirmToken = existing?.confirmToken ?? generateSubscriptionToken();
  const unsubscribeToken = existing?.unsubscribeToken ?? generateSubscriptionToken();

  await prisma.feedSubscription.upsert({
    where: { email_state: { email, state: dbState } },
    create: { email, state: dbState, confirmToken, unsubscribeToken },
    update: {},
  });

  const result = await sendFeedConfirmEmail({ to: email, state, confirmToken });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send confirmation email. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, alreadySubscribed: false });
}
