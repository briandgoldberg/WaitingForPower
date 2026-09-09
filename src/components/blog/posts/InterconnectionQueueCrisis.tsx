import Link from "next/link";
import { computeInterconnectionQueueCrisis } from "@/lib/interconnectionQueueCrisis";
import { QueueGrowthChart } from "@/components/blog/QueueGrowthChart";

// Computed live at request time from this site's own LBNL Queued Up-sourced
// rows (active status, >=250MW — see interconnectionQueueCrisis.ts), same
// pattern as the other data-driven posts.
export async function InterconnectionQueueCrisis() {
  const { years, totalMw, totalCount, medianYearsWaiting, topRegions, cleanEnergyShareOfMw } =
    await computeInterconnectionQueueCrisis();
  const totalGw = Math.round(totalMw / 1000);
  const topRegion = topRegions[0];

  return (
    <div className="flex flex-col gap-5">
      <QueueGrowthChart years={years} />

      <div className="text-sm leading-relaxed flex flex-col gap-3">
        <p>
          Right now, in our tracked dataset alone, <strong>{totalGw.toLocaleString()} GW</strong> of generation and
          storage capacity ({totalCount.toLocaleString()} projects, 250 MW and up) is sitting in an active
          interconnection queue somewhere in the U.S., waiting for its grid operator to finish studying whether
          &mdash; and at what cost &mdash; it can actually connect. The median project in that queue right now has
          already been waiting <strong>{medianYearsWaiting.toFixed(1)} years</strong>, and that clock doesn&rsquo;t
          stop when a project also has to clear a state permitting process on top of it.
        </p>
        <p>
          The chart above groups every currently-active queue position by the year it entered. Read it carefully:
          part of that shape is real growth in new interconnection requests, but part of it is survivorship &mdash;
          a project that entered the queue in 2018 and is still &ldquo;active&rdquo; seven years later is
          increasingly rare, because most projects from that far back have by now either been built, withdrawn, or
          suspended and dropped out of the &ldquo;active&rdquo; count entirely. What the chart reliably shows is the
          size of today&rsquo;s live backlog and roughly when it accumulated, not a clean historical arrival rate.
        </p>
        <p>
          {topRegion && (
            <>
              The backlog isn&rsquo;t spread evenly: {topRegion.region} alone accounts for{" "}
              {Math.round(topRegion.mw / 1000).toLocaleString()} GW of it, more than any other single grid
              region we track.{" "}
            </>
          )}
          And it&rsquo;s overwhelmingly not the resource type driving new permitting filings. Our other post found
          gas at 41% of newly-filed generation capacity in 2025 &mdash; but gas plants mostly skip this queue
          entirely, since they don&rsquo;t need the same grid-scale studies a large new wind, solar, or storage
          interconnection does. Solar, wind, and storage together make up{" "}
          <strong>{cleanEnergyShareOfMw}%</strong> of the capacity stuck in the active queue right now. The two
          trends aren&rsquo;t a coincidence: when interconnection is the bottleneck, the option that doesn&rsquo;t
          have to wait for it wins new filings, regardless of cost or emissions.
        </p>
        <p>
          Every project behind this chart, with its real queue entry date and source, on{" "}
          <Link href="/projects" className="underline text-[var(--accent)]">
            Projects
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
