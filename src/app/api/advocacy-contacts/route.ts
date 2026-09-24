import { NextRequest, NextResponse } from "next/server";
import { submitAdvocacyContact, AdvocacyContactError } from "@/lib/advocacyContacts";
import { CONTACT_POINTS } from "@/lib/data/advocacyPoints";

export const dynamic = "force-dynamic";

// Logging a contact with a state regulator or a member of Congress — see
// src/lib/advocacyContacts.ts. Same anonymous-key identity as comments,
// never a login.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const targetType = String(body.targetType ?? "").trim();
  const state = String(body.state ?? "").trim();
  const targetName = typeof body.targetName === "string" ? body.targetName : undefined;
  const issues = Array.isArray(body.issues) ? body.issues.filter((i): i is string => typeof i === "string") : [];
  const note = typeof body.note === "string" ? body.note : undefined;

  if (!anonymousKey || !targetType || !state) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }

  try {
    const { contact, predictor } = await submitAdvocacyContact({
      anonymousKey,
      targetType,
      state,
      targetName,
      issues,
      note,
    });
    return NextResponse.json({
      ok: true,
      id: contact.id,
      createdAt: contact.createdAt.toISOString(),
      displayName: predictor.displayName,
      pointsEarned: CONTACT_POINTS,
    });
  } catch (err) {
    if (err instanceof AdvocacyContactError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "rate_limited" ? 429 : 400 });
    }
    console.error("Failed to submit advocacy contact:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
