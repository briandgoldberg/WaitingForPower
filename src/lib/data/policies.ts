// The site's actual policy asks — deliberately kept separate from
// src/lib/data/causeCategories.ts. A "cause" is a neutral, factual
// description of why a project is stuck; a "policy" here is an argued
// position on what should change, including where reasonable people
// disagree. One page (/policies) instead of one per cause, so the whole
// landscape reads as one comparable set of proposals.
//
// Content is informed by permitting-reform arguments publicly made by
// Citizens' Climate Lobby (see their "Build Faster and Key Messages"
// community post, citizensclimatelobby.org) and other bipartisan reform
// advocates, rewritten in this project's own words, framed with real
// strengths *and* weaknesses rather than as pure advocacy copy.
//
// Bill links point to Congress.gov keyword searches by default — a
// specific bill citation goes stale the moment a Congress ends — except
// where a bill is both real and current enough to verify directly (the
// SPEED Act, H.R. 4776, 119th Congress, passed the House 221-196 on
// 2025-12-18; the Energy Permitting Reform Act, S. 4753, 118th Congress).

import type { CauseSlug } from "./causeCategories";

export interface Bill {
  label: string;
  url: string;
  note?: string;
}

export interface Policy {
  /** Matches a CauseSlug 1:1 in v1 — used for #anchors and pulling live project examples. */
  slug: CauseSlug;
  title: string;
  /** Short tagline, e.g. for nav/index chips. */
  oneLiner: string;
  /** Overrides the cause's shortLabel for the /policies nav chip + badge — use when the neutral cause name (e.g. "Local opposition") reads wrong as the name of the policy ask itself. */
  badgeLabel?: string;
  /** The problem + the fix, in one tight paragraph. */
  summary: string;
  strengths: string[];
  weaknesses: string[];
  bills: Bill[];
}

function billSearch(query: string): string {
  return `https://www.congress.gov/search?q=${encodeURIComponent(query)}`;
}

const SPEED_ACT: Bill = {
  label: "SPEED Act (H.R. 4776, 119th Congress)",
  url: "https://www.congress.gov/bill/119th-congress/house-bill/4776",
  note: "Bipartisan (Westerman R-AR, Golden D-ME); passed the House 221-196 on 2025-12-18, pending in the Senate.",
};

