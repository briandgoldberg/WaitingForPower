// Full taxonomy reference for /llms.txt — generated from this project's own
// source-of-truth data modules (causeCategories.ts, taxonomies.ts,
// usStates.ts) rather than hand-copied, so it can't silently drift out of
// sync with what the API/MCP server actually returns.

import { NextResponse } from "next/server";
import { CAUSE_CATEGORIES } from "@/lib/data/causeCategories";
import { PROJECT_TYPES, FUEL_TYPES, PROJECT_STAGES } from "@/lib/data/taxonomies";
import { STATE_NAMES } from "@/lib/data/usStates";

function buildBody(): string {
  const causes = CAUSE_CATEGORIES.map(
    (c) => `- ${c.slug}${c.isControlGroup ? " (control group, not a permitting bottleneck)" : ""}: ${c.description}`,
  ).join("\n");
  const projectTypes = PROJECT_TYPES.map((t) => `${t.value} (${t.label})`).join(", ");
  const fuelTypes = FUEL_TYPES.map((t) => `${t.value} (${t.label})`).join(", ");
  const stages = PROJECT_STAGES.map((s) => `${s.value} (${s.label})`).join(", ");
  const states = Object.keys(STATE_NAMES).sort().join(", ");

  return `# WaitingForPower — full reference

See /llms.txt first for the short version and endpoint list. This file is
the taxonomy an agent needs to interpret or construct a filter correctly.

## Cause categories (Project.causeSlugs / list_causes)

Every tracked project's delay is mapped to one or more of these — a
neutral, factual "why it's stuck," not this site's policy argument (that
lives separately at /policies).

${causes}

Coverage note: cause tagging is populated by only some ingestion sources
today (LBNL Queued Up tags every row interconnection_queue_backlog by
definition; several state docket sources tag local_state_opposition).
EIA-860M, the Permitting Dashboard, ORNL hydropower relicensing, and EIA's
pipeline tracker do not publish a cause and currently ship with an empty
causeSlugs array rather than a guessed one — do not assume every project
has a cause tag.

## Project types

${projectTypes}

## Fuel types

${fuelTypes}

## Permitting stages (currentStage)

${stages}

Resolved stages (approved_awaiting_construction, under_construction,
cancelled, completed) are excluded from the default "in_permitting" status
bucket every endpoint uses unless status=all is passed.

## States with active tracking

${states}

## Verification status

verified (the default — sourced directly from a live government docket or
dataset) | user_submitted_pending | user_submitted_verified. Every
currently-live project is "verified" — user submissions are held for
review before publishing, never mixed in silently.

## Per-project fields worth knowing about (not all populated for every source)

balancingAuthority (ISO/RTO territory), pointOfInterconnection,
queueCluster, networkUpgradeCostUsd, poiCostUsd (interconnection-queue
sources only), ownerSector, netSummerCapacityMw/netWinterCapacityMw,
primeMoverCode (EIA-860M only), dataQualityNote (a stated caveat when one
applies, rather than presented as unqualified fact).

## Advocacy log

No free-text comments — people log real advocacy actions instead, through a
no-signup form identified by an anonymous browser key or a confirmed email
(never a login). On a project page, "I Advocated" records one of: submitted
a public comment, found the comment period closed, or attended a specific
hearing (validated against that project's own real ProjectHearing rows,
only within 45 days after it happened, never in advance) — each paired with
a stated stance, support approval or support denial. Separately, "I Reached
Out!" (on /policies) records a contact with a state energy regulator or a
member of Congress, with which of the six national reform issues were
raised. Both count toward a points-based leaderboard shown at
https://waitingforpower.com/?feed=leaders. An agent can log either action
directly via the MCP server's log_project_advocacy / report_advocacy_contact
tools (see /llms.txt) — always under a visible agentName identity, never
presented as an anonymous guest or a confirmed human, and held to a tighter
rate limit than a person gets.

Everything is public: GET /api/comments?slug=<project slug> returns one
project's whole log (each entry with advocacyType, stance, an optional
hearingDate, and a stanceTally of approve/deny across the project). GET
/api/community returns the project-only site-wide feed (limit, offset). GET
/api/advocacy-feed returns the fuller merged feed, project entries,
official-contact entries, and Board topics together — the same data behind
the home page's "Advocacy activity" tab. Each project page also has an
"Advocate" section with its official docket, the state regulator's website
and contact page, and hearing and comment dates.

## Board

Separate from the advocacy log above: open discussion at /board, tagged
with 1+ of the same six national permitting-reform issues rather than tied
to one project. Anyone, including an agent via the MCP server's
post_board_topic / reply_board_topic tools, can start a topic or reply —
but this is conversation, not a verified civic action, so it never earns
points and is never counted by the leaderboard. An agent's post always
carries its visible agentName, never presented as a guest or confirmed
human. GET /api/forum/topics lists topics (limit, offset, each with a
replyCount). GET /api/forum/topics/{id} returns one topic with its full
reply thread.

## Reproducibility

Point-in-time snapshots of the full dataset are taken monthly and kept
indefinitely — see /api/snapshots to cite an exact past state rather than
today's live (changing) numbers.
`;
}

export function GET() {
  return new NextResponse(buildBody(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
