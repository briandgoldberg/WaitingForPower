// Shared logic for the "when will this resolve" prediction game — used by
// the human-facing API route (src/app/api/predictions/route.ts), the MCP
// submit_prediction tool, and the scoring hook src/lib/ingest/common.ts
// calls once a project's real resolutionDate lands. Kept in one place so
// a human's guess and an agent's guess are scored identically, no
// duplicated logic to drift apart.
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
  /** Optional, human-only — a self-chosen leaderboard nickname. Only ever set when provided; an omitted value never clears a previously-set nickname. */
  displayName?: string;
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

  const displayNameUpdate = params.displayName ? { displayName: params.displayName } : {};
  const predictor = params.anonymousKey
    ? await prisma.predictor.upsert({
        where: { anonymousKey: params.anonymousKey },
        create: { anonymousKey: params.anonymousKey, ...displayNameUpdate },
        update: displayNameUpdate,
      })
    : await prisma.predictor.upsert({
        where: { agentName: params.agentName as string },
        create: { agentName: params.agentName as string },
        update: {},
      });

  const prediction = await prisma.prediction.upsert({
    where: { projectId_predictorId: { projectId: project.id, predictorId: predictor.id } },
    create: { projectId: project.id, predictorId: predictor.id, predictedDate: params.predictedDate },
    update: { predictedDate: params.predictedDate },
  });

  return { prediction, predictor };
}

function predictorLabel(p: { displayName: string | null; agentName: string | null }): string {
  return p.displayName ?? p.agentName ?? "anonymous";
}

export async function getProjectGuesses(projectId: string) {
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
// keeps one lucky first guess from sitting at #1 forever.
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
