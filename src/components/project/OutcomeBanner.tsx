import type { ProjectDTO } from "@/lib/types";
import { yearsBetween, type ProjectOutcome } from "@/lib/projectOutcome";

const STAGE_PHRASE: Record<string, string> = {
  approved_awaiting_construction: "Awaiting construction",
  under_construction: "Under construction",
  completed: "Completed",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

const TONES = {
  approved: {
    box: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
    badge: "bg-emerald-600 text-white",
    title: "text-emerald-800 dark:text-emerald-300",
    icon: "✓",
  },
  cancelled: {
    box: "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30",
    badge: "bg-rose-600 text-white",
    title: "text-rose-800 dark:text-rose-300",
    icon: "✕",
  },
  no_longer_reported: {
    box: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    badge: "bg-amber-500 text-white",
    title: "text-amber-800 dark:text-amber-300",
    icon: "!",
  },
} as const;

// The first thing on a project that is no longer just "waiting": a clear,
// colored statement of what happened, with the real date and how long it took
// when the source publishes them.
export function OutcomeBanner({
  project: p,
  outcome,
  observedAt,
}: {
  project: ProjectDTO;
  outcome: Exclude<ProjectOutcome, "pending">;
  // When we first saw this project resolved. Only used as an estimate, and
  // only when the source didn't publish a real resolution date.
  observedAt?: string | null;
}) {
  const tone = TONES[outcome];
  const waited = yearsBetween(p.applicationFiledDate, p.resolutionDate);

  // The date is the key fact, so it goes first and always says how solid it is:
  // exact (published by the source), estimated (the source marks it
  // approximate, or we only know when we first saw it), or not available.
  const verb = outcome === "cancelled" ? "Cancelled" : "Approved";
  const dateFact = (): string => {
    if (p.resolutionDate) {
      const kind = p.resolutionDateConfidence === "approximate" ? "estimated date" : "exact date";
      return `${verb} ${fmtDate(p.resolutionDate)} (${kind})`;
    }
    if (observedAt) return `${verb} by ${fmtDate(observedAt)} (estimated: when we first saw it)`;
    return `${verb === "Approved" ? "Approval" : "Cancellation"} date not published`;
  };

  let title: string;
  const facts: string[] = [];
  if (outcome === "approved") {
    title = "Approved";
    facts.push(dateFact());
    if (STAGE_PHRASE[p.currentStage]) facts.push(STAGE_PHRASE[p.currentStage]);
    if (waited != null) facts.push(`Waited ${waited.toFixed(1)} years for approval`);
  } else if (outcome === "cancelled") {
    title = "Cancelled";
    facts.push(dateFact());
    if (waited != null) facts.push(`After ${waited.toFixed(1)} years in permitting`);
  } else {
    title = "No longer reported";
    facts.push("The source stopped listing this project, so its current status is unknown.");
  }

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${tone.box}`} role="status">
      <span
        aria-hidden
        className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-lg font-bold ${tone.badge}`}
      >
        {tone.icon}
      </span>
      <div className="min-w-0">
        <div className={`text-xl font-bold leading-tight ${tone.title}`}>{title}</div>
        {facts.length > 0 && <div className="text-sm text-[var(--text-secondary)] mt-0.5">{facts.join(" · ")}</div>}
      </div>
    </div>
  );
}
