"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectDTO } from "@/lib/types";
import { FUEL_TYPE_BY_VALUE, formatCapacity, PROJECT_STAGE_BY_VALUE } from "@/lib/data/taxonomies";
import { SOURCE_OPTIONS, sourceKeyForProject } from "@/lib/filters";

type SortKey = "name" | "fuel" | "location" | "daysWaiting" | "capacity" | "stage" | "queueStage";
type SortDir = "asc" | "desc";

function sourceLabel(p: ProjectDTO): string {
  return SOURCE_OPTIONS.find((o) => o.value === sourceKeyForProject(p))?.label ?? "Other";
}

function exportCsv(projects: ProjectDTO[]) {
  const header = [
    "name",
    "project_type",
    "fuel_type",
    "state",
    "county",
    "capacity_value",
    "capacity_unit",
    "days_waiting",
    "current_stage",
    "interconnection_queue_stage",
    "network_upgrade_cost_usd",
    "cause_slugs",
    "verification_status",
    "data_source",
  ];
  const rows = projects.map((p) => [
    p.name,
    p.projectType,
    p.fuelType,
    p.state ?? "",
    p.county ?? "",
    p.capacityValue ?? "",
    p.capacityUnit ?? "",
    p.daysWaiting ?? "",
    p.currentStage,
    p.interconnectionQueueStage ?? "",
    p.networkUpgradeCostUsd ?? "",
    p.causeSlugs.join("|"),
    p.verificationStatus,
    sourceLabel(p),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "waiting-projects.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ProjectList({ projects }: { projects: ProjectDTO[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("daysWaiting");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...projects].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "fuel":
        cmp = (FUEL_TYPE_BY_VALUE[a.fuelType]?.label ?? a.fuelType).localeCompare(
          FUEL_TYPE_BY_VALUE[b.fuelType]?.label ?? b.fuelType,
        );
        break;
      case "location":
        cmp = (a.state ?? "").localeCompare(b.state ?? "");
        break;
      case "daysWaiting":
        cmp = (a.daysWaiting ?? -1) - (b.daysWaiting ?? -1);
        break;
      case "capacity":
        cmp = (a.capacityValue ?? -1) - (b.capacityValue ?? -1);
        break;
      case "stage":
        cmp = a.currentStage.localeCompare(b.currentStage);
        break;
      case "queueStage":
        cmp = (a.interconnectionQueueStage ?? "").localeCompare(b.interconnectionQueueStage ?? "");
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Project" },
    { key: "fuel", label: "Fuel" },
    { key: "location", label: "Location" },
    { key: "daysWaiting", label: "Waiting" },
    { key: "capacity", label: "Capacity" },
    { key: "stage", label: "Stage" },
    { key: "queueStage", label: "Queue stage" },
  ];

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <span className="text-sm text-[var(--muted)]">{projects.length} projects</span>
        <button
          onClick={() => exportCsv(sorted)}
          className="text-xs px-2.5 py-1 rounded border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 cursor-pointer select-none whitespace-nowrap"
                  onClick={() => sortBy(c.key)}
                >
                  {c.label} {sortKey === c.key && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <td className="px-3 py-2">
                  <Link href={`/project/${p.slug}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  {p.isAggregateExample && (
                    <span className="ml-2 text-[10px] text-[var(--muted)]">(aggregate)</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: FUEL_TYPE_BY_VALUE[p.fuelType]?.color ?? "#6b7280" }}
                    />
                    {FUEL_TYPE_BY_VALUE[p.fuelType]?.label ?? p.fuelType}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{p.state ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {p.yearsWaiting != null ? `${p.yearsWaiting.toFixed(1)} yrs` : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {formatCapacity(p.capacityValue, p.capacityUnit)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {PROJECT_STAGE_BY_VALUE[p.currentStage] ?? p.currentStage.replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{p.interconnectionQueueStage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
