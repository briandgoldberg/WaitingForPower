import type { ProjectChange } from "@prisma/client";

// Which changeTypes represent a real status/stage transition worth showing
// in a project's own timeline — excludes "fact_revised", since some
// sources' field values flap day to day without the project's actual
// status changing at all (confirmed live: 30+ consecutive daily
// "fact_revised" rows on one project, all the same no-op capacity note).
export const STATUS_CHANGE_TYPES = ["new", "advanced", "resolved", "no_longer_reported", "reappeared", "new_filing"] as const;

const CHANGE_TYPE_PRIORITY = STATUS_CHANGE_TYPES;
const CHANGE_TYPE_LABEL: Record<(typeof STATUS_CHANGE_TYPES)[number], string> = {
  new: "First tracked",
  advanced: "Stage update",
  resolved: "Resolved",
  no_longer_reported: "No longer reported",
  reappeared: "Reappeared",
  new_filing: "New filing",
};

export function changeTypeLabel(changeTypes: string[]): string {
  const primary = CHANGE_TYPE_PRIORITY.find((t) => changeTypes.includes(t));
  return primary ? CHANGE_TYPE_LABEL[primary] : "Updated";
}

export interface StatusHistoryEntry {
  date: string; // ISO
  label: string;
  sub: string | null;
  approximate: boolean;
}

interface MilestoneLike {
  date: Date;
  dateConfidence: string;
  stage: string;
  description: string;
}

// Hand-sourced milestones and the site's own detected changeTypes/summary
// log, merged into one chronological list — a project with no hand-sourced
// milestones at all (most state-docket sources) still gets a real timeline
// from what this site has itself observed changing. Shared by the project
// page and the public API/MCP (via serializeProject) so both show the same
// history from one definition.
export function buildStatusHistory(
  milestones: MilestoneLike[],
  changes: Pick<ProjectChange, "changeTypes" | "summary" | "createdAt">[],
): StatusHistoryEntry[] {
  const fromMilestones = milestones.map((m) => ({
    date: m.date,
    label: m.description,
    sub: m.stage as string | null,
    approximate: m.dateConfidence === "approximate",
  }));
  const fromChanges = changes
    .filter((c) => c.changeTypes.some((t) => (STATUS_CHANGE_TYPES as readonly string[]).includes(t)))
    .map((c) => ({
      date: c.createdAt,
      label: c.summary,
      sub: changeTypeLabel(c.changeTypes) as string | null,
      approximate: false,
    }));
  return [...fromMilestones, ...fromChanges]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => ({ date: e.date.toISOString(), label: e.label, sub: e.sub, approximate: e.approximate }));
}
