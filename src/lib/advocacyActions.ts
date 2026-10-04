// Shared "can I act on this project" logic for the two places that show it:
// the Advocate > Public Comments tab (src/components/advocacy/PublicCommentsSection.tsx)
// and a single project's own Take action pill
// (src/components/project/TakeActionSection.tsx). Kept in one place so the
// two never drift apart on what counts as a public hearing or an open
// comment window.

import { formatHearingDate } from "@/lib/hearingTime";
import { splitStateCodes } from "@/lib/data/usStates";
import { STATE_COMMENT_RULES, type StateCommentRule } from "@/lib/data/stateCommentRules";

// A hearing the public can speak at, as opposed to an evidentiary hearing
// where the parties present testimony. Judged from the label the source
// gives it.
const PUBLIC_HEARING_RE = /public|comment|input|listening|town hall/i;
const PARTIES_ONLY_RE = /evidentiary|party session|siting committee|contested|prehearing|technical|settlement/i;

export function isPublicHearing(h: { label: string | null }): boolean {
  return !!h.label && PUBLIC_HEARING_RE.test(h.label) && !PARTIES_ONLY_RE.test(h.label);
}

// The one state regulator's comment rule, when the project has exactly one
// state (a multi-state project, e.g. a transmission line, has no single
// rule to apply).
export function ruleForState(state: string | null): StateCommentRule | undefined {
  const codes = splitStateCodes(state);
  return codes.length === 1 ? STATE_COMMENT_RULES[codes[0]] : undefined;
}

export interface CommentScoreInput {
  commentDeadline: string | null;
  reviewStep: string | null;
  hearingCount: number;
  // An upcoming hearing whose own label confirms it's a type the public can
  // speak/comment at (see isPublicHearing above) — e.g. Maryland's docket
  // mail log and Arizona's eDocket both label these distinctly from
  // "Evidentiary Hearing"/"Party session". That's direct, first-party
  // evidence a comment opportunity is open right now, stronger than any
  // state-rule guess in stateCommentRules.ts (many of which are "unknown").
  hasConfirmedPublicHearing?: boolean;
}

// 0 confirmed closed, 1 decision pending with no confirmed state rule (leans
// closed, but we don't claim to know why), 2 genuinely unknown, 3 confirmed
// open. Used both for TakeActionSection's status line and to build the
// Advocate > Public Comments list, which only ever shows score-3 projects.
export function commentScore(p: CommentScoreInput, rule: StateCommentRule | undefined): number {
  if (p.hasConfirmedPublicHearing) return 3;

  const closedRule = rule?.recordRule === "closes_at_hearing";
  const openRule = rule?.recordRule === "open_until_decision";
  // "varies" still means the state DOES take public comments — it's only
  // the deadline that's case-by-case, unlike "unknown" where we never
  // confirmed a comment process exists at all. Treated the same as
  // closedRule below: a real, confirmed comment mechanism plus a scheduled
  // hearing is good evidence the window is open right now.
  const variesRule = rule?.recordRule === "varies";
  const decisionNext = p.reviewStep === "Awaiting commission order";

  if (p.commentDeadline) return 3;
  if (decisionNext && closedRule) return 0;
  if (decisionNext && openRule) return 3;
  if (decisionNext) return 1;
  if (openRule) return 3;
  if ((closedRule || variesRule) && p.hearingCount > 0) return 3;
  return 2;
}

// The three-tier status line: nothing else, no icon. The deadline shows in
// the project's own time zone (see hearingTime.ts).
export function commentStatusText(score: number, deadline: string | null, state: string | null = null): string {
  if (score === 3) {
    if (deadline) return `Accepting comments · due ${formatHearingDate(deadline, state)}`;
    return "Accepting comments";
  }
  if (score === 2) return "Maybe accepting comments";
  return "Unlikely to accept comments";
}
