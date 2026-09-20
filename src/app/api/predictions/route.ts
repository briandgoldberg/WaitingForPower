import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitPrediction, getProjectPredictions, PredictionError, MAX_WHY_LENGTH } from "@/lib/predictions";

export const dynamic = "force-dynamic";

// Human-facing prediction submission — keyed by the anonymous browser-
// generated key (see ProjectDiscussion.tsx), never a login. Bots submit through
// the MCP submit_prediction tool instead (src/app/mcp/route.ts), which
// calls the same shared submitPrediction() so both are scored identically.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const anonymousKey = String(body.anonymousKey ?? "").trim();
  const predictedDateRaw = String(body.predictedDate ?? "").trim();
  const why = String(body.why ?? "").trim();

  if (!projectId || !anonymousKey || !predictedDateRaw) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (why.length > MAX_WHY_LENGTH) {
    return NextResponse.json({ error: `Keep your reason under ${MAX_WHY_LENGTH} characters.` }, { status: 400 });
  }
  // A random client-generated key, not a guessable id — same shape as this
  // site's other anonymous, no-login features (see GreenlightVote's old
  // voterKey history). Loosely bounded, not parsed as a specific format,
  // since the client is the only thing that ever generates one.
  if (anonymousKey.length < 8 || anonymousKey.length > 200) {
    return NextResponse.json({ error: "Invalid anonymous key." }, { status: 400 });
  }

  const predictedDate = new Date(predictedDateRaw);

  try {
    const { prediction, predictor } = await submitPrediction({ projectId, predictedDate, anonymousKey, why: why || undefined });
    return NextResponse.json({
      ok: true,
      predictedDate: prediction.predictedDate.toISOString(),
      displayName: predictor.displayName,
      hasSavedProfile: predictor.email != null,
      nameChosen: predictor.nameChosenAt != null,
      identityDecided: predictor.identityDecidedAt != null,
    });
  } catch (err) {
    if (err instanceof PredictionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("Failed to submit prediction:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// Every current prediction on one project — see getProjectPredictions in
// src/lib/predictions.ts. Powers the "everyone's predictions" list on the
// project page; no auth, same as every other read on this site's public API.
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const predictions = await getProjectPredictions(projectId);
  return NextResponse.json({ predictions });
}
