"use client";

import Link from "next/link";
import type { AggregateStats, ProjectDTO } from "@/lib/types";
import { STATUS_BUCKETS, type StatusBucket } from "@/lib/data/taxonomies";
import { formatUsd } from "@/lib/calc/investmentWaiting";
import { formatHomes, homesPowered } from "@/lib/calc/homesPowered";
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

// Tile tints and visuals. Each tile's hue marks what it measures (homes =
// amber, clean energy = green, money = violet); text stays in the page's own
// ink colors so it reads the same in light and dark mode.
const TONES = {
  neutral: "border-[var(--border)] bg-[var(--panel)]",
  blue: "border-blue-300/70 dark:border-blue-700/60 bg-gradient-to-br from-blue-50 to-[var(--panel)] dark:from-blue-950/40",
  amber: "border-amber-300/70 dark:border-amber-700/60 bg-gradient-to-br from-amber-50 to-[var(--panel)] dark:from-amber-950/40",
  green: "border-emerald-300/70 dark:border-emerald-700/60 bg-gradient-to-br from-emerald-50 to-[var(--panel)] dark:from-emerald-950/40",
  violet: "border-violet-300/70 dark:border-violet-700/60 bg-gradient-to-br from-violet-50 to-[var(--panel)] dark:from-violet-950/40",
} as const;

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 text-amber-500 dark:text-amber-400">
      <path d="M12 3 2.5 11h2.5v9h5.5v-5.5h3V20H19v-9h2.5z" fill="currentColor" />
      <rect x="15.5" y="4.5" width="2.2" height="4" rx="0.4" fill="currentColor" />
      <path d="M12 7.2 7 11.4v6.6h1.5V13h7v5H17v-6.6z" className="fill-amber-100 dark:fill-amber-900/60" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 text-blue-500 dark:text-blue-400">
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
      <circle cx="12" cy="12" r="10" className="fill-violet-500 dark:fill-violet-400" />
      <circle cx="12" cy="12" r="7.6" fill="none" strokeWidth="1" className="stroke-violet-200 dark:stroke-violet-800" />
      <text x="12" y="16.4" textAnchor="middle" fontSize="12.5" fontWeight="700" className="fill-white dark:fill-violet-950">
        $
      </text>
    </svg>
  );
}

// Share of waiting MW that is zero-carbon generation, as a ring.
function CleanDonut({ pct }: { pct: number }) {
  const r = 15.9155; // circumference 100, so the dash length is the percent
  const shown = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 36 36" role="img" aria-label={`${Math.round(shown)}% clean energy`} className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="5" className="stroke-emerald-100 dark:stroke-emerald-950" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap={shown > 0 && shown < 100 ? "round" : "butt"}
        strokeDasharray={`${shown} ${100 - shown}`}
        className="stroke-emerald-500 dark:stroke-emerald-400"
      />
    </svg>
  );
}

// "64 million" / "850,000": the homes tile's headline without the "≈ … homes".
function homesHeadline(homes: number): string {
  return formatHomes(homes).replace(/^≈ /, "").replace(/ homes$/, "");
}

