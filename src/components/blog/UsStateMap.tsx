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
  { max: 0, color: "#0ca30c", grade: "A" },
  { max: 0, color: "#8bc34a", grade: "B" },
  { max: 0, color: "#fab219", grade: "C" },
  { max: 0, color: "#ec835a", grade: "D" },
  { max: Infinity, color: "#d03b3b", grade: "F" },
];

function quintileBreaks(values: number[]): [number, number, number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
  return [q(0.2), q(0.4), q(0.6), q(0.8)];
}

// Shared by the full map and the compact thumbnail (see `compact` below) so
// a state's color/grade can never drift between the two renderings.
export function buildColorFor(ranked: StateEfficiencyRow[]) {
  const byCode = new Map(ranked.map((r) => [r.code, r]));
  const [q1, q2, q3, q4] = quintileBreaks(ranked.map((r) => r.medianWaitYears));
  const tiers = [
    { ...TIERS[0], max: q1 },
    { ...TIERS[1], max: q2 },
    { ...TIERS[2], max: q3 },
    { ...TIERS[3], max: q4 },
    TIERS[4],
  ];
  function tierFor(code: string) {
    const r = byCode.get(code);
    if (!r) return null;
    return tiers.find((t) => r.medianWaitYears <= t.max) ?? tiers[tiers.length - 1];
  }
  function colorFor(code: string): string {
    return tierFor(code)?.color ?? NO_DATA_COLOR;
  }
  function gradeFor(code: string): string | null {
    return tierFor(code)?.grade ?? null;
  }
  return { colorFor, gradeFor, tiers, byCode };
}

// The path data is plain polygons (M/L/Z only — no curves, confirmed
// against the generated usStatePaths.json), so a real area-weighted
// centroid (shoelace formula) is cheap and exact rather than an
// approximation. Several states are multi-part (islands, detached
// panhandle slivers) — e.g. Alabama's own path data includes a
// degenerate zero-area point alongside its real landmass — so this picks
// the largest-area subpath rather than averaging all of them, which
// would otherwise drag a label out into open water or a tiny sliver.
function parseSubpaths(d: string): { x: number; y: number }[][] {
  return d
    .split(/(?=M)/)
    .filter(Boolean)
    .map((sp) => {
      const nums = sp.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) points.push({ x: nums[i], y: nums[i + 1] });
      return points;
    });
}

function polygonCentroidAndArea(points: { x: number; y: number }[]): { cx: number; cy: number; area: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    area += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  area /= 2;
  if (area === 0) {
    const n = points.length || 1;
    return { cx: points.reduce((s, p) => s + p.x, 0) / n, cy: points.reduce((s, p) => s + p.y, 0) / n, area: 0 };
  }
  return { cx: cx / (6 * area), cy: cy / (6 * area), area: Math.abs(area) };
}

function labelPositionFor(d: string): { x: number; y: number } {
  const subpaths = parseSubpaths(d).filter((pts) => pts.length >= 3);
  if (subpaths.length === 0) return { x: 0, y: 0 };
  let best = polygonCentroidAndArea(subpaths[0]);
  for (const pts of subpaths.slice(1)) {
    const candidate = polygonCentroidAndArea(pts);
    if (candidate.area > best.area) best = candidate;
  }
  return { x: best.cx, y: best.cy };
}

// `compact` drops the legend, caption, per-state tooltips, and grade
// letters for use as a small card thumbnail (see src/app/blog/page.tsx) —
// same real geometry and coloring as the full map, just stripped down.
export function UsStateMap({ ranked, compact = false }: { ranked: StateEfficiencyRow[]; compact?: boolean }) {
  const { colorFor, gradeFor, tiers, byCode } = buildColorFor(ranked);

  // Alaska is dropped unconditionally (its inset position/scale makes it
  // an odd fit next to real state shapes here); every other state with no
  // rank (insufficient sample — see MIN_SAMPLE in stateEfficiency.ts) is
  // also skipped rather than shown in a separate "no data" gray, so the
  // map only ever shows states that actually got graded.
  const gradedPaths = usStatePaths.filter((s) => {
    if (!s.d || s.name === "Alaska") return false;
    const code = CODE_BY_NAME.get(s.name);
    return code ? byCode.has(code) : false;
  });

  const svg = (
    <svg
      viewBox="0 0 900 560"
      role="img"
      aria-label="Choropleth map of the United States, states colored and graded A through F by permit processing speed from most efficient to least efficient"
      className={compact ? "w-full h-full" : "w-full h-auto rounded-lg border border-[var(--border)] bg-[var(--panel)]"}
    >
      {!compact && <title>State permit efficiency map</title>}
      {gradedPaths.map((s) => {
        const code = CODE_BY_NAME.get(s.name) as string;
        const r = byCode.get(code);
        return (
          <path key={s.id} d={s.d as string} fill={colorFor(code)} stroke="var(--panel)" strokeWidth={0.75}>
            {!compact && r && (
              <title>{`${s.name}: #${r.rank} of ${ranked.length}, median ${r.medianWaitYears} yrs currently waiting (${r.pending} pending, ${r.resolved} resolved)`}</title>
            )}
          </path>
        );
      })}
      {!compact &&
        gradedPaths.map((s) => {
          const code = CODE_BY_NAME.get(s.name) as string;
          const grade = gradeFor(code);
          if (!grade) return null;
          const { x, y } = labelPositionFor(s.d as string);
          return (
            <text
              key={`${s.id}-grade`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={13}
              fontWeight={700}
              fill="#000"
              fillOpacity={0.4}
              pointerEvents="none"
            >
              {grade}
            </text>
          );
        })}
    </svg>
  );

  if (compact) return svg;

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        {tiers.map((t) => (
          <span key={t.grade} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
            {t.grade}
          </span>
        ))}
      </div>
      {svg}
      <figcaption className="text-sm font-medium">Least efficient states for permitting energy projects</figcaption>
    </figure>
  );
}
