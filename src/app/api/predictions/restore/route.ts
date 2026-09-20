import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;

// Step two: exchange a sign-in token for the profile's anonymous key so the
// browser can act as that profile again. Called by the /restore page only
// when the person clicks Continue, not on page load, so email link scanners
// that pre-fetch URLs can't burn the single-use token.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  }

  // Atomic claim: only one request can flip usedAt from null.
  const claimed = await prisma.predictorSignInToken.updateMany({
    where: { token, usedAt: null, createdAt: { gte: new Date(Date.now() - TOKEN_LIFETIME_MS) } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "That link expired or was already used. Request a new one." }, { status: 400 });
  }

  const row = await prisma.predictorSignInToken.findUnique({
    where: { token },
    select: { predictor: { select: { anonymousKey: true, displayName: true } } },
  });
  if (!row?.predictor.anonymousKey) {
    return NextResponse.json({ error: "That profile can't be restored." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, anonymousKey: row.predictor.anonymousKey, displayName: row.predictor.displayName });
}
