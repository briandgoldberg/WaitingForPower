import usStatePaths from "@/lib/data/usStatePaths.json";
import type { StateEfficiencyRow } from "@/lib/stateEfficiency";
import { STATE_NAMES } from "@/lib/data/usStates";

// Reversed once at module load — usStatePaths.json (see that file's
// generation, done via a real Albers-USA projection over the real
// us-atlas/states-10m topology, not hand-drawn) is keyed by full state
// name; the ranking data is keyed by USPS code.
const CODE_BY_NAME = new Map(Object.entries(STATE_NAMES).map(([code, name]) => [name, code]));

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

export function UsStateMap({ ranked }: { ranked: StateEfficiencyRow[] }) {
  const byCode = new Map(ranked.map((r) => [r.code, r]));
  const [q1, q2, q3] = quartileBreaks(ranked.map((r) => r.medianWaitYears));
  const tiers = [
    { ...TIERS[0], max: q1 },
    { ...TIERS[1], max: q2 },
    { ...TIERS[2], max: q3 },
    TIERS[3],
  ];

  function colorFor(code: string): string {
    const r = byCode.get(code);
    if (!r) return "#B4B2A9";
    return tiers.find((t) => r.medianWaitYears <= t.max)?.color ?? tiers[tiers.length - 1].color;
  }

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
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#B4B2A9" }} />
          Not enough data
        </span>
      </div>
      <svg
        viewBox="0 0 900 560"
        role="img"
        aria-label="Choropleth map of the United States, states colored by permit processing speed from most efficient (green) to least efficient (red)"
        className="w-full h-auto rounded-lg border border-[var(--border)] bg-[var(--panel)]"
      >
        <title>State permit efficiency map</title>
        {usStatePaths
          .filter((s) => s.d)
          .map((s) => {
            const code = CODE_BY_NAME.get(s.name);
            const r = code ? byCode.get(code) : undefined;
            return (
              <path key={s.id} d={s.d as string} fill={code ? colorFor(code) : "#B4B2A9"} stroke="var(--panel)" strokeWidth={0.75}>
                <title>{`${s.name}${
                  r
                    ? `: #${r.rank} of ${ranked.length}, median ${r.medianWaitYears} yrs currently waiting (${r.pending} pending, ${r.resolved} resolved)`
                    : ": not enough tracked projects to rank"
                }`}</title>
              </path>
            );
          })}
      </svg>
      <figcaption className="text-sm font-medium">Least efficient states for permitting energy projects</figcaption>
    </figure>
  );
}
