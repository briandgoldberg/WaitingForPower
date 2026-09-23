// Pre-written letter content for the National Advocacy tab's letter builder
// (src/components/advocacy/LetterBuilder.tsx). Nothing here is generated on
// the fly by a model at request time. A visitor picks one or more issues
// (see src/lib/data/policies.ts, the same six reforms already shown on this
// page) and a political leaning, and the two pieces below are assembled
// into one letter. This keeps every combination pre-written and reviewable,
// while covering every possible selection without hand writing dozens of
// near-duplicate full letters.
//
// The three leanings aren't a caricature of anyone's politics. They follow
// how Citizens' Climate Lobby (already this page's stated inspiration)
// actually trains volunteers to write to Congress: the same underlying ask,
// framed around what that reader's own values already are, whether that's
// climate urgency, cutting government waste, or just keeping the lights on
// and the bills down.

import type { CauseSlug } from "./causeCategories";
import { POLICIES } from "./policies";

export type Orientation = "liberal" | "moderate" | "conservative";

export const ORIENTATION_OPTIONS: { value: Orientation; label: string; description: string }[] = [
  { value: "liberal", label: "Liberal", description: "Framed around clean energy and climate urgency." },
  { value: "moderate", label: "Moderate", description: "Framed around cost, reliability, and common ground." },
  { value: "conservative", label: "Conservative", description: "Framed around cutting red tape and energy independence." },
];

interface Framing {
  intro: string;
  closing: string;
}

const FRAMING: Record<Orientation, Framing> = {
  liberal: {
    intro:
      "I am writing as a constituent who wants America to move past fossil fuels quickly and responsibly. Clean energy is ready to build today. Too often the holdup is not the technology or the money. It is a permitting system that leaves good projects waiting years for a real answer.",
    closing:
      "None of this requires weakening environmental protection. It means real deadlines, coordinated reviews, and an early seat at the table for communities instead of only a lawsuit at the end. I would ask you to support the following.",
  },
  moderate: {
    intro:
      "I am writing as a constituent about a problem that should not be partisan. Energy projects of every kind sit stuck in permitting for years longer than the construction itself takes. That delay eventually shows up as a higher electric bill and a less reliable grid back home.",
    closing:
      "This is one of the few issues left where people who disagree about almost everything else can still agree on the fix. Keep the same standards, just put the process on a real clock. I would ask you to support the following.",
  },
  conservative: {
    intro:
      "I am writing as a constituent concerned about how much red tape stands between good projects and the energy this country needs. The holdup is rarely the engineering or the private money ready to build. It is a permitting process with no deadline and no accountability.",
    closing:
      "This is not about cutting corners. It is about making government finally do its job on a reasonable timeline, the way any business is expected to. I would ask you to support the following.",
  },
};

