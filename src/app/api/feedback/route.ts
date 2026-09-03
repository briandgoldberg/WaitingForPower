import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fixed set matching IntentWidget.tsx's own INTENT_OPTIONS — validated here
// too so a malformed/scripted POST can't pollute the daily digest with
// junk values.
const VALID_INTENTS = new Set([
  "researcher_journalist",
  "developer_consultant",
  "investor",
  "policy_advocacy",
  "just_exploring",
]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const intent = String(body.intent ?? "");
  const path = String(body.path ?? "").slice(0, 500);

  if (!VALID_INTENTS.has(intent)) {
    return NextResponse.json({ error: "Invalid intent." }, { status: 400 });
  }

  await prisma.visitorFeedback.create({ data: { intent, path } });

  return NextResponse.json({ ok: true });
}
