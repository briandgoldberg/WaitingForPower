import { NextRequest, NextResponse } from "next/server";
import { chooseDisplayName, PredictionError } from "@/lib/predictions";

export const dynamic = "force-dynamic";

// Choose your own public name. Only allowed once, and only for a profile
// whose email has been confirmed; everyone else stays anonymous.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const name = String(body.name ?? "");
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }

  try {
    const predictor = await chooseDisplayName(anonymousKey, name);
    return NextResponse.json({ ok: true, displayName: predictor.displayName });
  } catch (err) {
    if (err instanceof PredictionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("Failed to set display name:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
