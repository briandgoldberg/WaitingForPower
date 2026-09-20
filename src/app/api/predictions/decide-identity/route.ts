import { NextRequest, NextResponse } from "next/server";
import { decideIdentity, PredictionError } from "@/lib/predictions";

export const dynamic = "force-dynamic";

// "Post as my anonymous handle": records that this person has decided how to
// appear, which makes the posts they already made public.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const anonymousKey = String(body.anonymousKey ?? "").trim();
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }
  try {
    await decideIdentity(anonymousKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PredictionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("Failed to record identity decision:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
