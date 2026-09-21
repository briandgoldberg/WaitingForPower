// Shared classifier for a state docket's procedural step, so every state
// ingest labels the same situation the same way. A source hands over its
// filing / event list (date + free text per row); this returns where the case
// stands. Only three labels are used, because they are what the site acts on:
//
//   "Awaiting commission order"  the hearing is over (or none was needed) and
//                                a decision is the next event: decision-ready
//   "Hearing scheduled"          a hearing is set and has not happened yet
//   "Application filed"          everything earlier
//
// A docket with a closing order is finished, so this returns null for it (the
// ingest sets its stage to a resolved one instead). Sources differ a lot in
// wording, so callers may pass their own regexes to override any signal.

export interface DocketEvent {
  date: Date | null;
  text: string;
}

export interface ReviewStep {
  step: "Awaiting commission order" | "Hearing scheduled" | "Application filed";
  at: Date | null;
}

export interface StepSignals {
  /** A hearing has been set or noticed. */
  hearingSet?: RegExp;
  /** A previously set hearing was cancelled or vacated. */
  hearingOff?: RegExp;
  /** The hearing has happened (transcript, "hearing held", record closed). */
  hearingHeld?: RegExp;
  /** Something that means the decision is next: proposed order, briefs filed, submitted for decision, taken under advisement, draft order. */
  decisionNext?: RegExp;
  /** The case is closed by a final order, denial, dismissal or withdrawal. */
  closed?: RegExp;
}

export const DEFAULT_SIGNALS: Required<StepSignals> = {
  hearingSet: /\b(notice of (public |evidentiary |technical |prehearing |pre-hearing )?(hearing|public (comment|statement) hearing)|order setting (a )?(public )?hearing|setting hearing|hearing (is )?(scheduled|set))\b/i,
  hearingOff: /\b(cancel+(ed|ing|ation)|vacat(ed|ing)|postpone(d|ment)|continu(ed|ance)) .{0,30}hearing|\bhearing .{0,30}(cancel+ed|vacated|postponed)/i,
  hearingHeld: /\b(transcript|hearing held|stenographer|record closed|close of (the )?record)\b/i,
  decisionNext: /\b(proposal for decision|proposed (order|decision|final order)|recommended (order|decision)|draft order|submitted for decision|taken under advisement|post-?hearing brief|reply brief|initial brief|briefs? (filed|due)|staff (recommendation|memo|memorandum)|open meeting|business meeting)\b/i,
  closed: /\b(final (order|decision)|order (granting|approving|denying|dismissing)|order on rehearing|certificate (issued|granted)|notice of withdrawal|case closed|docket closed)\b/i,
};

/**
 * Classify a docket from its events (any order). Returns null when the case is
 * already closed or there are no events to judge from.
 */
export function classifyReviewStep(events: DocketEvent[], overrides: StepSignals = {}): ReviewStep | null {
  const s = { ...DEFAULT_SIGNALS, ...overrides };
  const usable = events.filter((e) => e.text.trim());
  if (usable.length === 0) return null;
  if (usable.some((e) => s.closed.test(e.text))) return null;

  const time = (e: DocketEvent) => e.date?.getTime() ?? 0;
  const byDate = [...usable].sort((a, b) => time(a) - time(b));

  const decisive = byDate.filter((e) => s.hearingHeld.test(e.text) || s.decisionNext.test(e.text));
  if (decisive.length > 0) return { step: "Awaiting commission order", at: decisive[decisive.length - 1].date };

  const hearingEvents = byDate.filter((e) => s.hearingSet.test(e.text) || s.hearingOff.test(e.text));
  const last = hearingEvents[hearingEvents.length - 1];
  if (last && s.hearingSet.test(last.text) && !s.hearingOff.test(last.text)) {
    return { step: "Hearing scheduled", at: last.date };
  }
  return { step: "Application filed", at: byDate[0].date };
}
