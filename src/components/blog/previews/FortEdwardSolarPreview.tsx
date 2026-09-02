import { LocatorMap } from "@/components/blog/LocatorMap";

// Marker is the real Washington County, NY centroid (see
// src/lib/data/countyCentroidsByName.json, key "NY|WASHINGTON") projected
// through the same Albers-USA setup used to generate usStatePaths.json.
const FORT_EDWARD_MARKER: [number, number] = [769.5491678067469, 153.72457271265307];

export function FortEdwardSolarPreview() {
  return (
    <div className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <LocatorMap highlightStateName="New York" marker={FORT_EDWARD_MARKER} label="Fort Edward, NY" compact />
    </div>
  );
}
