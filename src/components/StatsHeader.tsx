"use client";

import Link from "next/link";
import type { AggregateStats, ProjectDTO } from "@/lib/types";
import { STATUS_BUCKETS, type StatusBucket } from "@/lib/data/taxonomies";
import { formatUsd } from "@/lib/calc/investmentWaiting";
import { HelpTooltip } from "@/components/HelpTooltip";

function ExampleNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 pt-2 border-t border-[var(--border)] text-[var(--muted)]">{children}</p>;
}

// Every stat this component normally shows answers "how much is waiting" —
// MW, dollars, project count. That question doesn't apply once the Status
// filter is set to Cancelled/Suspended or Permits Complete: those projects
// aren't waiting on anything anymore, so a 4-tile "waiting" grid full of
// resolved-project totals (or worse, N/A placeholders in every tile) would
// be actively misleading. This renders a single, differently-framed card
// instead — just the real project count for that status, no capacity/
// investment figures at all.
function ResolvedStatusCard({ stats, status }: { stats: AggregateStats; status: StatusBucket }) {
  const label = STATUS_BUCKETS.find((s) => s.value === status)?.label ?? status;
  const explanation =
    status === "no_longer_reported"
      ? "These projects were still waiting on a decision when their source stopped listing them as active — we don't know if they resolved quietly or the source just stopped surfacing them. Capacity and investment “waiting” figures don't apply here since we can't confirm they're still real waits."
      : "These projects are no longer waiting on a decision, so capacity and investment “waiting” figures don't apply here.";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-lg font-bold">{stats.totalProjects.toLocaleString("en-US")}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5">{label} projects</div>
      <p className="text-[11px] text-[var(--muted)] mt-2">
        {explanation} Switch to <span className="font-medium">In Permitting</span> for those stats.
      </p>
    </div>
  );
}

export function StatsHeader({
  stats,
  exampleProject,
  status,
}: {
  stats: AggregateStats;
  exampleProject: ProjectDTO | null;
  status: StatusBucket;
}) {
  const ex = exampleProject;

  if (status !== "in_permitting") {
    return <ResolvedStatusCard stats={stats} status={status} />;
  }

  const items = [
    {
      label: "Projects",
      value: stats.totalProjects.toLocaleString("en-US"),
      help: (
        <>
          <p>
            Every project matching your current filters, held to a 250 MW utility-scale floor.
            Regional-aggregate entries (e.g. a statewide stat standing in for many projects) are
            excluded to avoid double-counting; projects missing a published capacity are still
            counted.
          </p>
          {ex && (
            <ExampleNote>
              E.g. <strong>{ex.name}</strong> ({ex.state ?? "location n/a"}) is one of the{" "}
              {stats.totalProjects} counted right now.
            </ExampleNote>
          )}
        </>
      ),
    },
    {
      label: "Capacity waiting",
      value: `${Math.round(stats.totalCapacityMw).toLocaleString("en-US")} MW`,
      help: (
        <>
          <p>
            Sums the MW capacity of every matching project. Projects whose capacity is measured in
            a different unit (LNG&rsquo;s MTPA, a pipeline&rsquo;s length/diameter) aren&rsquo;t
            included in this MW total.
          </p>
          {ex && ex.capacityUnit === "MW" && ex.capacityValue != null && (
            <ExampleNote>
              E.g. <strong>{ex.name}</strong> alone contributes{" "}
              {Math.round(ex.capacityValue).toLocaleString("en-US")} MW of the{" "}
              {Math.round(stats.totalCapacityMw).toLocaleString("en-US")} MW total.
            </ExampleNote>
          )}
        </>
      ),
    },
    {
      label: "Clean energy capacity waiting",
      value: `${Math.round(stats.totalCleanCapacityMw).toLocaleString("en-US")} MW`,
      note: `${stats.cleanCapacityProjectCount}/${stats.totalProjects} projects are zero-carbon generation`,
      help: (
        <>
          <p>
            Sums the MW capacity of matching projects using a zero-direct-emission technology —
            solar, wind, nuclear, hydro, or geothermal. A subset of &ldquo;Capacity waiting&rdquo;
            above, broken out on its own since it&rsquo;s the clean-energy-specific slice of what&rsquo;s
            stuck.
          </p>
          {ex && ["solar", "wind_onshore", "wind_offshore", "nuclear", "hydro", "geothermal"].includes(ex.fuelType) &&
            ex.capacityUnit === "MW" &&
            ex.capacityValue != null && (
              <ExampleNote>
                E.g. <strong>{ex.name}</strong> ({ex.fuelType.replace(/_/g, " ")}) contributes{" "}
                {Math.round(ex.capacityValue).toLocaleString("en-US")} MW of the{" "}
                {Math.round(stats.totalCleanCapacityMw).toLocaleString("en-US")} MW clean total.
              </ExampleNote>
            )}
        </>
      ),
    },
    {
      label: "Est. investment waiting",
      value: formatUsd(stats.totalInvestmentWaitingUsd),
      note: `${stats.investmentWaitingCoverageCount}/${stats.totalProjects} projects have an applicable estimate`,
      help: (
        <>
          <p>
            For generation/storage projects: capacity (MW) × 1,000 (kW/MW) × the typical overnight
            construction cost for that technology (EIA, 2021$/kW). The dollar value of the power
            plant itself sitting in permitting limbo — not a bill estimate, and not
            inflation-adjusted from EIA&rsquo;s 2021 figures.
          </p>
          {ex && ex.investmentWaiting.applicable && (
            <ExampleNote>
              E.g. <strong>{ex.name}</strong>: {Math.round(ex.capacityValue ?? 0).toLocaleString("en-US")}{" "}
              MW × 1,000 × ${ex.investmentWaiting.costPerKw?.toLocaleString("en-US")}/kW ≈{" "}
              {formatUsd(ex.investmentWaiting.estimatedUsd ?? 0)} of investment waiting.
            </ExampleNote>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2">
          <div className="text-lg font-bold">{item.value}</div>
          <div className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1">
            {item.label}
            <HelpTooltip label={item.label}>{item.help}</HelpTooltip>
          </div>
          {item.note && <div className="text-[10px] text-[var(--muted)] mt-0.5">{item.note}</div>}
        </div>
      ))}
      <div className="col-span-2 sm:col-span-4 text-[11px] text-[var(--muted)]">
        Stats update live as you filter below. Clean energy capacity and investment waiting are
        documented estimates, not precise figures —{" "}
        <Link href="/methodology" className="underline">
          see methodology
        </Link>
        .
      </div>
    </div>
  );
}
