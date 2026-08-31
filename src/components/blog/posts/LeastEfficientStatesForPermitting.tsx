import { computeStateEfficiencyRanking } from "@/lib/stateEfficiency";
import { UsStateMap } from "@/components/blog/UsStateMap";

// Computed live at request time, not a frozen snapshot — see
// computeStateEfficiencyRanking's own header for why (source coverage,
// sample-size threshold). The commentary below reflects what the ranking
// looked like at publish time; the map itself always reflects current data.
export async function LeastEfficientStatesForPermitting() {
  const { ranked, excludedCodes } = await computeStateEfficiencyRanking();
  const fastest = ranked.slice(0, 3);
  const slowest = ranked.slice(-3).reverse();

  return (
    <div className="flex flex-col gap-5">
      <UsStateMap ranked={ranked} />

      <div className="text-sm leading-relaxed flex flex-col gap-3">
        <p>
          Every project in this dataset carries a real filing date, so we can ask a direct
          question with real numbers: once a state gets an energy project application, how long
          does it actually sit before a decision?
        </p>
        <p>
          We ranked every state with at least 8 tracked projects ({ranked.length} of 50, plus DC)
          by the <strong>median number of years a project is currently waiting</strong> &mdash;
          the most literal read of permit speed available, and the metric least distorted by how
          much history any one state&rsquo;s data source happens to expose. Right now{" "}
          {fastest.map((r) => r.name).join(", ")} move fastest; {slowest.map((r) => r.name).join(", ")}{" "}
          are slowest.
        </p>
        <p>
          Two honest caveats. First, states in the middle of the pack are close enough that small
          gaps shouldn&rsquo;t be read as meaningfully different rankings. Second, a state whose
          data source has only been tracked for a few weeks will look artificially fast simply
          because nothing old has had time to accumulate yet &mdash; we&rsquo;ll revisit this once
          every source has a few months of real history behind it. {excludedCodes.length} states
          ({excludedCodes.join(", ")}) don&rsquo;t have enough tracked projects yet to rank at all.
        </p>
        <p>
          Full data and per-project detail is browsable on the{" "}
          <a href="/projects" className="underline text-[var(--accent)]">
            Projects
          </a>{" "}
          page; see{" "}
          <a href="/methodology" className="underline text-[var(--accent)]">
            methodology
          </a>{" "}
          for how every figure on this site is computed.
        </p>
      </div>
    </div>
  );
}
