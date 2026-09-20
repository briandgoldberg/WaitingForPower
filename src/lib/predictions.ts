// Shared logic for the "when will this resolve" prediction game — used by
// the human-facing API route (src/app/api/predictions/route.ts), the MCP
// submit_prediction tool, and the scoring hook src/lib/ingest/common.ts
// calls once a project's real resolutionDate lands. Kept in one place so
// a human's prediction and an agent's prediction are scored identically,
// no duplicated logic to drift apart.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { isPredictionEligibleState } from "@/lib/data/predictionEligibleStates";
import { RESOLVED_STAGES, type ProjectStage } from "@/lib/data/taxonomies";

export class PredictionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface SubmitPredictionParams {
  projectId: string;
  predictedDate: Date;
  /** Exactly one of anonymousKey/agentName must be set — see Predictor's own CHECK constraint. */
  anonymousKey?: string;
  agentName?: string;
  /** Optional reason, shown in the project's Comments and the home People feed. Trimmed and capped at MAX_WHY_LENGTH by the caller. */
  why?: string;
}

export const MAX_WHY_LENGTH = 500;

const ADJECTIVES = [
  "Steady", "Patient", "Curious", "Bright", "Quiet", "Swift", "Amber", "Northern", "Coastal", "Prairie",
  "Alpine", "Golden", "Silver", "Cedar", "Copper", "Bold", "Calm", "Keen", "Vivid", "Lively",
  "Sunny", "Brisk", "Noble", "Clever", "Nimble", "Sturdy", "Cheerful", "Mellow", "Plucky", "Dapper",
];
const NOUNS = [
  "Heron", "Otter", "Falcon", "Badger", "Lynx", "Osprey", "Beaver", "Moose", "Kestrel", "Raven",
  "Fox", "Wren", "Bison", "Egret", "Marten", "Lighthouse", "Turbine", "Compass", "Harbor", "Summit",
  "Canyon", "Meadow", "Comet", "Ridge", "Pine", "Willow", "Finch", "Elk", "Crane", "Owl",
];

