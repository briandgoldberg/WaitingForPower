"use client";

import { ADVOCACY_TYPES, ADVOCACY_TYPE_INFO, STANCES, STANCE_INFO, type AdvocacyType, type Stance } from "@/lib/data/advocacyPoints";

export interface HearingOption {
  date: string;
  label: string | null;
}

const MAX_NOTE = 500;

// The "what did you do, and which way" fields shared by a project's own
// "I Advocated" log (ProjectDiscussion.tsx) and the project-mode of "I
// Reached Out!" (AdvocacyContactForm.tsx) — one definition so the two never
// drift apart on labels, validation, or the hearing-picker behavior.
export function AdvocacyActionFields({
  advocacyType,
  onAdvocacyType,
  hearingDate,
  onHearingDate,
  eligibleHearings,
  stance,
  onStance,
  note,
  onNote,
}: {
  advocacyType: AdvocacyType | null;
  onAdvocacyType: (t: AdvocacyType) => void;
  hearingDate: string;
  onHearingDate: (d: string) => void;
  eligibleHearings: HearingOption[];
  stance: Stance | null;
  onStance: (s: Stance) => void;
  note: string;
  onNote: (n: string) => void;
}) {
  return (
    <>
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">What did you do?</span>
      <div className="flex flex-col gap-1.5">
        {ADVOCACY_TYPES.filter((t) => t !== "attended_hearing" || eligibleHearings.length > 0).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onAdvocacyType(t)}
            aria-pressed={advocacyType === t}
            className={`text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
              advocacyType === t
                ? "border-[var(--accent)] bg-accent/10 font-medium"
                : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {ADVOCACY_TYPE_INFO[t].label}
          </button>
        ))}
      </div>

      {advocacyType === "attended_hearing" && (
        <select
          value={hearingDate}
          onChange={(e) => onHearingDate(e.target.value)}
          aria-label="Which hearing"
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
        >
          <option value="">Which hearing?</option>
          {eligibleHearings.map((h) => (
            <option key={h.date} value={h.date}>
              {new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
              {h.label ? ` · ${h.label}` : ""}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {STANCES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStance(s)}
            aria-pressed={stance === s}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              stance === s ? "text-white border-transparent" : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            style={stance === s ? { backgroundColor: STANCE_INFO[s].color } : undefined}
          >
            <span aria-hidden>{STANCE_INFO[s].icon}</span>
            {STANCE_INFO[s].label}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        maxLength={MAX_NOTE}
        rows={2}
        aria-label="Add a note (optional)"
        placeholder="Add a note (optional)"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
      />
    </>
  );
}
