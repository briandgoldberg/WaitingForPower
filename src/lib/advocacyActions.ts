// Shared "can I act on this project" logic for the two places that show it:
// the Advocate > Projects tab (src/components/advocacy/ProjectAdvocacySection.tsx)
// and a single project's own Take action pill
// (src/components/project/TakeActionSection.tsx). Kept in one place so the
// two never drift apart on what counts as a public hearing or an open
// comment window.

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
}

// 0 confirmed closed, 1 decision pending with no confirmed state rule (leans
// closed, but we don't claim to know why), 2 genuinely unknown, 3 confirmed
// open. See matchesBucket in ProjectAdvocacySection for how this partitions
// the Advocate > Projects filter.
export function commentScore(p: CommentScoreInput, rule: StateCommentRule | undefined): number {
  const closedRule = rule?.recordRule === "closes_at_hearing";
  const openRule = rule?.recordRule === "open_until_decision";
  const decisionNext = p.reviewStep === "Awaiting commission order";

  if (p.commentDeadline) return 3;
  if (decisionNext && closedRule) return 0;
  if (decisionNext && openRule) return 3;
  if (decisionNext) return 1;
  if (openRule) return 3;
  if (closedRule && p.hearingCount > 0) return 3;
  return 2;
}

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// The three-tier status line: nothing else, no icon.
export function commentStatusText(score: number, deadline: string | null): string {
  if (score === 3) return deadline ? `Accepting comments · due ${fmtShort(deadline)}` : "Accepting comments";
  if (score === 2) return "Maybe accepting comments";
  return "Unlikely to accept comments";
}