async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const hit = await prisma.predictor.findFirst({
    where: {
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
      OR: [
        { displayName: { equals: name, mode: "insensitive" } },
        { agentName: { equals: name, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return hit != null;
}

// Everyone starts anonymous with a random, playful, temporary handle like
// "CopperFalcon48" that says nothing about who they are.
async function generateAnonymousHandle(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const handle = adjective + noun + (10 + Math.floor(Math.random() * 90));
    if (!(await nameTaken(handle))) return handle;
  }
  return "Guest" + randomBytes(3).toString("hex");
}

// One identity for everything a person does on this site: predictions,
// comments, and likes all hang off the same Predictor row, keyed by the
// browser's anonymous key. New people get an anonymous handle; choosing a
// real name is a separate, email-gated step (see chooseDisplayName).
export async function getOrCreateHumanPredictor(anonymousKey: string) {
  const existing = await prisma.predictor.findUnique({ where: { anonymousKey } });
  if (existing?.displayName) return existing;
  const displayName = await generateAnonymousHandle();
  if (existing) return prisma.predictor.update({ where: { id: existing.id }, data: { displayName } });
  return prisma.predictor.create({ data: { anonymousKey, displayName } });
}

const RESERVED_NAME = /^(anon|anonymous|guest|admin|administrator|moderator|mod|staff|official|support|system|waitingforpower)\b/i;
// Looks like an auto-assigned handle (CopperFalcon48); those can't be chosen.
const HANDLE_SHAPE = /^[A-Z][a-z]+[A-Z][a-z]+\d{2,3}$/;
const GUEST_SHAPE = /^Guest[0-9a-f]{6}$/;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,22}[A-Za-z0-9]$/;

// Only a person who has confirmed an email can pick their own public name,
// once. Everyone else stays anonymous, so a name always means someone who
// can be reached and tied to one profile.
export async function chooseDisplayName(anonymousKey: string, rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!NAME_PATTERN.test(name)) {
    throw new PredictionError("invalid_name", "Use 3 to 24 letters, numbers, spaces, dots, dashes or underscores.");
  }
  if (RESERVED_NAME.test(name) || HANDLE_SHAPE.test(name) || GUEST_SHAPE.test(name)) {
    throw new PredictionError("reserved_name", "That name is reserved. Pick another.");
  }

  const predictor = await prisma.predictor.findUnique({ where: { anonymousKey } });
  if (!predictor) throw new PredictionError("not_found", "Post something first.");
  if (!predictor.email) throw new PredictionError("email_required", "Confirm your email to choose a name.");
  if (predictor.nameChosenAt) throw new PredictionError("already_chosen", "Your name is already set and can't be changed.");
  if (await nameTaken(name, predictor.id)) throw new PredictionError("name_taken", "That name is taken. Pick another.");

  return prisma.predictor.update({ where: { id: predictor.id }, data: { displayName: name, nameChosenAt: new Date(), identityDecidedAt: predictor.identityDecidedAt ?? new Date() },
  });
}

// A first-time poster's posts are held (visible only to them) until they
// decide how to appear. Choosing to continue as their anonymous handle is
// one way to decide; confirming an email or choosing a name are the others.
export async function decideIdentity(anonymousKey: string) {
  const predictor = await prisma.predictor.findUnique({ where: { anonymousKey } });
  if (!predictor) throw new PredictionError("not_found", "Post something first.");
  if (predictor.identityDecidedAt) return predictor;
  return prisma.predictor.update({ where: { id: predictor.id }, data: { identityDecidedAt: new Date() } });
}

export async function submitPrediction(params: SubmitPredictionParams) {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new PredictionError("not_found", "Project not found.");
  if (RESOLVED_STAGES.includes(project.currentStage as ProjectStage)) {
    throw new PredictionError("already_resolved", "This project has already resolved — no new predictions.");
  }
  if (!isPredictionEligibleState(project.state)) {
    throw new PredictionError("ineligible_state", "Predictions aren't open for this project's state yet.");
  }
  if (Number.isNaN(params.predictedDate.getTime()) || params.predictedDate.getTime() <= Date.now()) {
    throw new PredictionError("invalid_date", "Predicted date must be a valid date in the future.");
  }

  const predictor = params.anonymousKey
    ? await getOrCreateHumanPredictor(params.anonymousKey)
    : await prisma.predictor.upsert({
        where: { agentName: params.agentName as string },
        create: { agentName: params.agentName as string },
        update: {},
      });

  // A prediction is a one-time commitment, not an editable draft — once
  // it's in, it's in, for both humans and agents. Enforced here (not just
  // hidden in the UI) since the MCP tool talks to submitPrediction directly.
  const existing = await prisma.prediction.findUnique({
    where: { projectId_predictorId: { projectId: project.id, predictorId: predictor.id } },
  });
  if (existing) {
    throw new PredictionError("already_predicted", "You've already predicted on this project — predictions can't be changed once submitted.");
  }

  const prediction = await prisma.prediction.create({
    data: { projectId: project.id, predictorId: predictor.id, predictedDate: params.predictedDate, why: params.why || null },
  });

  return { prediction, predictor };
}

function predictorLabel(p: { displayName: string | null; agentName: string | null }): string {
  return p.displayName ?? p.agentName ?? "anonymous";
}

export async function getProjectPredictions(projectId: string) {
  const rows = await prisma.prediction.findMany({
    where: { projectId },
    include: { predictor: { select: { displayName: true, agentName: true } } },
    orderBy: { predictedDate: "asc" },
  });
  return rows.map((r) => ({
    label: predictorLabel(r.predictor),
    isAgent: r.predictor.agentName != null,
    predictedDate: r.predictedDate.toISOString(),
    submittedAt: r.submittedAt.toISOString(),
  }));
}

// All-time cumulative leaderboard, not a monthly reset — real resolution
// volume across every prediction-eligible state is only ~4/month (confirmed
// live 2026-09-14), so a monthly board would read as empty most months.
// This accumulates real signal permanently instead. Minimum scored count
// keeps one lucky first prediction from sitting at #1 forever.
const MIN_SCORED_FOR_LEADERBOARD = 3;

export async function getLeaderboard(limit = 50) {
  const grouped = await prisma.prediction.groupBy({
    by: ["predictorId"],
    where: { scoredAt: { not: null } },
    _avg: { daysOff: true },
    _count: { _all: true },
  });
  const qualifying = grouped.filter((r) => r._count._all >= MIN_SCORED_FOR_LEADERBOARD);
  const predictors = await prisma.predictor.findMany({
    where: { id: { in: qualifying.map((r) => r.predictorId) } },
    select: { id: true, displayName: true, agentName: true },
  });
  const byId = new Map(predictors.map((p) => [p.id, p]));

  return qualifying
    .map((r) => {
      const p = byId.get(r.predictorId);
      return {
        id: r.predictorId,
        label: p ? predictorLabel(p) : "anonymous",
        isAgent: p?.agentName != null,
        scoredCount: r._count._all,
        avgDaysOff: Math.round(r._avg.daysOff ?? 0),
      };
    })
    .sort((a, b) => a.avgDaysOff - b.avgDaysOff)
    .slice(0, limit);
}

// Called once, right after upsertNormalizedProject (common.ts) sets a
// project's resolutionDate for the first time — scores every outstanding
// (unscored) prediction against the real date, then never revisits them
// even if resolutionDate is later corrected by an unrelated data-quality
// fix (see Prediction.daysOff's own schema.prisma comment for why that's
// deliberate: a predictor's historical score should stay frozen).
export async function scorePredictionsForProject(projectId: string, resolutionDate: Date): Promise<void> {
  const outstanding = await prisma.prediction.findMany({ where: { projectId, scoredAt: null } });
  if (outstanding.length === 0) return;
  const now = new Date();
  await Promise.all(
    outstanding.map((p) => {
      const daysOff = Math.round(Math.abs(p.predictedDate.getTime() - resolutionDate.getTime()) / (24 * 3600 * 1000));
      return prisma.prediction.update({ where: { id: p.id }, data: { daysOff, scoredAt: now } });
    }),
  );
}
