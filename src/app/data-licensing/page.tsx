import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data licensing — WaitingForPower",
  description: "Per-source redistribution terms for the government and public datasets this site ingests — researched directly from each source, not assumed.",
  alternates: { canonical: "/data-licensing" },
};

export default function DataLicensingPage() {
  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data licensing</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            This site&rsquo;s own code and commentary are original. Every tracked project links back
            to its public source, but the underlying source data carries its own terms — researched
            per source below rather than assumed, since &ldquo;it&rsquo;s a .gov site&rdquo; doesn&rsquo;t
            settle it on its own. Redistributing a small number of individual figures with attribution
            (as this site itself does) is on far safer ground than redistributing a source&rsquo;s
            bulk data wholesale — check the source directly before doing the latter at scale.
          </p>
        </div>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold mb-2">The 40-state docket sources, EIA-860M, EIA&rsquo;s pipeline tracker, and the Federal Permitting Dashboard</h2>
          <p className="text-sm">
            All public domain. Each is a work of the U.S. federal government or a state government
            agency published in the ordinary course of its regulatory function — EIA and the
            Permitting Dashboard (data.permits.performance.gov, a Socrata-hosted FAST-41 dataset
            whose own license field is explicitly marked &ldquo;Public Domain&rdquo;) are federal works
            under 17 U.S.C. §105; the state PUC/PSC/siting-board docket systems are public
            regulatory records published by state agencies for public consumption. EIA-860M and the
            pipeline tracker are fetched here as EIA&rsquo;s own published Excel workbooks (eia.gov),
            not via EIA&rsquo;s separate keyed API — that API has its own Terms of Service (requiring
            registration and attribution), but this project doesn&rsquo;t use it, so those terms don&rsquo;t apply here.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold mb-2">ORNL HydroSource (hydropower relicensing)</h2>
          <p className="text-sm">
            HydroSource&rsquo;s own Data Use Policy states data is &ldquo;openly shared, without
            restriction, in accordance with Department of Energy&rsquo;s Public Access Plan,&rdquo; and
            asks that a bibliographic citation (authors, title, publisher, DOI) be included in any
            publication using it. Unrestricted use with requested attribution — this site cites its
            source link per project, matching that ask, but doesn&rsquo;t reproduce ORNL&rsquo;s formal
            citation block verbatim; do that yourself if citing HydroSource data directly in your
            own work.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold mb-2">LBNL Queued Up (interconnection queue data)</h2>
          <p className="text-sm mb-2">
            Reported (via indexed page content — LBNL&rsquo;s own site returned an automated-request
            block on a direct re-fetch while researching this page, so treat this as
            reported-not-independently-refetched, not a first-hand read) as licensed CC BY 4.0,
            requiring attribution to Lawrence Berkeley National Laboratory and GridTracker.
          </p>
          <p className="text-sm">
            If that holds up, CC BY 4.0 permits sharing and adapting the dataset, including
            commercially, with attribution — the least restrictive real license found among this
            site&rsquo;s sources. Confirm directly against LBNL&rsquo;s own current publication page
            before redistributing this data in bulk rather than relying on this summary alone.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold mb-2">Still open</h2>
          <p className="text-sm">
            This page reflects real research, not a legal opinion, and per-source terms can change.
            If you plan to redistribute this site&rsquo;s underlying data at real scale — rather than
            citing individual figures with attribution, which every source above clearly permits —
            confirm current terms directly with the source first.
          </p>
        </section>
      </div>
    </div>
  );
}
