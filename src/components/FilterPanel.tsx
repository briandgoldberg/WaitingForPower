"use client";

import { useMemo } from "react";
import { FUEL_TYPES, PROJECT_TYPES, STATUS_BUCKETS, TRACKED_PROJECT_STAGES } from "@/lib/data/taxonomies";
import { SOURCE_OPTIONS } from "@/lib/filters";
import type { FilterState, SourceKey } from "@/lib/filters";
import type { FuelType, ProjectStage, ProjectType, StatusBucket } from "@/lib/data/taxonomies";
import { splitStateCodes, stateName } from "@/lib/data/usStates";
import type { ProjectDTO } from "@/lib/types";
import { HelpTooltip } from "@/components/HelpTooltip";

// One explanation per Status bucket — surfaced as a single tooltip next to
// the Status select so the (non-obvious) meaning of each option is
// available before switching, not just after. "No Longer Being Reported"
// specifically needs the caveat that it only ever applies to a project
// that was previously In Permitting — an already-resolved project
// dropping out of a source's active search is normal and doesn't trigger
// this bucket (see Project.noLongerReported in schema.prisma).
const STATUS_BUCKET_HELP: Record<StatusBucket, string> = {
  in_permitting: "Still waiting on a permitting decision. The default view.",
  cancelled_suspended: "Denied, withdrawn, or otherwise cancelled.",
  permits_complete: "Permitting is done: approved, under construction, or complete.",
  no_longer_reported: "Was previously In Permitting, but its source stopped listing it as active. We don't know why. Never applies to an already-resolved project.",
};

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] py-2 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
        active
          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
          : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {color && (
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
  );
}

export function FilterPanel({
  filters,
  onChange,
  projects,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  projects: ProjectDTO[];
}) {
  const stateOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const p of projects) {
      for (const code of splitStateCodes(p.state)) codes.add(code);
    }
    return Array.from(codes)
      .map((code) => ({ value: code, label: stateName(code) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [projects]);

  // Free text from the source, not a fixed taxonomy — see queueStages'
  // comment in src/lib/filters.ts. Built from whatever's actually present,
  // same as stateOptions above.
  const queueStageOptions = useMemo(() => {
    const stages = new Set<string>();
    for (const p of projects) {
      if (p.interconnectionQueueStage) stages.add(p.interconnectionQueueStage);
    }
    return Array.from(stages).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <Section title="Status">
        <div className="flex items-center gap-1 mb-1.5">
          <HelpTooltip label="Status">
            <ul className="flex flex-col gap-2">
              {STATUS_BUCKETS.map((s) => (
                <li key={s.value}>
                  <strong>{s.label}</strong> — {STATUS_BUCKET_HELP[s.value]}
                </li>
              ))}
            </ul>
          </HelpTooltip>
        </div>
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as FilterState["status"] })}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-sm"
        >
          {STATUS_BUCKETS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Section>

      <Section title="State">
        <select
          value={filters.state ?? ""}
          onChange={(e) => onChange({ ...filters, state: e.target.value || null })}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-sm"
        >
          <option value="">All states</option>
          {stateOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Length of delay">
        <div className="flex flex-wrap gap-1">
          {[1, 3, 5].map((n) => (
            <Pill
              key={n}
              active={filters.minYearsWaiting === n}
              onClick={() =>
                onChange({
                  ...filters,
                  minYearsWaiting: filters.minYearsWaiting === n ? null : n,
                })
              }
            >
              {n}+ years
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Project type">
        <div className="flex flex-wrap gap-1">
          {PROJECT_TYPES.map((t) => (
            <Pill
              key={t.value}
              active={filters.projectTypes.includes(t.value)}
              onClick={() =>
                onChange({ ...filters, projectTypes: toggle<ProjectType>(filters.projectTypes, t.value) })
              }
            >
              {t.label}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Fuel / technology">
        <div className="flex flex-wrap gap-1">
          {FUEL_TYPES.map((f) => (
            <Pill
              key={f.value}
              active={filters.fuelTypes.includes(f.value)}
              color={f.color}
              onClick={() => onChange({ ...filters, fuelTypes: toggle<FuelType>(filters.fuelTypes, f.value) })}
            >
              {f.label}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Capacity">
        <div className="flex flex-wrap gap-1">
          {[500, 1000, 2000].map((n) => (
            <Pill
              key={n}
              active={filters.minCapacity === n}
              onClick={() =>
                onChange({
                  ...filters,
                  minCapacity: filters.minCapacity === n ? null : n,
                })
              }
            >
              {n.toLocaleString("en-US")}+ MW
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Stage">
        <div className="flex flex-wrap gap-1">
          {TRACKED_PROJECT_STAGES.map((s) => (
            <Pill
              key={s.value}
              active={filters.stages.includes(s.value)}
              onClick={() => onChange({ ...filters, stages: toggle<ProjectStage>(filters.stages, s.value) })}
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </Section>

      {queueStageOptions.length > 0 && (
        <Section title="Interconnection queue stage">
          <div className="flex flex-wrap gap-1">
            {queueStageOptions.map((qs) => (
              <Pill
                key={qs}
                active={filters.queueStages.includes(qs)}
                onClick={() => onChange({ ...filters, queueStages: toggle<string>(filters.queueStages, qs) })}
              >
                {qs}
              </Pill>
            ))}
          </div>
        </Section>
      )}

      <Section title="Data source">
        <div className="flex flex-wrap gap-1">
          {SOURCE_OPTIONS.map((s) => (
            <Pill
              key={s.value}
              active={filters.sourceKeys.includes(s.value)}
              onClick={() =>
                onChange({ ...filters, sourceKeys: toggle<SourceKey>(filters.sourceKeys, s.value) })
              }
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </Section>
    </div>
  );
}
