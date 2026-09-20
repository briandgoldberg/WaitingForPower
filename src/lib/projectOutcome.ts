import type { ProjectDTO } from "@/lib/types";

// Where a project stands, in the terms a visitor cares about. "approved"
// covers every permits-complete stage (approved, under construction,
// completed); "no_longer_reported" is a pending project whose source stopped
// listing it, which is not a real outcome.
export type ProjectOutcome = "approved" | "cancelled" | "no_longer_reported" | "pending";

const APPROVED_STAGES = new Set(["approved_awaiting_construction", "under_construction", "completed"]);

export function outcomeOf(p: Pick<ProjectDTO, "currentStage" | "noLongerReported">): ProjectOutcome {
  if (p.noLongerReported) return "no_longer_reported";
  if (p.currentStage === "cancelled") return "cancelled";
  if (APPROVED_STAGES.has(p.currentStage)) return "approved";
  return "pending";
}

export function isResolved(outcome: ProjectOutcome): boolean {
  return outcome === "approved" || outcome === "cancelled";
}

// Years between filing and the real resolution date, when both are known.
export function yearsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return ms > 0 ? ms / (365.25 * 24 * 3600 * 1000) : null;
}
