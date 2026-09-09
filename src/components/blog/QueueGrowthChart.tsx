import type { QueueYear } from "@/lib/interconnectionQueueCrisis";

const BAR_COLOR = "#185fa5";
const PARTIAL_BAR_COLOR = "#8fb4d9";

// Simple hand-rolled SVG bar chart (no charting lib in this project — see
// GasShareChart for the same pattern this mirrors) of active interconnection
// queue capacity by the year each project entered the queue. `compact` drops
// axis labels for the /blog index thumbnail.
export function QueueGrowthChart({ years, compact = false }: { years: QueueYear[]; compact?: boolean }) {
  const width = 900;
  const height = compact ? 300 : 420;
  const padding = compact ? { top: 10, right: 10, bottom: 10, left: 10 } : { top: 24, right: 24, bottom: 44, left: 64 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barGap = chartW / years.length;
  const barW = barGap * 0.6;
  const maxMw = Math.max(...years.map((y) => y.mw), 1);

  const yFor = (mw: number) => padding.top + chartH * (1 - mw / maxMw);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bar chart of active interconnection queue capacity by year entered, rising sharply from a few gigawatts in 2017 to hundreds of gigawatts by 2025"
      className={compact ? "w-full h-full" : "w-full h-auto rounded-lg border border-[var(--border)] bg-[var(--panel)]"}
    >
      {!compact && <title>Active interconnection queue capacity (MW) by year entered</title>}

      {!compact &&
        [0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <g key={frac}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(maxMw * frac)}
              y2={yFor(maxMw * frac)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={padding.left - 8} y={yFor(maxMw * frac) + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
              {Math.round((maxMw * frac) / 1000)} GW
            </text>
          </g>
        ))}

      {years.map((y, i) => {
        const x = padding.left + i * barGap + (barGap - barW) / 2;
        const barTop = yFor(y.mw);
        const barH = padding.top + chartH - barTop;
        return (
          <g key={y.year}>
            <rect x={x} y={padding.top} width={barW} height={chartH} fill="var(--border)" opacity={0.25} />
            <rect x={x} y={barTop} width={barW} height={barH} fill={y.partial ? PARTIAL_BAR_COLOR : BAR_COLOR} rx={2} />
            {!compact && (
              <>
                <text x={x + barW / 2} y={barTop - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">
                  {Math.round(y.mw / 1000)}
                </text>
                <text x={x + barW / 2} y={height - padding.bottom + 20} textAnchor="middle" fontSize={13} fill="var(--muted)">
                  {y.year}
                  {y.partial ? "*" : ""}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