// One paragraph per cause per leaning, matching the same reform already
// summarized in policies.ts's `summary` field, just voiced for that reader.
const CAUSE_PARAGRAPHS: Partial<Record<CauseSlug, Partial<Record<Orientation, string>>>> = {
  interconnection_queue_backlog: {
    liberal:
      "New solar, wind, and battery storage projects are held back for years by a grid connection backlog, not a lack of support or money. A federal rule, Order No. 2023, already calls for faster, first ready, first served studies. Please support fully enforcing it.",
    moderate:
      "Thousands of energy projects sit for years waiting on a single grid connection study, often behind one unrelated project that never gets built. A federal rule, Order No. 2023, already calls for faster studies with real deadlines. Please support fully enforcing it.",
    conservative:
      "A federal rule, Order No. 2023, already calls for faster, first ready, first served grid connection studies with real deadlines. The problem is enforcement, not new law. Please support fully implementing it so funded, ready projects are not left waiting for years.",
  },
  environmental_review_nepa: {
    liberal:
      "Environmental reviews for clean energy projects can take a decade, often re studying impacts already well understood. A firm one to two year deadline, with real funding to meet it, would get good projects built faster without lowering the bar.",
    moderate:
      "Reviews under the National Environmental Policy Act now often take longer than building the project itself, with no real deadline forcing a decision. Congress already set reasonable time and page limits in 2023. Please support fully funding and enforcing them.",
    conservative:
      "Federal environmental reviews can drag on for a decade with no real deadline, adding years of cost and uncertainty. Congress already set reasonable time and page limits in 2023. Please support funding them and back the bipartisan SPEED Act to finish the job.",
  },
  multi_agency_permitting: {
    liberal:
      "Clean energy and transmission projects often need sign off from several federal agencies, each on its own timeline, so the slowest one holds up all the others. Extending the One Federal Decision model, which already works for some projects, would end the pointless waiting.",
    moderate:
      "When a project needs approval from more than one federal agency, each often reviews it separately, so the slowest agency sets the pace for everyone else. The One Federal Decision framework already fixes this for some projects. Please support extending it more broadly.",
    conservative:
      "Projects that need sign off from multiple federal agencies are too often stuck because each runs its own review on its own clock, with nobody accountable for the delay. The One Federal Decision framework already fixes this for some projects. Please support extending it further.",
  },
  transmission_siting_land_rights: {
    liberal:
      "A single county can block a major transmission line meant to serve an entire region, with no federal option if local approval stalls. A federal backstop for lines of national significance, the same approach used for gas pipelines, would protect projects the whole region needs.",
    moderate:
      "Large transmission lines that would serve an entire region can be blocked by a single state or county, with no federal path forward. Interstate gas pipelines already have a federal backstop for this reason. Please support the same option for lines of real national importance.",
    conservative:
      "Transmission projects that would strengthen grid reliability across a region can be killed by a single local objection, even when the region badly needs the power. Interstate gas pipelines already have a federal backstop for this reason. Please support extending that approach to nationally significant lines.",
  },
  litigation_legal_challenge: {
    liberal:
      "A fully approved clean energy project can still be tied up in court for years, with no deadline to file a challenge or decide it. A reasonable time limit would not take away anyone's right to sue. It would just give that right an end date.",
    moderate:
      "A fully approved project can be re litigated for years today, with no real deadline to file or decide a challenge. A shorter filing window and a faster court process would keep the right to challenge while giving it an end date.",
    conservative:
      "Even after a project clears every review, it can sit in court for years, since there is no real deadline to file or resolve a challenge. A shorter filing window and a faster court process would end that open ended risk.",
  },
  local_state_opposition: {
    liberal:
      "Communities near a proposed project usually only get a voice after the design is locked in, turning every disagreement into an all or nothing fight. Requiring real engagement and a binding community benefit agreement earlier would mean a fairer deal for nearby residents.",
    moderate:
      "Local opposition usually shows up only after a project's design is finalized, when little room is left to negotiate. Requiring real engagement, and a binding community benefit agreement, earlier would mean fewer projects that stall for years over concerns raised too late.",
    conservative:
      "Energy projects too often get derailed late by local opposition that could have been addressed years earlier, if the community had actually been asked first. Requiring real, early engagement and a binding community benefit agreement protects property owners and cuts down on drawn out fights.",
  },
};

export interface LetterInput {
  causeSlugs: CauseSlug[];
  orientation: Orientation;
}

// Builds one letter from the pre-written blocks above, in the same order
// the issues already appear elsewhere on this page (POLICIES' own order),
// regardless of the order they were clicked in.
export function buildLetter({ causeSlugs, orientation }: LetterInput): string {
  const framing = FRAMING[orientation];
  const orderedSlugs = POLICIES.map((p) => p.slug).filter((slug) => causeSlugs.includes(slug));

  const issueParagraphs = orderedSlugs
    .map((slug) => CAUSE_PARAGRAPHS[slug]?.[orientation])
    .filter((p): p is string => Boolean(p));

  const body = [framing.intro, ...issueParagraphs, framing.closing].join("\n\n");

  return [
    "Dear [Representative or Senator's name],",
    "",
    body,
    "",
    "Sincerely,",
    "[Your name]",
    "[Your city, state]",
  ].join("\n");
}

export function letterSubject(causeSlugs: CauseSlug[]): string {
  const titles = POLICIES.filter((p) => causeSlugs.includes(p.slug)).map((p) => p.title);
  if (titles.length === 0) return "Support faster energy permitting";
  if (titles.length <= 2) return `Please support: ${titles.join(" and ")}`;
  return "Please support faster energy permitting";
}