export const POLICIES: Policy[] = [
  {
    slug: "interconnection_queue_backlog",
    title: "Interconnection process reform",
    oneLiner: "A fast, real yes or no on grid connection.",
    badgeLabel: "Interconnection",
    summary:
      "Grid queues can outlast the construction itself. Thousands of projects sit stuck behind one plant's paperwork with no deadline forcing an answer. The fix is first-ready-first-served cluster studies with hard deadlines and readiness deposits that weed out speculative filings, plus full enforcement of FERC Order No. 2023, which is already final law.",
    strengths: [
      "Already federal law. The gap is enforcement, not legislation.",
      "Readiness deposits fast-track serious projects, cut the rest.",
    ],
    weaknesses: [
      "Needs real ISO staffing to actually run cluster studies.",
      "Doesn't fix the grid capacity shortage causing the queue.",
    ],
    bills: [
      {
        label: "FERC Order No. 2023",
        url: "https://www.ferc.gov/explainer-interconnection-final-rule",
        note: "Already final. The ask is enforcement, not new legislation.",
      },
      { label: "Congress.gov: interconnection queue reform", url: billSearch("interconnection queue reform") },
    ],
  },
  {
    slug: "environmental_review_nepa",
    title: "NEPA timeline & review reform",
    oneLiner: "Faster reviews. Same rigor.",
    badgeLabel: "NEPA",
    summary:
      "Environmental reviews routinely run past a decade with no real deadline, often re-studying effects already well understood from comparable projects. Citizens' Climate Lobby's ask: hard time limits (1-2 years) and page limits (75-300 pages), one lead agency, and reuse of prior review findings instead of starting from scratch every time.",
    strengths: [
      "This already has bipartisan precedent, since the 2023 debt-limit deal did the same thing once before.",
      "Same questions get answered, just on a clock instead of indefinitely.",
    ],
    weaknesses: [
      "Hard deadlines can pressure rushed reviews.",
      "A clock doesn't help if agencies stay underfunded to meet it.",
    ],
    bills: [
      SPEED_ACT,
      {
        label: "Fiscal Responsibility Act of 2023 (H.R. 3746)",
        url: "https://www.congress.gov/bill/118th-congress/house-bill/3746",
        note: "Public Law 118-5. Enacted the current NEPA page limits and deadlines.",
      },
    ],
  },
  {
    slug: "multi_agency_permitting",
    title: "One Federal Decision",
    oneLiner: "One review. Not a relay race.",
    badgeLabel: "Multi-agency",
    summary:
      "A project can need sign-off from several federal agencies running separate, sequential reviews. The single slowest one sets the pace for everyone else's already-finished work. The fix is one shared schedule and record of decision across every agency involved, using the FAST-41 model extended beyond its current small set of covered projects.",
    strengths: [
      "Already proven at smaller scale under FAST-41 today.",
      "No agency loses its say. It just loses its veto over the calendar.",
    ],
    weaknesses: [
      "Real interagency coordination is hard, not just paperwork.",
      "A shared deadline can pressure a rushed sign-off.",
    ],
    bills: [
      {
        label: "FAST Act of 2015 (H.R. 22), Title 41",
        url: "https://www.congress.gov/bill/114th-congress/house-bill/22",
        note: "Public Law 114-94 established the One Federal Decision framework this would extend.",
      },
    ],
  },
  {
    slug: "transmission_siting_land_rights",
    title: "Federal backstop transmission siting",
    oneLiner: "One state can't veto a national grid.",
    badgeLabel: "Transmission siting",
    summary:
      "A single state, or even just one county within it, can block a transmission line meant to serve an entire region, with no federal option if local approval stalls. The fix is federal backstop siting authority for nationally significant lines, the same model that already governs interstate gas pipelines.",
    strengths: [
      "Interstate gas pipelines already work this way, so there's a direct precedent to follow.",
      "Targets the #1 reason big multi-state lines die.",
    ],
    weaknesses: [
      "The most politically contested idea on this page.",
      "Could override real local concerns, not just parochial ones.",
    ],
    bills: [
      { ...SPEED_ACT, note: SPEED_ACT.note + " Includes transmission provisions." },
      {
        label: "Grid Expansion and Reliability Act (H.R. 8248, 119th Congress)",
        url: "https://www.congress.gov/bill/119th-congress/house-bill/8248",
        note: "Introduced by Rep. Gottheimer, a Democrat from New Jersey, in April 2026. It shifts NIETC transmission-corridor designation to FERC and allows self-certification for transmission facilities within them.",
      },
      { label: "Congress.gov: federal transmission siting authority", url: billSearch("federal transmission siting authority") },
    ],
  },
  {
    slug: "litigation_legal_challenge",
    title: "Judicial review reform",
    oneLiner: "Give lawsuits an end date.",
    summary:
      "A fully-approved project can still be re-litigated for years, with no deadline to file a challenge and no deadline to decide it. Citizens' Climate Lobby has proposed cutting the filing window from 6 years down to 5 months, paired with a single consolidated venue and expedited briefing.",
    strengths: [
      "Doesn't remove the right to sue. Just puts a clock on it.",
      "Today, litigation risk hits good and bad projects equally; a deadline fixes that.",
    ],
    weaknesses: [
      "Litigation is often the only real check on agency shortcuts.",
      "Too short a window can bar claims discovered late for good reason.",
    ],
    bills: [
      SPEED_ACT,
      {
        label: "Energy Permitting Reform Act (S. 4753, 118th Congress)",
        url: "https://www.congress.gov/bill/118th-congress/senate-bill/4753",
        note: "Written on a bipartisan basis by Senators Manchin and Barrasso. It includes judicial review provisions.",
      },
    ],
  },
  {
    slug: "local_state_opposition",
    title: "Earlier community engagement",
    oneLiner: "Talk to communities before the fight, not after.",
    badgeLabel: "Local input",
    summary:
      "Local opposition usually shows up only after the site and design are already locked in. By then it's an all-or-nothing fight instead of a negotiation. The fix is real engagement and binding community benefit agreements early, before decisions are set in stone.",
    strengths: [
      "It fixes the real cause of opposition, not just the symptom, since people get no say and no benefit today.",
      "Fewer late-stage fights tend to mean fewer lawsuits too.",
    ],
    weaknesses: [
      "\"Meaningful engagement\" is hard to define in statute.",
      "Adds real time and cost to project development up front.",
    ],
    bills: [
      { label: "Congress.gov: community benefit agreements", url: billSearch("community benefit agreement energy project siting") },
    ],
  },
];

export const POLICY_BY_SLUG: Record<CauseSlug, Policy | undefined> =
  Object.fromEntries(POLICIES.map((p) => [p.slug, p])) as Record<
    CauseSlug,
    Policy | undefined
  >;

export function getPolicy(slug: string): Policy | undefined {
  return POLICY_BY_SLUG[slug as CauseSlug];
}
