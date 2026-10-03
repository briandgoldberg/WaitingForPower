import type { OppositionDTO, OppositionKind } from "@/lib/types";

const KIND_LABELS: Record<OppositionKind, string> = {
  intervenor: "Docket intervenor",
  local_government: "Local government",
  lawsuit: "Lawsuit",
  moratorium: "Moratorium",
  organized_group: "Organized group",
};

function fmt(iso: string): string {
  // Month and year only: many sources give no day.
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

// The Opposition part of the Details panel: each sourced record (who, what,
// when, and where it's on record).
export function OppositionSection({ records }: { records: OppositionDTO[] }) {
  return (
    <div className="flex flex-col gap-4">
      {records.length > 0 && (
        <ul className="flex flex-col gap-3">
          {records.map((o, i) => (
            <li key={i} className="border-l-2 border-[var(--accent)] pl-3 min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {KIND_LABELS[o.kind] ?? o.kind}
                {o.date && ` · ${fmt(o.date)}`}
              </div>
              <div className="text-sm font-semibold mt-0.5 break-words">{o.party}</div>
              <div className="text-sm text-[var(--text-secondary)] leading-snug break-words">{o.action}</div>
              <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] underline break-words">
                {o.sourceLabel}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--muted)]">
        Public records only: formal intervenors, local government actions, lawsuits and organized groups, each with its
        source. Individual residents are not named. No record here means none has been found yet, not that nobody objects.
      </p>
    </div>
  );
}
