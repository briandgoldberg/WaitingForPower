import { DirtiestProjectsChart, type ChartEntry } from "@/components/blog/DirtiestProjectsChart";

// Static, hand-picked sample rather than a live fetch — index thumbnails
// render many at once and don't need to be exactly current, just
// representative (see the full post for the real, live-fetched ranking).
const SAMPLE: ChartEntry[] = [
  { name: "Rockport gas plant", value: 1520, unit: "MW", category: "gas_generation" },
  { name: "Corpus Christi pipeline", value: 3000, unit: "MMcf/d", category: "pipeline" },
  { name: "Fort Martin gas plant", value: 1200, unit: "MW", category: "gas_generation" },
];

export function DirtiestProjectsMethodologyPreview() {
  return (
    <div className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] p-2 flex items-center">
      <DirtiestProjectsChart entries={SAMPLE} compact />
    </div>
  );
}
