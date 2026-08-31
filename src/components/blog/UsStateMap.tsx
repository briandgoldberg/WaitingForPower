import usStatePaths from "@/lib/data/usStatePaths.json";
import type { StateEfficiencyRow } from "@/lib/stateEfficiency";
import { STATE_NAMES } from "@/lib/data/usStates";

// Reversed once at module load — usStatePaths.json (see that file's
// generation, done via a real Albers-USA projection over the real
// us-atlas/states-10m topology, not hand-drawn) is keyed by full state
// name; the ranking data is keyed by USPS code.
const CODE_BY_NAME = new Map(Object.entries(STATE_NAMES).map(([code, name]) => [name, code]));

const NO_DATA_COLOR = "#B4B2A9";

const TIERS = [
  { max: 0, color: "#0ca30c", label: "Most efficient" },
  { max: 0, color: "#fab219", label: "More efficient" },
  { max: 0, color: "#ec835a", label: "Less efficient" },
  { max: Infinity, color: "#d03b3b", label: "Least efficient" },
];

function quartileBreaks(values: number[]): [number, number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
  return [q(0.25), q(0.5), q(0.75)];
}

// Shared by the full map and the compact thumbnail (see `compact` below) so
// a state's color can never drift between the two renderings.
export function buildColorFor(ranked: StateEfficiencyRow[]) {
  const byCode = new Map(ranked.map((r) => [r.code, r]));
  const [q1, q2, q3] = quartileBreaks(ranked.map((r) => r.medianWaitYears));
  const tiers = [{ ...TIERS[0], max: q1 }, { ...TIERS[1], max: q2 }, { ...TIERS[2], max: q3 }, TIERS[3]];
  function colorFor(code: string): string {
    const r = byCode.get(code);
    if (!r) return NO_DATA_COLOR;
    return tiers.find((t) => r.medianWaitYears <= t.max)?.color ?? tiers[tiers.length - 1].color;
  }
  return { colorFor, tiers, byCode };
}

// `compact` drops the legend, caption, and per-state tooltips for use as a
// small card thumbnail (see src/app/blog/page.tsx) — same real geometry and
// coloring as the full map, just stripped down.
export function UsStateMap({ ranked, compact = false }: { ranked: StateEfficiencyRow[]; compact?: boolean }) {
  const { colorFor, tiers, byCode } = buildColorFor(ranked);

  const svg = (
    <svg
      viewBox="0 0 900 560"
      role="img"
      aria-label="Choropleth map of the United States, states colored by permit processing speed from most efficient (green) to least efficient (red)"
      className={compact ? "w-full h-full" : "w-full h-auto rounded-lg border border-[var(--border)] bg-[var(--panel)]"}
    >
      {!compact && <title>State permit efficiency map</title>}
      {usStatePaths
        .filter((s) => s.d)
        .map((s) => {
          const code = CODE_BY_NAME.get(s.name);
          const r = code ? byCode.get(code) : undefined;
          return (
            <path key={s.id} d={s.d as string} fill={code ? colorFor(code) : NO_DATA_COLOR} stroke="var(--panel)" strokeWidth={0.75}>
              {!compact && (
                <title>{`${s.name}${
                  r
                    ? `: #${r.rank} of ${ranked.length}, median ${r.medianWaitYears} yrs currently waiting (${r.pending} pending, ${r.resolved} resolved)`
                    : ": not enough tracked projects to rank"
                }`}</title>
              )}
            </path>
          );
        })}
    </svg>
  );

  if (compact) return svg;

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        {tiers.map((t) => (
          <span key={t.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NO_DATA_COLOR }} />
          Not enough data
        </span>
      </div>
      {svg}
      <figcaption className="text-sm font-medium">Least efficient states for permitting energy projects</figcaption>
    </figure>
  );
}
