// Computes the per-state "permit efficiency" ranking used by the
// least-efficient-states blog post (see src/components/blog/posts). Ranked
// on median years currently waiting for still-pending ("in_permitting")
// projects — the most literal reading of "permit speed" and the metric
// least distorted by how far back each state's own data source's historical
// coverage happens to go (see MIN_SAMPLE note below and the blog post body
// for the fuller caveat: some sources, e.g. wvPscDockets.ts, only capture a
// case while it's still open and lose it entirely once resolved, so a raw
// resolved-vs-pending "clearance rate" would conflate source coverage with
// real state-level speed — kept here as secondary context, not part of the
// ranking itself).
import { prisma } from "@/lib/db";
import { statusBucketForProject, type ProjectStage } from "@/lib/data/taxonomies";
import { splitStateCodes, stateName } from "@/lib/data/usStates";

// A state needs at least this many real (non-aggregate) tracked
// projects — resolved + pending + cancelled combined — before its median
// wait is trusted enough to rank; below this, one or two outlier projects
// can swing the number wildly. Below-threshold states are surfaced
// separately, not silently dropped.
const MIN_SAMPLE = 8;

export interface StateEfficiencyRow {
  rank: number;
  code: string;
  name: string;
  medianWaitYears: number;
  avgWaitYears: number;
  pending: number;
  resolved: number;
  clearanceRatePct: number | null;
}

export interface StateEfficiencyResult {
  ranked: StateEfficiencyRow[];
  excludedCodes: string[]; // insufficient sample (<MIN_SAMPLE)
  computedAt: string; // ISO timestamp, since this is computed live at request time
}

function yearsSince(date: Date): number {
  return (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

export async function computeStateEfficiencyRanking(): Promise<StateEfficiencyResult> {
  const projects = await prisma.project.findMany({
    select: {
      state: true,
      currentStage: true,
      noLongerReported: true,
      isAggregateExample: true,
      applicationFiledDate: true,
    },
  });

  interface Agg {
    permitsComplete: number;
    inPermitting: number;
    cancelledSuspended: number;
    waitYears: number[];
  }
  const byState = new Map<string, Agg>();
  function get(code: string): Agg {
    let a = byState.get(code);
    if (!a) {
      a = { permitsComplete: 0, inPermitting: 0, cancelledSuspended: 0, waitYears: [] };
      byState.set(code, a);
    }
    return a;
  }

  for (const p of projects) {
    if (p.isAggregateExample) continue;
    for (const code of splitStateCodes(p.state)) {
      if (code.length !== 2 || code === "MX") continue;
      const a = get(code);
      const bucket = statusBucketForProject(p.currentStage as ProjectStage, p.noLongerReported);
      if (bucket === "permits_complete") a.permitsComplete += 1;
      else if (bucket === "cancelled_suspended") a.cancelledSuspended += 1;
      else if (bucket === "in_permitting") {
        a.inPermitting += 1;
        if (p.applicationFiledDate) a.waitYears.push(yearsSince(p.applicationFiledDate));
      }
      // "no_longer_reported" is a data-quality artifact (source stopped
      // listing a still-pending project), not a real outcome — excluded
      // from both the sample-size count and the wait-time calculation.
    }
  }

  const all = [...byState.entries()].map(([code, a]) => {
    const counted = a.permitsComplete + a.inPermitting + a.cancelledSuspended;
    const sorted = [...a.waitYears].sort((x, y) => x - y);
    const medianWaitYears = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
    const avgWaitYears = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : null;
    const clearanceRatePct = counted > 0 ? Math.round((a.permitsComplete / counted) * 1000) / 10 : null;
    return {
      code,
      name: stateName(code),
      counted,
      medianWaitYears,
      avgWaitYears,
      pending: a.inPermitting,
      resolved: a.permitsComplete + a.cancelledSuspended,
      clearanceRatePct,
    };
  });

  const excludedCodes = all.filter((r) => r.counted < MIN_SAMPLE).map((r) => r.code).sort();

  const ranked: StateEfficiencyRow[] = all
    .filter((r) => r.counted >= MIN_SAMPLE && r.medianWaitYears != null)
    .sort((a, b) => (a.medianWaitYears as number) - (b.medianWaitYears as number))
    .map((r, i) => ({
      rank: i + 1,
      code: r.code,
      name: r.name,
      medianWaitYears: Math.round((r.medianWaitYears as number) * 100) / 100,
      avgWaitYears: r.avgWaitYears != null ? Math.round(r.avgWaitYears * 100) / 100 : 0,
      pending: r.pending,
      resolved: r.resolved,
      clearanceRatePct: r.clearanceRatePct,
    }));

  return { ranked, excludedCodes, computedAt: new Date().toISOString() };
}
