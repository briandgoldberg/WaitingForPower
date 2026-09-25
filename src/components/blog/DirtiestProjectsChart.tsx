// Simple hand-rolled SVG horizontal bar chart (no charting lib in this
// project — see GasShareChart/UsStateMap for the same reasoning) of the
// /dirtiest list's own top entries by capacity. Two different units (MW for
// gas plants, MMcf/d for pipelines) can't share one axis honestly, so bars
// are scaled within their own category only — see `category` below, which
// picks the color and which max the bar widths are relative to.
export interface ChartEntry {
  name: string;
  value: number;
  unit: string;
  category: "gas_generation" | "pipeline";
}

const COLORS: Record<ChartEntry["category"], string> = {
  gas_generation: "#b45309",
  pipeline: "#78350f",
};

export function DirtiestProjectsChart({ entries, compact = false }: { entries: ChartEntry[]; compact?: boolean }) {
  const width = 900;
  const rowH = compact ? 22 : 30;
  const padding = compact ? { top: 6, right: 10, bottom: 6, left: 10 } : { top: 16, right: 100, bottom: 16, left: 16 };
  const height = padding.top + padding.bottom + entries.length * rowH;
  const maxValue = Math.max(...entries.map((e) => e.value), 1);
  const chartW = width - padding.left - padding.right;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Bar chart ranking the largest pending fossil-fuel projects: ${entries.map((e) => `${e.name} at ${e.value.toLocaleString()} ${e.unit}`).join(", ")}`}
      className={compact ? "w-full h-full" : "w-full h-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2"}
    >
      {!compact && <title>Largest pending fossil-fuel projects by capacity</title>}
      {entries.map((e, i) => {
        const y = padding.top + i * rowH;
        const barW = Math.max(chartW * (e.value / maxValue), 2);
        return (
          <g key={e.name}>
            <rect x={padding.left} y={y + rowH * 0.15} width={chartW} height={rowH * 0.7} fill="var(--border)" opacity={0.2} rx={3} />
            <rect x={padding.left} y={y + rowH * 0.15} width={barW} height={rowH * 0.7} fill={COLORS[e.category]} rx={3} />
            {!compact && (
              <>
                <text x={padding.left + 8} y={y + rowH * 0.65} fontSize={12} fontWeight={600} fill="white">
                  {e.name.length > 42 ? `${e.name.slice(0, 41)}…` : e.name}
                </text>
                <text x={width - padding.right + 8} y={y + rowH * 0.65} fontSize={12} fontWeight={700} fill="var(--foreground)">
                  {e.value.toLocaleString()} {e.unit}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
