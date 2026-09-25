import Link from "next/link";
import { getDirtiestProjects } from "@/lib/dirtiestProjects";
import { DirtiestProjectsChart, type ChartEntry } from "@/components/blog/DirtiestProjectsChart";

export async function DirtiestProjectsMethodology() {
  const entries = await getDirtiestProjects();
  const chartEntries: ChartEntry[] = entries
    .filter((e) => e.project.capacityValue != null)
    .sort((a, b) => (b.project.capacityValue ?? 0) - (a.project.capacityValue ?? 0))
    .map((e) => ({
      name: e.project.name,
      value: e.project.capacityValue!,
      unit: e.project.capacityUnit ?? "",
      category: e.category,
    }));

  return (
    <div className="flex flex-col gap-5">
      {chartEntries.length > 0 && <DirtiestProjectsChart entries={chartEntries} />}

      <div className="text-sm leading-relaxed flex flex-col gap-3">
        <p>
          We added a{" "}
          <Link href="/dirtiest" className="underline text-[var(--accent)]">
            Dirtiest Projects
          </Link>{" "}
          list for advocates who want to focus their opposition somewhere specific instead of the whole permitting
          pipeline at once. Here&rsquo;s exactly how we picked it, because a list like this is only useful if you
          can trust where it came from.
        </p>
        <p>
          This tracker doesn&rsquo;t have an emissions or CO&#8322; figure for any project &mdash; no public source
          publishes one at the docket level, and we&rsquo;d rather say that plainly than fabricate a number that
          looks precise but isn&rsquo;t. So &ldquo;dirtiest&rdquo; here means the largest fossil-fuel infrastructure
          by capacity: gas-fired power plants ranked by megawatts, and interstate gas pipelines ranked by MMcf/d of
          throughput. Two different units that don&rsquo;t convert cleanly into one number, which is why the chart
          above keeps them as two groups instead of one merged ranking.
        </p>
        <p>
          We also cut anything still at the earliest &ldquo;interconnection study&rdquo; stage. Most gas capacity in
          our dataset sits there &mdash; big numbers, but no real permit application exists yet, so there&rsquo;s
          nothing for a member of the public to actually act on. A project only made the list once it had reached a
          real, named docket: agency permitting, local/state review, litigation, or a filed application awaiting
          approval.
        </p>
        <p>
          That left a shortlist ranked by size. We didn&rsquo;t stop there &mdash; every candidate got checked by
          hand against real, current reporting before publishing. Three algorithmically-large pipelines got dropped
          entirely during that check: one had been withdrawn from federal review, one had been suspended and
          reconfigured as a different (intrastate) project after landowner opposition, and one still has no final
          investment decision. Being large isn&rsquo;t enough to make this list; being real and currently active is
          the bar.
        </p>
        <p>
          The result is 13 projects, not a mega-list of everything &mdash; a handful of the largest, most real,
          most currently-pending fossil-fuel projects in the country, each linked to its own tracker page with the
          docket, regulator contacts, and hearing dates. Where we found documented, cited opposition to a specific
          project, we said so; where we didn&rsquo;t find anything beyond its size, we said that too, instead of
          inventing a reason.
        </p>
        <p>
          We&rsquo;ll re-check this list periodically the same way &mdash; a project drops off once it&rsquo;s
          approved, cancelled, or no longer being reported, same as everything else on this site.
        </p>
      </div>
    </div>
  );
}
