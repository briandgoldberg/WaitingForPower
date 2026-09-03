import type { GasShareYear } from "@/lib/gasFilingShare";

const GAS_COLOR = "#d03b3b";
const PARTIAL_GAS_COLOR = "#e8a4a4";

// Simple hand-rolled SVG bar chart (no charting lib in this project — see
// UsStateMap for the same reasoning) of gas's share of newly-filed MW by
// year. `compact` drops axis labels/legend for the /blog index thumbnail.
export function GasShareChart({ years, compact = false }: { years: GasShareYear[]; compact?: boolean }) {
  const width = 900;
  const height = compact ? 300 : 420;
  const padding = compact ? { top: 10, right: 10, bottom: 10, left: 10 } : { top: 24, right: 24, bottom: 44, left: 44 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barGap = chartW / years.length;
  const barW = barGap * 0.6;

  const yFor = (pct: number) => padding.top + chartH * (1 - pct / 100);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bar chart of natural gas's share of newly-filed generation capacity by year, rising from under 2% in 2022 to over 40% in 2025"
      className={compact ? "w-full h-full" : "w-full h-auto rounded-lg border border-[var(--border)] bg-[var(--panel)]"}
    >
      {!compact && <title>Gas share of newly-filed MW by year</title>}

      {!compact &&
        [0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(pct)} y2={yFor(pct)} stroke="var(--border)" strokeWidth={1} />
            <text x={padding.left - 8} y={yFor(pct) + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
              {pct}%
            </text>
          </g>
        ))}

      {years.map((y, i) => {
        const x = padding.left + i * barGap + (barGap - barW) / 2;
        const barTop = yFor(y.gasSharePct);
        const barH = padding.top + chartH - barTop;
        return (
          <g key={y.year}>
            <rect x={x} y={padding.top} width={barW} height={chartH} fill="var(--border)" opacity={0.25} />
            <rect x={x} y={barTop} width={barW} height={barH} fill={y.partial ? PARTIAL_GAS_COLOR : GAS_COLOR} rx={2} />
            {!compact && (
              <>
                <text x={x + barW / 2} y={barTop - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--foreground)">
                  {y.gasSharePct}%
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
