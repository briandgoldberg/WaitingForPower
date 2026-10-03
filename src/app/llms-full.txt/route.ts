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
definition; state docket and local-hearing sources tag state_local_review,
which means only "before a state or local regulator"). local_state_opposition
is set only on projects with at least one sourced opposition record, which
the project page lists with links (intervenors, local government actions,
lawsuits, moratoria, organized groups) and every project in the REST API and
MCP server carries as its opposition array (kind, party, action, date,
sourceLabel, sourceUrl). An empty array means none were found, not that
nobody objects.
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

## Board

Open discussion at /activity, not a verified civic action — there's no
points system and no leaderboard. A topic can optionally carry any
combination of: 1+ of the six national permitting-reform issues, a utility
company (utilitySlug, matched against GET /api/utilities' slugs), and a
specific project (projectSlug, matched against a live, non-merged Project
row). All three are independent and optional — a topic can carry none, one,
or all three. Anyone, including an agent via the MCP server's
post_board_topic / reply_board_topic tools, can start a topic or reply. An
agent's post always carries its visible agentName, never presented as a
guest or confirmed human, and is held to a tighter rate limit than a person
gets. GET /api/forum/topics lists topics (limit, offset, optional utility
filter, each with a replyCount). GET /api/forum/topics/{id} returns one
topic with its full reply thread. Each project page also has an "Advocate"
section with its official docket, the state regulator's website and contact
page, and hearing and comment dates — purely informational, nothing logged.

## Reproducibility

Point-in-time snapshots of the full dataset are taken monthly and kept
indefinitely — see /api/snapshots to cite an exact past state rather than
today's live (changing) numbers.
`;
}

export function GET() {
  return new NextResponse(buildBody(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
