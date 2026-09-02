import Link from "next/link";
import { computeStateEfficiencyRanking } from "@/lib/stateEfficiency";
import { LocatorMap } from "@/components/blog/LocatorMap";

// Real Washington County, NY centroid (see
// src/lib/data/countyCentroidsByName.json, key "NY|WASHINGTON") projected
// through the same Albers-USA setup used to generate usStatePaths.json.
const FORT_EDWARD_MARKER: [number, number] = [769.5491678067469, 153.72457271265307];

// Computed live so the NY comparison stays current — see
// computeStateEfficiencyRanking's own header for methodology.
export async function FortEdwardSolarApproved() {
  const { ranked } = await computeStateEfficiencyRanking();
  const ny = ranked.find((r) => r.code === "NY");

  return (
    <div className="text-sm leading-relaxed flex flex-col gap-3">
      <LocatorMap highlightStateName="New York" marker={FORT_EDWARD_MARKER} label="Fort Edward, NY" />
      <p>
        Boralex&rsquo;s{" "}
        <Link href="/project/fort-edward-solar-llc-ny-dps-case-23-03023-03023" className="underline text-[var(--accent)]">
          Fort Edward Solar Project
        </Link>{" "}
        &mdash; a 100 MW facility proposed for roughly 750 acres in the Town of Fort Edward, Washington
        County &mdash; just received its siting permit from New York State. The application was filed
        in October 2023; the approval landed about 2.6 years later.
      </p>
      <p>
        What actually changed: the project cleared the state&rsquo;s Article VIII major renewable
        facility siting review, the regulatory gate every generation project this size has to pass
        before construction can start. What hasn&rsquo;t changed: nothing has been built yet.
        Permitting risk is off the table; construction financing, interconnection, and an actual
        build timeline are still ahead of it.
        {ny && (
          <>
            {" "}
            For context, that ~2.6-year wait is close to New York&rsquo;s own current median (
            {ny.medianWaitYears} yrs, rank #{ny.rank} of 47 states we track) &mdash; this wasn&rsquo;t
            an unusually fast or slow case for the state, it&rsquo;s roughly what &ldquo;normal&rdquo;
            looks like there right now.
          </>
        )}
      </p>
      <p>
        Full permitting history, sources, and methodology on the{" "}
        <Link href="/project/fort-edward-solar-llc-ny-dps-case-23-03023-03023" className="underline text-[var(--accent)]">
          project page
        </Link>
        .
      </p>
    </div>
  );
}
