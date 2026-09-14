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

  // A guess is a one-time commitment, not an editable draft — once it's in,
  // it's in, for both humans and agents. Enforced here (not just hidden in
  // the UI) since the MCP tool talks to submitPrediction directly.
  const existing = await prisma.prediction.findUnique({
    where: { projectId_predictorId: { projectId: project.id, predictorId: predictor.id } },
  });
  if (existing) {
    throw new PredictionError("already_predicted", "You've already predicted on this project — guesses can't be changed once submitted.");
  }

  const prediction = await prisma.prediction.create({
    data: { projectId: project.id, predictorId: predictor.id, predictedDate: params.predictedDate },
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

// Live feed of current (unscored) guesses for the leaderboard page — "what
// is everyone predicting right now." Leaderboard-ranked predictors' guesses
// surface first (rank ascending); with real resolution volume this low
// (~4/month, see MIN_SCORED_FOR_LEADERBOARD above), the leaderboard itself
// stays empty for long stretches, so this falls back to plain recency
// rather than going blank whenever nobody has qualified yet.
// A predictor is capped to MAX_PER_PREDICTOR rows here — without it, one
// prolific guesser (an agent that predicted on hundreds of projects in a
// single run, say) would fill the entire feed and crowd out everyone
// else's guesses. The overflow is surfaced as `moreCount` on that
// predictor's last shown row, linking to their own /leaderboard/[id] page
// for the rest instead of listing it all here.
const MAX_PER_PREDICTOR_IN_FEED = 3;

export async function getTopGuesses(limit = 12) {
  const leaderboard = await getLeaderboard(50);
  const rankById = new Map(leaderboard.map((l, i) => [l.id, i]));

  // No `take` cap here (beyond this generous ceiling) — capping the raw
  // query by recency would risk the fetch itself being dominated by one
  // predictor's flood before per-predictor capping ever gets a chance to
  // run, silently hiding everyone else's guesses.
  const outstanding = await prisma.prediction.findMany({
    where: { scoredAt: null },
    include: {
      predictor: { select: { id: true, displayName: true, agentName: true } },
      project: { select: { slug: true, name: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: 5000,
  });

  const mapped = outstanding.map((p) => ({
    predictorId: p.predictor.id,
    label: predictorLabel(p.predictor),
    isAgent: p.predictor.agentName != null,
    rank: rankById.get(p.predictor.id),
    projectSlug: p.project.slug,
    projectName: p.project.name,
    predictedDate: p.predictedDate.toISOString(),
    submittedAt: p.submittedAt.toISOString(),
  }));

  mapped.sort((a, b) => {
    const ar = a.rank ?? Infinity;
    const br = b.rank ?? Infinity;
    if (ar !== br) return ar - br;
    return b.submittedAt.localeCompare(a.submittedAt);
  });

  const totalByPredictor = new Map<string, number>();
  for (const g of mapped) totalByPredictor.set(g.predictorId, (totalByPredictor.get(g.predictorId) ?? 0) + 1);

  const shownByPredictor = new Map<string, number>();
  const capped: (typeof mapped[number] & { moreCount: number })[] = [];
  for (const g of mapped) {
    const shown = shownByPredictor.get(g.predictorId) ?? 0;
    if (shown >= MAX_PER_PREDICTOR_IN_FEED) continue;
    shownByPredictor.set(g.predictorId, shown + 1);
    capped.push({ ...g, moreCount: 0 });
  }

  const lastIndexByPredictor = new Map<string, number>();
  capped.forEach((g, i) => lastIndexByPredictor.set(g.predictorId, i));
  for (const [predictorId, lastIndex] of lastIndexByPredictor) {
    const total = totalByPredictor.get(predictorId) ?? 0;
    const shown = shownByPredictor.get(predictorId) ?? 0;
    if (total > shown) capped[lastIndex].moreCount = total - shown;
  }

  return capped.slice(0, limit);
}

// One predictor's full track record — every prediction they've made,
// scored or still outstanding, with the project it was on. Backs the
// leaderboard drill-in page (src/app/leaderboard/[id]/page.tsx).
export async function getPredictorDetail(predictorId: string) {
  const predictor = await prisma.predictor.findUnique({
    where: { id: predictorId },
    select: { id: true, displayName: true, agentName: true, createdAt: true },
  });
  if (!predictor) return null;

  const predictions = await prisma.prediction.findMany({
    where: { predictorId },
    include: { project: { select: { slug: true, name: true, resolutionDate: true } } },
    orderBy: { submittedAt: "desc" },
  });

  const scored = predictions.filter((p) => p.scoredAt != null);
  const avgDaysOff = scored.length > 0 ? Math.round(scored.reduce((sum, p) => sum + (p.daysOff ?? 0), 0) / scored.length) : null;

  return {
    label: predictorLabel(predictor),
    isAgent: predictor.agentName != null,
    memberSince: predictor.createdAt.toISOString(),
    scoredCount: scored.length,
    avgDaysOff,
    predictions: predictions.map((p) => ({
      projectSlug: p.project.slug,
      projectName: p.project.name,
      predictedDate: p.predictedDate.toISOString(),
      resolutionDate: p.project.resolutionDate?.toISOString() ?? null,
      daysOff: p.daysOff,
      scored: p.scoredAt != null,
    })),
  };
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
