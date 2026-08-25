import { CAPITAL_COST_USD_PER_KW } from "@/lib/calc/investmentWaiting";
import { FUEL_TYPE_BY_VALUE, TRACKED_PROJECT_STAGES, ZERO_CARBON_FUELS } from "@/lib/data/taxonomies";

export function MethodologyPanel() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Methodology</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          How the numbers on this site are computed, what they assume, and where they&rsquo;re
          deliberately incomplete.
        </p>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Days / years waiting</h2>
        <p className="text-sm">
          <code>today − application/interconnection-request filed date</code>, computed live on
          every page load (not cached), so it&rsquo;s always current. Where a source didn&rsquo;t
          publish an exact filing date, the project is marked{" "}
          <code>dateConfidence: approximate</code> and the underlying date is our best reading of
          public reporting — see each project&rsquo;s &ldquo;data quality note.&rdquo;
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Estimated investment waiting</h2>
        <p className="text-sm mb-3">
          For generation and storage projects with capacity measured in MW and a fuel type with a
          published typical construction cost:
        </p>
        <pre className="text-xs bg-black/5 dark:bg-white/10 rounded-md p-3 overflow-x-auto">
{`estimated investment waiting
  = capacity (MW) × 1,000 (kW/MW)
  × typical overnight construction cost for that technology ($/kW)`}
        </pre>
        <p className="text-sm mt-3">
          This is the estimated dollar value of the power plant itself — the capital investment
          an entrepreneur is ready to put into the ground — sitting in permitting or
          interconnection limbo. It needs only a project&rsquo;s capacity and technology, not a
          filing date, so (unlike an energy-market or bill-savings estimate) it&rsquo;s computable
          for nearly every generation/storage project in the dataset, not just the ones with a
          published application date. It is a construction-cost estimate, not a revenue forecast
          or a bill estimate, and real project costs vary by site, size, and year — this uses a
          single national-average figure per technology, not inflation-adjusted from its source
          year.
        </p>
        <h3 className="text-sm font-semibold mt-4 mb-2">Construction costs used (2021$/kW)</h3>
        <ul className="text-sm grid grid-cols-2 gap-1">
          {Object.entries(CAPITAL_COST_USD_PER_KW).map(([fuel, cost]) => (
            <li key={fuel}>
              {FUEL_TYPE_BY_VALUE[fuel as keyof typeof FUEL_TYPE_BY_VALUE]?.label ?? fuel}:{" "}
              <strong>${cost.toLocaleString("en-US")}/kW</strong>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--muted)] mt-2">
          Source: EIA,{" "}
          <a
            href="https://www.eia.gov/outlooks/aeo/assumptions/pdf/table_8.2.pdf"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            &ldquo;Cost and Performance Characteristics of New Generating Technologies,&rdquo;
            Annual Energy Outlook 2022
          </a>
          , Table 1 (national-average overnight capital costs, 2021 dollars).
        </p>
        <h3 className="text-sm font-semibold mt-4 mb-2">What&rsquo;s NOT estimated, and why</h3>
        <p className="text-sm">
          Transmission, pipeline, and LNG projects are not run through this formula. A
          transmission line&rsquo;s cost is driven by route length and terrain, not a $/kW
          generation-capacity figure, and EIA&rsquo;s table doesn&rsquo;t cover it — we&rsquo;d
          rather show &ldquo;not estimated&rdquo; than invent a proxy we couldn&rsquo;t defend to
          the same standard.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Clean energy capacity waiting</h2>
        <p className="text-sm">
          A simple sum of MW capacity for matching projects using a zero-direct-emission
          technology —{" "}
          {ZERO_CARBON_FUELS.map((f, i) => (
            <span key={f}>
              {i > 0 && ", "}
              {FUEL_TYPE_BY_VALUE[f]?.label ?? f}
            </span>
          ))}
          . It&rsquo;s the same &ldquo;Capacity waiting&rdquo; total, just filtered to the
          zero-carbon subset — not an emissions or generation-value estimate, so it carries none
          of the assumptions those would.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Aggregate headline stats</h2>
        <p className="text-sm">
          Total capacity, total clean energy capacity, and total investment waiting sum only over
          projects in the <em>current filtered set</em> — they update live as you filter. Entries
          flagged <code>isAggregateExample</code> are always excluded from these totals, since
          they&rsquo;d represent a regional statistic (e.g. an entire ISO interconnection queue)
          rather than one physical project and would double-count against individual projects also
          shown. No currently-ingested source produces one of these, but the exclusion stays in
          place for whenever one does.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Fields shown on this site</h2>
        <p className="text-sm mb-3">
          The list view, map, project detail pages, and CSV export all draw from the same
          underlying fields for every project:
        </p>
        <ul className="text-sm grid gap-1.5">
          <li>
            <strong>Project</strong> — name, as published by the source (EIA plant/generator name,
            Permitting Dashboard project title, LBNL entity + queue ID, hydropower project name +
            FERC docket number, or pipeline project name + operator).
          </li>
          <li>
            <strong>Fuel</strong> — technology/fuel type (solar, wind, storage, gas, nuclear, hydro,
            etc.), color-coded to match the map. Inferred from title keywords (not a structured
            field) for Permitting Dashboard-sourced projects — see that source&rsquo;s note below.
          </li>
          <li>
            <strong>Location</strong> — state and county. Most projects are geocoded to an exact
            site; LBNL-sourced projects are placed at their county centroid (see that source&rsquo;s
            note below); a small number of Permitting Dashboard projects with no published
            coordinates, and every pipeline project (which span multiple states with no single
            site), won&rsquo;t appear on the map at all.
          </li>
          <li>
            <strong>Waiting</strong> — years since the published application-filed or
            interconnection-request date; see &ldquo;Days / years waiting&rdquo; above. Shows
            &ldquo;—&rdquo; when no source has published that date for the project.
          </li>
          <li>
            <strong>Capacity</strong> — nameplate MW for generation/storage/transmission, MTPA for
            LNG, or MMcf/d of throughput for pipelines; see each project&rsquo;s &ldquo;data quality
            note&rdquo; when the unit isn&rsquo;t MW.
          </li>
          <li>
            <strong>Stage</strong> — where the project sits in the permitting/interconnection
            process; see &ldquo;Project stage&rdquo; below for what each value means and which
            source can produce it.
          </li>
          <li>
            <strong>Interconnection queue stage</strong> — finer-grained than Stage, and only shown
            for LBNL Queued Up-sourced projects: the grid operator&rsquo;s own study-phase label
            (e.g. &ldquo;Feasibility Study,&rdquo; &ldquo;System Impact Study,&rdquo; &ldquo;Facilities
            Study&rdquo;), carried through rather than collapsed into the shared Stage bucket.
          </li>
          <li>
            <strong>Network upgrade cost</strong> — a preliminary estimate of what it would cost to
            connect a project to the grid, where available. Reserved on the schema but not yet
            populated by any ingestion module — see &ldquo;Data &amp; sourcing&rdquo; below.
          </li>
          <li>
            <strong>Source</strong> — which of the data pipelines below ingested this project.
            Derived from the project&rsquo;s citation link, not a stored field — see &ldquo;Data
            &amp; sourcing&rdquo; below.
          </li>
        </ul>
        <p className="text-sm mt-3">
          Every project also carries a verification status, one or more source links, and (where a
          source published one) a data quality note — all visible on the project&rsquo;s own page,
          even when not shown as a column in the list view. CSV export additionally includes
          project type and cause category slugs, which aren&rsquo;t shown as table columns.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Project stage</h2>
        <p className="text-sm mb-3">
          &ldquo;Stage&rdquo; is a single bucket meant to answer &ldquo;roughly where is this
          project in the process?&rdquo; at a glance. Two of the values below —{" "}
          <strong>Planned, approvals not yet initiated</strong> and{" "}
          <strong>Regulatory approvals pending (Category L)</strong> — map directly to status codes
          EIA-860M itself publishes on every &ldquo;Planned&rdquo; generator: EIA calls these{" "}
          <code>(P)</code> and <code>(L)</code> respectively, and <code>(L)</code> is EIA&rsquo;s
          own &ldquo;Category L&rdquo; — &ldquo;Regulatory approvals pending. Not under
          construction.&rdquo; Every other stage below is a best-effort default assigned from
          whichever source ingested the project — see each source&rsquo;s entry above for what it
          can and can&rsquo;t tell us about a project&rsquo;s real bottleneck.
        </p>
        <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {TRACKED_PROJECT_STAGES.map((s) => (
            <li key={s.value}>
              <strong>{s.label}</strong>
            </li>
          ))}
        </ul>
        <p className="text-sm mt-3 pt-3 border-t border-[var(--border)]">
          The stages above are shown under the <strong>In Permitting</strong> Status filter only —
          the site&rsquo;s default view, and the one this project count/capacity/investment math
          is scoped to. A project whose regulatory approval has already been granted, one
          that&rsquo;s under construction or already complete, or one that was cancelled/withdrawn
          is kept, not deleted — switch Status to <strong>Permits Complete</strong> or{" "}
          <strong>Cancelled / Suspended</strong> to see those. (Before 2026-08-25, this site
          deleted a project once it resolved; that changed so resolved outcomes stay visible
          instead of disappearing.)
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Data &amp; sourcing</h2>
        <p className="text-sm mb-4">
          Every project on this site comes from one of the public data sources below, refreshed on
          an automated schedule (daily for most, weekly for a few — see below) — not a one-off,
          hand-picked list. Each source links out to
          the original public filing or reporting, not just this site&rsquo;s own summary. We
          intentionally stick to sources we can keep current automatically; see the repo&rsquo;s
          README if you&rsquo;re curious why.
        </p>
        <ul className="text-sm flex flex-col gap-3">
          <li>
            <strong>
              <a
                href="https://www.eia.gov/electricity/data/eia860m/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                EIA-860M
              </a>{" "}
              &ldquo;Planned&rdquo; generator inventory.
            </strong>{" "}
            U.S. Energy Information Administration, published monthly. The backbone list of
            proposed U.S. generation and storage capacity — location, capacity, technology, and
            status for every planned generator above a 250 MW capacity floor. We exclude
            generators already reported under construction, since this site tracks projects still
            waiting for approval, not ones that have already cleared that hurdle. EIA&rsquo;s own
            status codes for the rest of the pipeline map directly to this site&rsquo;s stage
            values — see &ldquo;Project stage&rdquo; above, including &ldquo;Category L.&rdquo;
          </li>
          <li>
            <strong>
              <a
                href="https://www.permits.performance.gov/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Federal Permitting Dashboard
              </a>
            </strong>{" "}
            (FAST-41 covered projects). Permitting Council data on major energy generation,
            transmission, storage, and pipeline projects undergoing federal environmental review —
            including which federal agency is in the lead. We exclude projects already marked
            Complete or Cancelled.
          </li>
          <li>
            <strong>
              <a href="https://emp.lbl.gov/queues" target="_blank" rel="noreferrer" className="underline">
                LBNL Queued Up
              </a>
            </strong>{" "}
            (Lawrence Berkeley National Laboratory, in partnership with GridTracker), published
            annually. An interconnection queue dataset aggregated from 50+ grid operators — the
            only source on this site that publishes a real date each project entered the queue,
            which is what most of the &ldquo;time waiting&rdquo; figures on this site are built
            from. We include only requests with an active queue status and at least 250 MW of
            capacity, matching the site-wide capacity floor also used for EIA-860M. A suspended
            interconnection request is treated the same as withdrawn — not shown as
            &ldquo;waiting&rdquo; — and a project that moves to withdrawn, suspended, or already-
            operational status in a later edition is removed the moment that&rsquo;s reported,
            rather than staying frozen in its last-known state. Also the source of this
            site&rsquo;s &ldquo;interconnection queue stage&rdquo; detail (see &ldquo;Fields shown
            on this site&rdquo; above); a separate LBNL dataset with per-project network-upgrade
            cost estimates exists but isn&rsquo;t yet wired in — see the repo README&rsquo;s open
            questions. Licensed{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/deed.en"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              CC BY 4.0
            </a>
            .
          </li>
          <li>
            <strong>
              <a
                href="https://hydrosource.ornl.gov/data/datasets/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                ORNL HydroSource
              </a>
            </strong>{" "}
            hydropower relicensing dataset (Oak Ridge National Laboratory, built from FERC&rsquo;s
            own relicensing docket data), published annually. Every FERC-licensed hydropower
            project currently in relicensing — either an application already pending before FERC,
            or a licensee that has filed its required notice of intent to relicense but not yet the
            full application. Publishes a real per-project filing date and exact coordinates, so
            (like LBNL Queued Up) contributes real &ldquo;time waiting&rdquo; figures. We exclude
            projects whose relicense has already been issued, and license-surrender applications (a
            project leaving FERC&rsquo;s process, not waiting on approval within it). Contributes far
            fewer projects than the other sources: most FERC-licensed hydro projects are small
            municipal or private dams below this site&rsquo;s 250 MW floor.
          </li>
          <li>
            <strong>
              <a
                href="https://www.eia.gov/naturalgas/data.php"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                EIA Natural Gas Pipeline Projects
              </a>
            </strong>{" "}
            tracker, published quarterly. An analyst-maintained list of announced, filed, and
            on-hold interstate and intrastate natural gas pipeline projects — the main source of
            pipeline coverage on this site, broader than the handful of pipeline projects that
            happen to be FAST-41 &ldquo;covered projects&rdquo; on the Permitting Dashboard. No
            capacity floor is applied (this workbook is itself a curated list of major projects,
            not a raw firehose) and capacity is reported in MMcf/d of gas throughput, not MW, so
            it&rsquo;s excluded from this site&rsquo;s MW-based capacity totals. Pipelines span
            multiple states with no single site, so these projects have no map coordinates and
            won&rsquo;t appear on the map, only in the list view. No application-filed date is
            published, so &ldquo;time waiting&rdquo; isn&rsquo;t computable for these projects
            either.
          </li>
        </ul>
        <p className="text-sm mt-4">
          Because EIA-860M, the Permitting Dashboard, and the pipeline tracker don&rsquo;t publish
          an application-filed or queue-entry date, projects sourced only from those three
          won&rsquo;t show a &ldquo;time waiting&rdquo; figure unless LBNL Queued Up or ORNL&rsquo;s
          hydropower relicensing dataset also has a matching entry.
        </p>

        <h3 className="text-sm font-semibold mt-5 mb-2">State PUC/PSC and siting-authority dockets</h3>
        <p className="text-sm mb-3">
          No national aggregator exists for state utility-commission dockets — each state runs its
          own system, and FERC eLibrary only covers the federal side. This site is building
          per-state coverage one confirmed source at a time, each a real, publicly reachable search
          (a JSON API or server-rendered HTML page) rather than a headless-browser scrape or a paid
          API. Every state below tracks a real siting-certificate application (each state&rsquo;s
          own name for the &ldquo;Certificate of Public Convenience and Necessity&rdquo; concept) for
          electric generation, storage, or transmission projects; none publishes a cause for the
          delay, so — like the sources above — these are all tagged with a single, honest cause
          category (&ldquo;local/state review&rdquo;) rather than a guessed reason. See the
          repo&rsquo;s <code>src/lib/ingest/README.md</code> for the specific hard problem each one
          solved (an unreliable status field, a scoping trap, a session/CAPTCHA hurdle, etc.).
        </p>
        <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <li>
            <a href="https://www.scc.virginia.gov/" target="_blank" rel="noreferrer" className="underline">
              Virginia
            </a>{" "}
            — State Corporation Commission
          </li>
          <li>
            <a href="https://interchange.puc.texas.gov/" target="_blank" rel="noreferrer" className="underline">
              Texas
            </a>{" "}
            — Public Utility Commission
          </li>
          <li>
            <a href="https://www.dora.state.co.us/pls/efi/" target="_blank" rel="noreferrer" className="underline">
              Colorado
            </a>{" "}
            — Public Utilities Commission
          </li>
          <li>
            <a href="https://opsb.ohio.gov/" target="_blank" rel="noreferrer" className="underline">
              Ohio
            </a>{" "}
            — Power Siting Board
          </li>
          <li>
            <a href="https://dms.psc.sc.gov/" target="_blank" rel="noreferrer" className="underline">
              South Carolina
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://edocket.azcc.gov/" target="_blank" rel="noreferrer" className="underline">
              Arizona
            </a>{" "}
            — Corporation Commission, Line Siting Committee
          </li>
          <li>
            <a href="https://www.efsec.wa.gov/" target="_blank" rel="noreferrer" className="underline">
              Washington
            </a>{" "}
            — Energy Facility Site Evaluation Council
          </li>
          <li>
            <a href="https://e360.prc.nm.gov/" target="_blank" rel="noreferrer" className="underline">
              New Mexico
            </a>{" "}
            — Public Regulation Commission
          </li>
          <li>
            <a href="https://icc.illinois.gov/" target="_blank" rel="noreferrer" className="underline">
              Illinois
            </a>{" "}
            — Commerce Commission
          </li>
          <li>
            <a href="https://www.floridapsc.com/" target="_blank" rel="noreferrer" className="underline">
              Florida
            </a>{" "}
            — Public Service Commission + DEP Siting Coordination Office
          </li>
          <li>
            <a href="https://documents.dps.ny.gov/" target="_blank" rel="noreferrer" className="underline">
              New York
            </a>{" "}
            — Department of Public Service
          </li>
          <li>
            <a href="https://puc.nv.gov/" target="_blank" rel="noreferrer" className="underline">
              Nevada
            </a>{" "}
            — Public Utilities Commission
          </li>
          <li>
            <a href="https://www.oregon.gov/energy/facilities/" target="_blank" rel="noreferrer" className="underline">
              Oregon
            </a>{" "}
            — Energy Facility Siting Council
          </li>
          <li>
            <a href="https://eeaonline.eea.state.ma.us/dpu/fileroom" target="_blank" rel="noreferrer" className="underline">
              Massachusetts
            </a>{" "}
            — Energy Facilities Siting Board
          </li>
          <li>
            <a href="https://occ.ok.gov/" target="_blank" rel="noreferrer" className="underline">
              Oklahoma
            </a>{" "}
            — Corporation Commission
          </li>
          <li>
            <a href="https://psc.utah.gov/" target="_blank" rel="noreferrer" className="underline">
              Utah
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://psc.wi.gov/" target="_blank" rel="noreferrer" className="underline">
              Wisconsin
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://psc.ky.gov/" target="_blank" rel="noreferrer" className="underline">
              Kentucky
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://psc.mo.gov/" target="_blank" rel="noreferrer" className="underline">
              Missouri
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://iurc.portal.in.gov/" target="_blank" rel="noreferrer" className="underline">
              Indiana
            </a>{" "}
            — Utility Regulatory Commission
          </li>
          <li>
            <a href="https://www.nj.gov/bpu/" target="_blank" rel="noreferrer" className="underline">
              New Jersey
            </a>{" "}
            — Board of Public Utilities
          </li>
          <li>
            <a href="https://www.psc.state.md.us/" target="_blank" rel="noreferrer" className="underline">
              Maryland
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://portal.ct.gov/csc" target="_blank" rel="noreferrer" className="underline">
              Connecticut
            </a>{" "}
            — Siting Council
          </li>
          <li>
            <a href="https://psc.wv.gov/" target="_blank" rel="noreferrer" className="underline">
              West Virginia
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://www.tn.gov/tpuc.html" target="_blank" rel="noreferrer" className="underline">
              Tennessee
            </a>{" "}
            — Public Utility Commission
          </li>
          <li>
            <a href="https://www.energy.ca.gov/" target="_blank" rel="noreferrer" className="underline">
              California
            </a>{" "}
            — Energy Commission
          </li>
          <li>
            <a href="https://www.puc.nh.gov/" target="_blank" rel="noreferrer" className="underline">
              New Hampshire
            </a>{" "}
            — Site Evaluation Committee
          </li>
          <li>
            <a href="https://puc.idaho.gov/" target="_blank" rel="noreferrer" className="underline">
              Idaho
            </a>{" "}
            — Public Utilities Commission
          </li>
          <li>
            <a href="https://powerreview.nebraska.gov/" target="_blank" rel="noreferrer" className="underline">
              Nebraska
            </a>{" "}
            — Power Review Board
          </li>
          <li>
            <a href="https://lpsc.louisiana.gov/" target="_blank" rel="noreferrer" className="underline">
              Louisiana
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://psc.alabama.gov/" target="_blank" rel="noreferrer" className="underline">
              Alabama
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://apps.apsc.arkansas.gov/olsv2/" target="_blank" rel="noreferrer" className="underline">
              Arkansas
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://delafile.delaware.gov" target="_blank" rel="noreferrer" className="underline">
              Delaware
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a
              href="https://www.maine.gov/dep/gis/datamaps/LAWB_Permits/index.html"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Maine
            </a>{" "}
            — Department of Environmental Protection, Land Bureau (Site Law permits)
          </li>
          <li>
            <a href="https://ripuc.ri.gov" target="_blank" rel="noreferrer" className="underline">
              Rhode Island
            </a>{" "}
            — Energy Facility Siting Board
          </li>
          <li>
            <a href="https://epuc.vermont.gov" target="_blank" rel="noreferrer" className="underline">
              Vermont
            </a>{" "}
            — Public Utility Commission
          </li>
          <li>
            <a href="https://puc.sd.gov/Dockets/Electric/" target="_blank" rel="noreferrer" className="underline">
              South Dakota
            </a>{" "}
            — Public Utilities Commission
          </li>
          <li>
            <a href="https://apps.psc.nd.gov/cases/pscasesearch" target="_blank" rel="noreferrer" className="underline">
              North Dakota
            </a>{" "}
            — Public Service Commission
          </li>
          <li>
            <a href="https://starw1.ncuc.gov/NCUC/page/Dockets/portal.aspx" target="_blank" rel="noreferrer" className="underline">
              North Carolina
            </a>{" "}
            — Utilities Commission
          </li>
          <li>
            <a href="https://deq.wyoming.gov/industrial-siting-2/permitting/" target="_blank" rel="noreferrer" className="underline">
              Wyoming
            </a>{" "}
            — DEQ Industrial Siting Council
          </li>
        </ul>
        <p className="text-xs text-[var(--muted)] mt-2">
          Not exactly geocoded: state-docket sources publish a county, not exact coordinates, so
          these projects appear on the map as an approximate, dashed-outline pin centered on their
          county (or, failing that, their state) rather than an exact site — see each project&rsquo;s
          data quality note.
        </p>

        <p className="text-sm mt-4 pt-4 border-t border-[var(--border)]">
          More states are coming — this is an active, ongoing expansion, not a finished list. See
          the repo&rsquo;s README for the full list of open questions, including cross-source
          project identity matching and data source terms of use, flagged rather than silently
          guessed at.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">How current is this data?</h2>
        <p className="text-sm mb-3">
          Every source above runs on an automated job (Vercel Cron) — there is no manual,
          hand-curated data on this site. Cadence is matched to how often each source actually
          publishes: the 40 state PUC/PSC/siting-authority dockets and the Federal Permitting
          Dashboard&rsquo;s live API are checked daily, since same-day filings are exactly what
          the homepage changes feed is built to surface. The four sources whose underlying data
          only republishes monthly, quarterly, or annually (EIA-860M, LBNL Queued Up, ORNL
          HydroSource, EIA&rsquo;s pipeline tracker) stay weekly — checking them more often
          wouldn&rsquo;t catch anything new, just spend invocations for no benefit.
        </p>
        <ul className="text-sm flex flex-col gap-2">
          <li>
            <strong>EIA-860M</strong> — checked weekly at 13:00 UTC. EIA itself republishes
            the &ldquo;Planned&rdquo; workbook monthly, with roughly a two-month publication lag on
            EIA&rsquo;s end; most checks simply find the same file already ingested and no-op.
          </li>
          <li>
            <strong>Federal Permitting Dashboard</strong> — checked daily at 14:00 UTC
            against a live queryable API, not a periodic file, so whatever the Permitting
            Council&rsquo;s data reflects is picked up within a day.
          </li>
          <li>
            <strong>LBNL Queued Up</strong> — checked weekly at 15:00 UTC. LBNL republishes
            this dataset only about once a year; a periodic check costs one cheap page fetch on
            the weeks nothing&rsquo;s changed and still guarantees a new edition is picked up
            quickly after release rather than waiting on a manual download.
          </li>
          <li>
            <strong>ORNL HydroSource hydropower relicensing</strong> — checked weekly at
            16:00 UTC, same rationale as LBNL Queued Up: ORNL republishes this dataset about once
            a year too.
          </li>
          <li>
            <strong>EIA Natural Gas Pipeline Projects tracker</strong> — checked weekly at
            17:00 UTC. EIA republishes this one roughly quarterly; same rationale as the two
            annual sources above.
          </li>
          <li>
            <strong>Virginia SCC</strong> — checked daily at 18:00 UTC.
          </li>
          <li>
            <strong>Texas PUCT</strong> — checked daily at 18:30 UTC.
          </li>
          <li>
            <strong>Colorado PUC</strong> — checked daily at 19:00 UTC.
          </li>
          <li>
            <strong>Ohio Power Siting Board</strong> — checked daily at 19:30 UTC.
          </li>
          <li>
            <strong>South Carolina PSC</strong> — checked daily at 20:00 UTC.
          </li>
          <li>
            <strong>Arizona Corporation Commission</strong> — checked daily at 20:30 UTC.
          </li>
          <li>
            <strong>Washington EFSEC</strong> — checked daily at 21:00 UTC.
          </li>
          <li>
            <strong>New Mexico PRC</strong> — checked daily at 21:30 UTC.
          </li>
          <li>
            <strong>Illinois Commerce Commission</strong> — checked daily at 22:00 UTC.
          </li>
          <li>
            <strong>Florida PSC + DEP</strong> — checked daily at 22:30 UTC.
          </li>
          <li>
            <strong>New York DPS</strong> — checked daily at 23:00 UTC.
          </li>
          <li>
            <strong>Nevada PUCN</strong> — checked daily at 23:30 UTC.
          </li>
          <li>
            <strong>Oregon EFSC</strong> — checked daily at 00:00 UTC.
          </li>
          <li>
            <strong>Massachusetts EFSB</strong> — checked daily at 00:30 UTC.
          </li>
          <li>
            <strong>Oklahoma OCC</strong> — checked daily at 01:00 UTC.
          </li>
          <li>
            <strong>Utah PSC</strong> — checked daily at 01:30 UTC.
          </li>
          <li>
            <strong>Wisconsin PSC</strong> — checked daily at 02:00 UTC.
          </li>
          <li>
            <strong>Kentucky PSC</strong> — checked daily at 02:30 UTC.
          </li>
          <li>
            <strong>Missouri PSC</strong> — checked daily at 03:00 UTC.
          </li>
          <li>
            <strong>Indiana IURC</strong> — checked daily at 03:30 UTC.
          </li>
          <li>
            <strong>New Jersey BPU</strong> — checked daily at 04:00 UTC.
          </li>
          <li>
            <strong>Maryland PSC</strong> — checked daily at 04:30 UTC.
          </li>
          <li>
            <strong>Connecticut CSC</strong> — checked daily at 05:00 UTC.
          </li>
          <li>
            <strong>West Virginia PSC</strong> — checked daily at 05:30 UTC.
          </li>
          <li>
            <strong>Tennessee TPUC</strong> — checked daily at 06:00 UTC.
          </li>
          <li>
            <strong>California CEC</strong> — checked daily at 06:30 UTC.
          </li>
          <li>
            <strong>New Hampshire SEC</strong> — checked daily at 07:00 UTC.
          </li>
          <li>
            <strong>Idaho PUC</strong> — checked daily at 07:30 UTC.
          </li>
          <li>
            <strong>Nebraska PRB</strong> — checked daily at 08:00 UTC.
          </li>
          <li>
            <strong>Louisiana PSC</strong> — checked daily at 08:30 UTC.
          </li>
          <li>
            <strong>Alabama PSC</strong> — checked daily at 09:00 UTC.
          </li>
          <li>
            <strong>Arkansas PSC</strong> — checked daily at 09:30 UTC.
          </li>
          <li>
            <strong>Delaware PSC</strong> — checked daily at 10:00 UTC.
          </li>
          <li>
            <strong>Maine DEP</strong> — checked daily at 10:30 UTC.
          </li>
          <li>
            <strong>Rhode Island EFSB</strong> — checked daily at 11:00 UTC.
          </li>
          <li>
            <strong>Vermont PUC</strong> — checked daily at 11:30 UTC.
          </li>
          <li>
            <strong>South Dakota PUC</strong> — checked daily at 12:00 UTC.
          </li>
          <li>
            <strong>North Dakota PSC</strong> — checked daily at 12:30 UTC.
          </li>
          <li>
            <strong>North Carolina Utilities Commission</strong> — checked daily at 13:30 UTC.
          </li>
          <li>
            <strong>Wyoming DEQ Industrial Siting Council</strong> — checked daily at 14:30 UTC.
          </li>
        </ul>
        <p className="text-sm mt-3">
          Forty-one sources run daily, every source staggered 30 minutes apart across the
          clock (13:00 UTC through 12:30 UTC the next day) so no two ingestion runs overlap; the
          four monthly/quarterly/annual sources above run on the same staggered schedule but only
          once a week. Every ingestion run upserts by a stable per-source
          identity, so re-running a source (on schedule or by hand) updates existing projects in
          place rather than duplicating them — including across two different sources that track
          the same physical project once a human has confirmed it and declared a shared identity
          (see the repo README&rsquo;s open question on cross-source identity matching).
          &ldquo;Days / years waiting&rdquo; figures are computed live on every page load from the
          stored filing date, not cached, so they&rsquo;re accurate to the minute even between
          ingestion runs.
        </p>
      </section>
    </div>
  );
}