export function StatsHeader({
  stats,
  exampleProject,
  status,
  opposition,
}: {
  stats: AggregateStats;
  exampleProject: ProjectDTO | null;
  status: StatusBucket;
  // Shown as a link under the Projects tile's count, e.g. on a state page.
  // Omitted (not just zero) wherever there's no opposition scope to link to.
  opposition?: { count: number; href: string };
}) {
  const ex = exampleProject;

  if (status !== "in_permitting") {
    return <ResolvedStatusCard stats={stats} status={status} />;
  }

  // Share of generating MW (storage and transmission don't generate).
  const cleanPct = stats.generationCapacityMw > 0 ? (stats.totalCleanCapacityMw / stats.generationCapacityMw) * 100 : 0;

  const items = [
    {
      label: "Projects",
      tone: "blue" as const,
      visual: <PowerIcon />,
      value: stats.totalProjects.toLocaleString("en-US"),
      sub: opposition && opposition.count > 0 && (
        <Link href={opposition.href} className="underline text-[var(--accent)]">
          {opposition.count} with opposition →
        </Link>
      ),
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
      label: "Homes it could power",
      tone: "amber" as const,
      visual: <HouseIcon />,
      value: stats.homesPowered > 0 ? homesHeadline(stats.homesPowered) : "—",
      sub: `from ${Math.round(stats.generationCapacityMw).toLocaleString("en-US")} MW of generation`,
      help: (
        <>
          <p>
            MW of generation: sums the MW of every matching project that generates power (solar, wind,
            gas, nuclear, hydro, geothermal). Battery storage only shifts power and transmission only
            moves it, so they&rsquo;re left out here; counting everything, including storage,{" "}
            {Math.round(stats.totalCapacityMw).toLocaleString("en-US")} MW is waiting. LNG and
            pipelines aren&rsquo;t measured in MW.
          </p>
          <p className="mt-2">
            Homes: each generating project&rsquo;s MW &times; its fuel&rsquo;s typical U.S. capacity
            factor (EIA; e.g. solar 23%, onshore wind 33%, gas 45%, nuclear 93%) &times; 8,760 hours,
            divided by an average home&rsquo;s 10,791 kWh a year (EIA).
          </p>
          {ex && ex.capacityUnit === "MW" && ex.capacityValue != null && homesPowered(ex.fuelType, ex.capacityValue, ex.capacityUnit) != null && (
            <ExampleNote>
              E.g. <strong>{ex.name}</strong> alone contributes{" "}
              {Math.round(ex.capacityValue).toLocaleString("en-US")} MW of the{" "}
              {Math.round(stats.generationCapacityMw).toLocaleString("en-US")} MW of generation
              {(() => {
                const h = homesPowered(ex.fuelType, ex.capacityValue, ex.capacityUnit);
                return h != null ? <>, enough for {formatHomes(h).replace("≈ ", "about ")}</> : null;
              })()}
              .
            </ExampleNote>
          )}
        </>
      ),
    },
    {
      label: "Clean energy",
      tone: "green" as const,
      visual: <CleanDonut pct={cleanPct} />,
      value: `${Math.round(cleanPct)}%`,
      sub: `${Math.round(stats.totalCleanCapacityMw).toLocaleString("en-US")} MW clean`,
      note: `${stats.cleanCapacityProjectCount}/${stats.totalProjects} projects are zero-carbon generation`,
      help: (
        <>
          <p>
            The share of generating MW waiting that is clean (storage and transmission aren&rsquo;t generation, so they&rsquo;re left out). Sums the MW capacity of matching projects using a zero-direct-emission technology —
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
      label: "Investment on hold",
      tone: "violet" as const,
      visual: <CoinIcon />,
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {items.map((item) => (
        <div key={item.label} className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between min-w-0 ${TONES[item.tone]}`}>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {"visual" in item && item.visual}
            <div className="min-w-0">
              <div className="text-lg sm:text-2xl font-bold leading-tight tracking-tight truncate">{item.value}</div>
              {"sub" in item && item.sub && <div className="text-[11px] sm:text-xs text-[var(--text-secondary)] leading-snug">{item.sub}</div>}
            </div>
          </div>
          <div className="text-xs font-medium text-[var(--muted)] mt-1.5 flex items-center gap-1">
            {item.label}
            <HelpTooltip label={item.label}>{item.help}</HelpTooltip>
          </div>
          {"note" in item && item.note && <div className="hidden sm:block text-[10px] text-[var(--muted)] mt-0.5">{item.note}</div>}
        </div>
      ))}
      <div className="col-span-2 lg:col-span-4 text-[11px] text-[var(--muted)]">
        Documented estimates, not precise figures.{" "}
        <Link href="/methodology" className="underline">
          See methodology
        </Link>
        .
      </div>
    </div>
  );
}
