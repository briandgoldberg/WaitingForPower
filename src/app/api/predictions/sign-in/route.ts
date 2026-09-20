import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSubscriptionToken } from "@/lib/subscriptionTokens";
import { sendPredictorSignInEmail } from "@/lib/predictorEmail";

export const dynamic = "force-dynamic";

const MAX_LINKS_PER_HOUR = 3;

// Step one of restoring a saved profile on a new browser or device: email a
// short-lived sign-in link to the address a profile was confirmed with. The
// response is identical whether or not that email has a profile, so this
// can't be used to check who has one.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Predictor.email is only ever set after the magic-link confirmation, so a
  // match here is a confirmed address.
  const predictor = await prisma.predictor.findUnique({ where: { email } });
  if (predictor?.anonymousKey) {
    const recent = await prisma.predictorSignInToken.count({
      where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent < MAX_LINKS_PER_HOUR) {
      const token = generateSubscriptionToken();
      await prisma.predictorSignInToken.create({ data: { predictorId: predictor.id, token } });
      const result = await sendPredictorSignInEmail({ to: email, token });
      if (!result.ok) console.error("Failed to send sign-in email:", result.error);
    }
  }

  return NextResponse.json({ ok: true });
}
