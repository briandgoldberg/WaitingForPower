import Link from "next/link";
import { computeGasFilingShareByYear } from "@/lib/gasFilingShare";
import { GasShareChart } from "@/components/blog/GasShareChart";

// Computed live at request time, same as the other data-driven posts — see
// computeGasFilingShareByYear's own header for the MW-only methodology.
export async function GasTakingOverNewFilings() {
  const { years, firstYearPct, latestFullYearPct, latestFullYear } = await computeGasFilingShareByYear();
  const firstYear = years[0]?.year;

  return (
    <div className="flex flex-col gap-5">
      <GasShareChart years={years} />

      <div className="text-sm leading-relaxed flex flex-col gap-3">
        <p>
          In {firstYear}, gas was {firstYearPct}% of newly-filed generation capacity in our dataset. By{" "}
          {latestFullYear}, it was {latestFullYearPct}%. That&rsquo;s not a gradual drift &mdash; most of the
          jump happened in the last two years, and {years[years.length - 1]?.partial ? "this year is running higher still" : "it hasn't reversed since"}.
        </p>
        <p>
          Nothing about permitting rules changed to cause this. What changed is what utilities are asking
          permission to build. Two things are pushing in the same direction at once: a real jump in
          forecasted electricity demand (data centers being the headline driver, but not the only one), and
          the fact that a gas plant can be sited and built on a timeline of a few years &mdash; while wind
          and solar increasingly sit behind years-long interconnection queues in the regions with the worst
          backlogs, and transmission to move that power is its own multi-year fight.
        </p>
        <p>
          Put simply: when a utility needs capacity online soon and can&rsquo;t count on the grid upgrades
          new renewables often require, gas is the option that doesn&rsquo;t make them wait for someone
          else&rsquo;s queue to clear. That&rsquo;s a read on incentives, not something visible in permitting
          data alone &mdash; the filings themselves just show the result.
        </p>
        <p>
          Every gas project behind this chart, with sources, on{" "}
          <Link href="/projects" className="underline text-[var(--accent)]">
            Projects
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
