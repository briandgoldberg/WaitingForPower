import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSubscriptionToken } from "@/lib/subscriptionTokens";
import { sendPredictorVerificationEmail } from "@/lib/predictorEmail";

export const dynamic = "force-dynamic";

// Step 2 of the two-step predict flow (see PredictCard.tsx): the human has
// already submitted a real prediction under their anonymousKey — this just
// asks whether they want that history to survive a device change. Never
// required to participate; only ever offered after a real prediction is
// already locked in.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!anonymousKey) {
    return NextResponse.json({ error: "Missing anonymous key." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // The predictor row is created the moment someone submits their first
  // real prediction (see submitPrediction in src/lib/predictions.ts) — if
  // it's missing here, they've never actually predicted on anything yet,
  // which the UI shouldn't allow reaching this step for.
  const predictor = await prisma.predictor.findUnique({ where: { anonymousKey } });
  if (!predictor) {
    return NextResponse.json({ error: "Post a prediction or comment first." }, { status: 400 });
  }

  const existingOwner = await prisma.predictor.findUnique({ where: { email } });
  if (existingOwner && existingOwner.id !== predictor.id) {
    return NextResponse.json({ error: "That email already has a saved profile. Sign in with it instead." }, { status: 409 });
  }

  const token = generateSubscriptionToken();
  await prisma.predictorEmailVerification.create({
    data: { predictorId: predictor.id, email, token },
  });

  const result = await sendPredictorVerificationEmail({ to: email, token });
  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send verification email. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
