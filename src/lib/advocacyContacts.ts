// Logging a contact with a state energy regulator or a member of Congress —
// the National/State Advocacy tabs' companion to a project's "I Advocated"
// button (src/lib/community.ts submitComment). Same identity (Predictor),
// same points system, not tied to one project.

import { prisma } from "@/lib/db";
import { getOrCreateHumanPredictor, getOrCreateAgentPredictor, PredictionError } from "@/lib/predictions";
import { labelOf, flagsOf, isHeld } from "@/lib/community";
import { STATE_NAMES } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { POLICIES } from "@/lib/data/policies";
import type { ContactTargetType } from "@/lib/data/advocacyPoints";

const MAX_NOTE_LENGTH = 500;
const MAX_ISSUES = 8;
const MAX_CONTACTS_PER_HOUR = 10;
// Much tighter for an agent identity — see the matching constant in
// community.ts for why (and src/app/mcp/route.ts for the IP-based layer on
// top of this one).
const MAX_AGENT_CONTACTS_PER_HOUR = 3;
// The same six reform issues shown on the National Advocacy tab (see
// src/lib/data/policies.ts) — not every CauseSlug, which also includes the
// "financing/supply chain" control group that isn't a real reform ask.
const VALID_ISSUE_SLUGS = new Set<string>([...POLICIES.map((p) => p.slug), "other"]);
const VALID_TARGET_TYPES = new Set<ContactTargetType>(["state_regulator", "house", "senate"]);

export class AdvocacyContactError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface AdvocacyContactItem {
  id: string;
  label: string;
  isAgent: boolean;
  confirmed: boolean;
  guest: boolean;
  pending: boolean;
  targetType: ContactTargetType;
  state: string;
  targetName: string | null;
  issues: string[];
  note: string | null;
  createdAt: string;
}

export async function submitAdvocacyContact(params: {
  // Exactly one of these identifies who's logging the contact — see
  // submitComment in community.ts for the same convention.
  anonymousKey?: string;
  agentName?: string;
  targetType: string;
  state: string;
  targetName?: string;
  issues: string[];
  note?: string;
}) {
  const targetType = params.targetType as ContactTargetType;
  if (!VALID_TARGET_TYPES.has(targetType)) {
    throw new AdvocacyContactError("invalid_target", "Pick who you reached.");
  }
  const state = params.state.trim().toUpperCase();
  if (!STATE_NAMES[state]) throw new AdvocacyContactError("invalid_state", "Pick a real state.");

  let targetName = params.targetName?.trim() || null;
  if (targetType === "state_regulator") {
    const regulators = STATE_REGULATORS[state] ?? [];
    const match = regulators.find((r) => r.name === targetName);
    if (!match) throw new AdvocacyContactError("invalid_target_name", "Pick your state's regulator from the list.");
    targetName = match.name;
  } else if (targetName && targetName.length > 120) {
    throw new AdvocacyContactError("target_name_too_long", "That name is too long.");
  }

  const issues = [...new Set(params.issues)].filter((i) => VALID_ISSUE_SLUGS.has(i));
  if (issues.length > MAX_ISSUES) throw new AdvocacyContactError("too_many_issues", "Pick fewer issues.");

  const note = params.note?.trim() || null;
  if (note && note.length > MAX_NOTE_LENGTH) {
    throw new AdvocacyContactError("too_long", `Keep the note under ${MAX_NOTE_LENGTH} characters.`);
  }

  if (!params.anonymousKey && !params.agentName) {
    throw new AdvocacyContactError("missing_identity", "No identity provided.");
  }
  let predictor;
  try {
    predictor = params.agentName ? await getOrCreateAgentPredictor(params.agentName) : await getOrCreateHumanPredictor(params.anonymousKey!);
  } catch (err) {
    if (err instanceof PredictionError) throw new AdvocacyContactError(err.code, err.message);
    throw err;
  }

  const recentCount = await prisma.advocacyContact.count({
    where: { predictorId: predictor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  const hourlyCap = params.agentName ? MAX_AGENT_CONTACTS_PER_HOUR : MAX_CONTACTS_PER_HOUR;
  if (recentCount >= hourlyCap) {
    throw new AdvocacyContactError("rate_limited", "You're logging a lot of contacts. Please try again in a bit.");
  }

  const contact = await prisma.advocacyContact.create({
    data: { predictorId: predictor.id, targetType, state, targetName, issues, note },
  });
  return { contact, predictor };
}

// Recent contacts, most recent first — feeds into the merged advocacy feed
// (src/lib/advocacyFeed.ts) rather than being read directly by a page.
export async function getRecentAdvocacyContacts(limit: number) {
  const publicPoster = { OR: [{ agentName: { not: null } }, { identityDecidedAt: { not: null } }] };
  const predictorSelect = {
    select: { id: true, displayName: true, agentName: true, email: true, identityDecidedAt: true },
  } as const;

  const rows = await prisma.advocacyContact.findMany({
    where: { predictor: publicPoster },
    include: { predictor: predictorSelect },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const items: AdvocacyContactItem[] = rows.map((r) => ({
    id: r.id,
    label: labelOf(r.predictor),
    isAgent: r.predictor.agentName != null,
    ...flagsOf(r.predictor),
    pending: isHeld(r.predictor),
    targetType: r.targetType as ContactTargetType,
    state: r.state,
    targetName: r.targetName,
    issues: r.issues,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
  return items;
}
