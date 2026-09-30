import type { ProjectDTO } from "@/lib/types";
import { outcomeOf, yearsBetween } from "@/lib/projectOutcome";
import { isPublicHearing } from "@/lib/advocacyActions";
import { formatHearingDate } from "@/lib/hearingTime";
import { FUEL_TYPE_BY_VALUE, formatCapacity, PROJECT_STAGE_BY_VALUE } from "@/lib/data/taxonomies";

// What a search result for a project page says: the title, the meta
// description, and the one visible status line that backs them up on the
// page. People search a project's name plus "approved", "hearing", "where"
// or "developer", so each answers those in that order. Kept apart from the
// share text in page.tsx, which is written for a social post instead.

const TITLE_MAX = 60;
const BRAND = " | WaitingForPower";

type Snippet = Pick<
  ProjectDTO,
  | "name"
  | "state"
  | "county"
  | "applicant"
  | "fuelType"
  | "capacityValue"
  | "capacityUnit"
  | "currentStage"
  | "noLongerReported"
  | "reviewStep"
  | "applicationFiledDate"
  | "dateConfidence"
  | "resolutionDate"
  | "yearsWaiting"
  | "commentDeadline"
  | "hearings"
>;

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

// "Oct 14", with the year only when it isn't this year.
function day(iso: string, state: string | null, nowMs: number): string {
  const sameYear = new Date(iso).getUTCFullYear() === new Date(nowMs).getUTCFullYear();
  return formatHearingDate(iso, state, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

// The next hearing still ahead, and whether the public can speak at it.
function nextHearing(p: Snippet, nowMs: number): { date: string; label: string } | null {
  const h = p.hearings.find((x) => new Date(x.endDate ?? x.date).getTime() >= nowMs);
  if (!h) return null;
  return { date: h.date, label: isPublicHearing(h) ? "Public hearing" : "Hearing" };
}

function openCommentDeadline(p: Snippet, nowMs: number): string | null {
  return p.commentDeadline && new Date(p.commentDeadline).getTime() >= nowMs ? p.commentDeadline : null;
}

function stageText(p: Snippet): string | null {
  return p.reviewStep ?? PROJECT_STAGE_BY_VALUE[p.currentStage] ?? null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function projectSeoTitle(p: Snippet, nowMs: number): string {
  const outcome = outcomeOf(p);
  let status: string;
  if (outcome === "approved") status = `Approved${p.resolutionDate ? ` ${monthYear(p.resolutionDate)}` : ""}`;
  else if (outcome === "cancelled") status = `Cancelled${p.resolutionDate ? ` ${monthYear(p.resolutionDate)}` : ""}`;
  else if (outcome === "no_longer_reported") status = "No Longer Listed";
  else {
    const hearing = nextHearing(p, nowMs);
    const deadline = openCommentDeadline(p, nowMs);
    if (hearing) status = `Pending, ${titleCase(hearing.label)} ${day(hearing.date, p.state, nowMs)}`;
    else if (deadline) status = `Pending, Comments Due ${day(deadline, p.state, nowMs)}`;
    else if (p.yearsWaiting != null) status = `Awaiting Approval (${p.yearsWaiting.toFixed(1)} Yrs)`;
    else status = "Awaiting Approval";
  }
  const title = `${p.name}: ${status}`;
  return title.length + BRAND.length <= TITLE_MAX ? title + BRAND : title;
}

// Where it is and who is building it: "250 MW solar in Halifax County, VA,
// by Acme Energy."
function factsSentence(p: Snippet): string {
  const fuel = FUEL_TYPE_BY_VALUE[p.fuelType]?.label.toLowerCase() ?? "energy";
  const capacity = p.capacityValue != null ? `${formatCapacity(p.capacityValue, p.capacityUnit)} ` : "";
  const place = [p.county, p.state].filter(Boolean).join(", ");
  let s = `${capacity}${fuel} project`;
  if (place) s += ` in ${place}`;
  if (p.applicant) s += `${place ? "," : ""} by ${p.applicant}`;
  return `${capitalize(s)}.`;
}

export function projectSeoDescription(p: Snippet, nowMs: number): string {
  const outcome = outcomeOf(p);
  const parts: string[] = [];
  if (outcome === "approved" || outcome === "cancelled") {
    const years = yearsBetween(p.applicationFiledDate, p.resolutionDate);
    const verb = outcome === "approved" ? "Approved" : "Cancelled";
    parts.push(`${verb}${p.resolutionDate ? ` ${monthYear(p.resolutionDate)}` : ""}${years != null ? ` after ${years.toFixed(1)} years in permitting` : ""}.`);
  } else if (outcome === "no_longer_reported") {
    parts.push("No longer listed by its official source; last seen pending.");
  } else {
    const [since, stage] = pendingParts(p);
    parts.push(`${since}${stage ? ` (${stage.charAt(0).toLowerCase()}${stage.slice(1)})` : ""}.`);
    const events = eventParts(p, nowMs);
    // "Public hearing Oct 14; comments due Oct 10."
    if (events.length > 0) parts.push(`${events.map((e, i) => (i === 0 ? e : e.charAt(0).toLowerCase() + e.slice(1))).join("; ")}.`);
  }
  parts.push(factsSentence(p));
  return parts.join(" ");
}

function pendingParts(p: Snippet): [string, string | null] {
  // An estimated filing date only gets its year, not a made-up month.
  const filed = p.applicationFiledDate
    ? p.dateConfidence === "approximate"
      ? String(new Date(p.applicationFiledDate).getUTCFullYear())
      : monthYear(p.applicationFiledDate)
    : null;
  return [filed ? `Pending since ${filed}` : "Pending", stageText(p)];
}

// "Public hearing Oct 14", "Comments due Oct 10": whichever are still ahead.
function eventParts(p: Snippet, nowMs: number): string[] {
  const hearing = nextHearing(p, nowMs);
  const deadline = openCommentDeadline(p, nowMs);
  return [
    hearing ? `${hearing.label} ${day(hearing.date, p.state, nowMs)}` : null,
    deadline ? `Comments due ${day(deadline, p.state, nowMs)}` : null,
  ].filter((x): x is string => x != null);
}

// The visible one-liner under the project name, for a pending project:
// "Pending since Jul 2023 · Awaiting commission order · Public hearing Oct 14
// · Comments due Oct 10". Resolved projects have OutcomeBanner instead.
export function projectStatusLine(p: Snippet, nowMs: number): string {
  const [since, stage] = pendingParts(p);
  return [since, stage, ...eventParts(p, nowMs)].filter(Boolean).join(" · ");
}
