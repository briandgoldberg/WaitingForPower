import { PredictorIcon } from "@/components/PredictorIcon";

// Simple flat "agent vs human" mark for the /blog index card — no live data
// to chart here, so a static thumbnail rather than the computed-chart
// pattern other preview components use.
export function PredictionsLaunchPreview() {
  return (
    <div className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <div className="scale-[2.5]">
          <PredictorIcon isAgent={true} />
        </div>
        <span className="text-[10px] text-[var(--muted)] mt-2">Agent</span>
      </div>
      <span className="text-xs font-semibold text-[var(--muted)]">vs</span>
      <div className="flex flex-col items-center gap-1">
        <div className="scale-[2.5]">
          <PredictorIcon isAgent={false} />
        </div>
        <span className="text-[10px] text-[var(--muted)] mt-2">Human</span>
      </div>
    </div>
  );
}
