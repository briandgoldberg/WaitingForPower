// The three things a visitor can log on a project's "I Advocated" button
// (src/components/ProjectDiscussion.tsx) — see ProjectComment.advocacyType
// in schema.prisma. Kept as one small, framework-agnostic module so both
// the client (for the immediate "+N points" confirmation) and the server
// (src/lib/community.ts, src/lib/leaderboard.ts) use the exact same labels
// and weights, never two copies that can drift apart.

export type AdvocacyType = "submitted_comment" | "period_closed" | "attended_hearing";

export const ADVOCACY_TYPES: AdvocacyType[] = ["submitted_comment", "period_closed", "attended_hearing"];

// A hearing can only be logged if it already happened, and only within this
// many days of it — old enough that "recently" stops meaning anything past
// this, and it keeps the leaderboard reflecting current activity rather
// than someone claiming a hearing from a year ago.
export const HEARING_LOOKBACK_DAYS = 45;

export interface AdvocacyTypeInfo {
  value: AdvocacyType;
  label: string;
  // Third person, for the feed/discussion list — "{name} {pastLabel}".
  pastLabel: string;
  points: number;
}

export const ADVOCACY_TYPE_INFO: Record<AdvocacyType, AdvocacyTypeInfo> = {
  submitted_comment: {
    value: "submitted_comment",
    label: "I submitted a comment",
    pastLabel: "submitted a comment",
    points: 3,
  },
  period_closed: {
    value: "period_closed",
    label: "I tried to comment, but the period was closed",
    pastLabel: "helped confirm the comment period is closed",
    points: 1,
  },
  attended_hearing: {
    value: "attended_hearing",
    label: "I attended a hearing",
    pastLabel: "attended a hearing",
    points: 3,
  },
};

export function pointsFor(type: AdvocacyType): number {
  return ADVOCACY_TYPE_INFO[type].points;
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Third-person description for the feed/discussion list, e.g. "submitted a
// comment" or "attended the Mar 3 hearing".
export function describeAdvocacyEntry(type: AdvocacyType, hearingDate?: string | null): string {
  if (type === "attended_hearing" && hearingDate) return `attended the ${fmtShort(hearingDate)} hearing`;
  return ADVOCACY_TYPE_INFO[type].pastLabel;
}

// The position behind a project's "I Advocated" entry — which way they
// were actually advocating, not just that they showed up. Required
// alongside advocacyType (see ProjectDiscussion.tsx) and shown as a small
// thumbs icon/color on both the log entry and the project's own summary.
export type Stance = "approve" | "deny";

export interface StanceInfo {
  value: Stance;
  label: string;
  // Tacked onto the entry description, e.g. "submitted a comment, in
  // support of approval".
  phrase: string;
  icon: string;
  color: string;
}

export const STANCE_INFO: Record<Stance, StanceInfo> = {
  approve: { value: "approve", label: "Support approval", phrase: "in support of approval", icon: "👍", color: "#16a34a" },
  deny: { value: "deny", label: "Support denial", phrase: "in support of denial", icon: "👎", color: "#dc2626" },
};

export const STANCES: Stance[] = ["approve", "deny"];

// AdvocacyContact (src/lib/advocacyContacts.ts) is a separate table since,
// unlike the three above, it isn't tied to one project — same leaderboard,
// flat point value since every contact is real outreach to an elected
// official or regulator, the highest-effort action on the site.
export type ContactTargetType = "state_regulator" | "house" | "senate";

export const CONTACT_TARGET_TYPES: { value: ContactTargetType; label: string }[] = [
  { value: "state_regulator", label: "My state energy regulator" },
  { value: "house", label: "My U.S. Representative" },
  { value: "senate", label: "My U.S. Senator" },
];

export const CONTACT_POINTS = 3;

