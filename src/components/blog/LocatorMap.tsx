import usStatePaths from "@/lib/data/usStatePaths.json";

// A single-point locator map: highlights one state and marks one real
// coordinate on it. Uses the same vendored real US topology as UsStateMap
// (see usStatePaths.json's own header for how it was generated) so a marker
// computed under the same Albers-USA projection (scale 1100, translate
// [450, 280]) lines up correctly — never hand-placed.
export function LocatorMap({
  highlightStateName,
  marker,
  label,
  compact = false,
}: {
  highlightStateName: string;
  marker: [number, number]; // [x, y] in the 900x560 viewBox, already projected
  label: string;
  compact?: boolean;
}) {
  const [mx, my] = marker;

  const svg = (
    <svg
      viewBox="0 0 900 560"
      role="img"
      aria-label={`Map of the United States with ${highlightStateName} highlighted and ${label} marked`}
      className={compact ? "w-full h-full" : "w-full h-auto rounded-lg border border-[var(--border)] bg-[var(--panel)]"}
    >
      {usStatePaths
        .filter((s) => s.d)
        .map((s) => (
          <path
            key={s.id}
            d={s.d as string}
            fill={s.name === highlightStateName ? "#185fa5" : "#D3D1C7"}
            stroke="var(--panel)"
            strokeWidth={0.75}
          />
        ))}
      <circle cx={mx} cy={my} r={compact ? 7 : 9} fill="#d03b3b" stroke="#fcfcfb" strokeWidth={2} />
      {!compact && (
        <text x={mx + 14} y={my + 5} fontSize="15" fill="var(--text-primary, #0b0b0b)">
          {label}
        </text>
      )}
    </svg>
  );

  return svg;
}
