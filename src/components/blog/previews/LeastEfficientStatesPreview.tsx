import { computeStateEfficiencyRanking } from "@/lib/stateEfficiency";
import { UsStateMap } from "@/components/blog/UsStateMap";

// Small thumbnail for the /blog index card — same live data and coloring as
// the full post, just the compact/no-legend rendering (see UsStateMap).
export async function LeastEfficientStatesPreview() {
  const { ranked } = await computeStateEfficiencyRanking();
  return (
    <div className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <UsStateMap ranked={ranked} compact />
    </div>
  );
}
