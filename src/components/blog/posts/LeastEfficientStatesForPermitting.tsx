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
          We ranked every state with at least 8 tracked projects ({ranked.length} of 50, plus DC)
          by the <strong>median number of years a project is currently waiting</strong> &mdash;
          the most literal read of permit speed we have. Right now{" "}
          {fastest.map((r) => r.name).join(", ")} move fastest; {slowest.map((r) => r.name).join(", ")}{" "}
          are slowest.
        </p>
        <p>
          Two caveats: mid-pack states are close enough that small gaps aren&rsquo;t meaningful,
          and a state whose data source is new will look artificially fast until it accumulates
          history. {excludedCodes.length} states ({excludedCodes.join(", ")}) don&rsquo;t have
          enough data to rank yet. Full{" "}
          <a href="/methodology" className="underline text-[var(--accent)]">
            methodology
          </a>{" "}
          and every project on{" "}
          <a href="/projects" className="underline text-[var(--accent)]">
            Projects
          </a>
          .
        </p>
      </div>
    </div>
  );
}
