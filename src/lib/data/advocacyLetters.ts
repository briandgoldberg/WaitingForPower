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
      "I am writing as a constituent who wants to see America move past fossil fuels as quickly as we responsibly can. Clean energy is ready to build today. For far too many wind, solar, storage, and transmission projects, the holdup is not the technology or the money. It is a permitting system that leaves good projects waiting for years before anyone gives a real answer.",
    closing:
      "None of this requires weakening environmental protection. It means giving agencies real deadlines, coordinating reviews that already have to happen anyway, and giving communities a real seat at the table early instead of only a lawsuit at the end. I would ask you to support the following changes.",
  },
  moderate: {
    intro:
      "I am writing as a constituent about a problem that should not be a partisan one. Energy projects of every kind, including the power plants, transmission lines, and pipelines this country already depends on, sit stuck in permitting for years longer than the construction itself takes. That delay eventually shows up as a higher electric bill and a less reliable grid back home.",
    closing:
      "This is one of the few issues left where people who disagree about almost everything else can still agree on the fix. Keep the same standards, just put the process on a real clock. I would ask you to support the following changes.",
  },
  conservative: {
    intro:
      "I am writing as a constituent concerned about how much needless red tape stands between good projects and the energy this country needs. Whether it is a new pipeline, a power plant, or the transmission lines to move electricity where it is needed, the holdup is rarely the engineering or the private money ready to build it. It is a permitting process with no deadline, no accountability, and no end in sight.",
    closing:
      "This is not about cutting corners. It is about making government finally do its job on a reasonable timeline, the way any business is expected to. I would ask you to support the following changes.",
  },
};

// One paragraph per cause per leaning, matching the same reform already
// summarized in policies.ts's `summary` field, just voiced for that reader.
const CAUSE_PARAGRAPHS: Partial<Record<CauseSlug, Partial<Record<Orientation, string>>>> = {
  interconnection_queue_backlog: {
    liberal:
      "New solar, wind, and battery storage projects are being held back for years by a grid connection backlog, not by a lack of public support or private investment. A federal rule already on the books, Order No. 2023, calls for faster, first ready, first served studies. Please support fully enforcing it and giving grid operators the staff they need to actually clear the queue.",
    moderate:
      "Thousands of energy projects of every kind are stuck for years waiting on a single grid connection study, often behind an unrelated project that never gets built. A rule already in federal law, Order No. 2023, calls for faster, first ready, first served studies with real deadlines. Please support fully enforcing it and funding the staff needed to meet those deadlines.",
    conservative:
      "A federal rule already on the books, Order No. 2023, calls for faster, first ready, first served grid connection studies with real deadlines. The problem is enforcement, not new law. Please support fully implementing it so that serious, fully financed projects are not left waiting behind paperwork for years at a time.",
  },
  environmental_review_nepa: {
    liberal:
      "Environmental reviews for clean energy projects can take a decade before a shovel ever goes in the ground, often re studying impacts that are already well understood from similar projects nearby. A firm one to two year deadline, paired with real funding for agencies to meet it, would get good projects built faster without lowering the bar on what gets studied.",
    moderate:
      "Reviews under the National Environmental Policy Act now regularly take longer than building the project itself, with no real deadline forcing a decision either way. Congress already put reasonable time and page limits into law once, in 2023. Please support finishing that work with real agency funding so the deadline is more than just words on paper.",
    conservative:
      "Federal environmental reviews can drag on for a decade with no real deadline, adding years of cost and uncertainty to projects that are ready to build. Congress already set reasonable time and page limits in 2023. Please support fully funding and enforcing them, and back the bipartisan SPEED Act to finish the job.",
  },
  multi_agency_permitting: {
    liberal:
      "Clean energy and transmission projects often need sign off from several federal agencies, each running its own separate review on its own timeline, so the slowest one holds up everyone else's already finished work. Extending the One Federal Decision model, which already works today for a smaller set of projects, would keep every agency's voice while ending the pointless waiting.",
    moderate:
      "When a project needs approval from more than one federal agency, each one often reviews it separately and on its own schedule, so the slowest agency sets the pace for all the others. The One Federal Decision framework already fixes this for some projects by putting every agency on one shared schedule. Please support extending it more broadly.",
    conservative:
      "Energy projects that need sign off from multiple federal agencies are too often stuck waiting because each agency runs its own review on its own clock, with nobody accountable for the total delay. The One Federal Decision framework already applies this fix to some projects. Please support extending it further so government stops working against itself.",
  },
  transmission_siting_land_rights: {
    liberal:
      "A single state, or even one county, can block a major transmission line meant to serve an entire region and bring more clean power online, with no federal option if local approval stalls out for good. A federal backstop for lines of true national significance, the same approach already used for interstate gas pipelines, would keep local input while making sure one veto cannot end a project the whole region needs.",
    moderate:
      "Large transmission lines that would serve an entire region can be blocked by a single state or county, with no federal path forward if local approval never comes. Interstate gas pipelines already have a federal backstop for exactly this reason. Please support giving major transmission lines the same option for projects of real national importance.",
    conservative:
      "Big transmission projects that would strengthen grid reliability across an entire region can be killed by a single local objection, even when the rest of the region badly needs the power. Interstate gas pipelines already have a federal backstop precisely to prevent this. Please support extending that same, already proven approach to nationally significant transmission lines.",
  },
  litigation_legal_challenge: {
    liberal:
      "A fully approved clean energy project can still be tied up in court for years after every review is done, with no deadline to file a challenge and no deadline for a judge to decide it. A real, reasonable time limit on filing and deciding these cases would not take away anyone's right to sue. It would just make sure that right has an end date, the same for every project.",
    moderate:
      "A fully approved project of any kind can be re litigated for years today, with no real deadline to file a challenge or to decide it, adding cost and uncertainty that everyone eventually pays for. A shorter, clearly defined filing window and a faster court process would keep the right to challenge a project while finally giving it an end date.",
    conservative:
      "Even after a project clears every required review, it can still be stuck in court for years, since there is no real deadline today to file a legal challenge or to resolve one. Please support a much shorter filing window and a faster, single court process. It protects the right to sue while finally putting an end to open ended litigation risk.",
  },
  local_state_opposition: {
    liberal:
      "Communities near a proposed energy project usually only get a real voice after the site and design are already locked in, which turns every disagreement into an all or nothing fight instead of a conversation. Requiring real engagement and binding community benefit agreements earlier in the process would mean fewer late stage battles and a fairer deal for the people who live closest to these projects.",
    moderate:
      "Local opposition to energy projects usually shows up only after the design is already finalized, by which point there is little room left to negotiate and every disagreement becomes a fight. Requiring real community engagement, and a binding community benefit agreement, earlier in the process would mean fewer late surprises and fewer projects that stall for years over concerns that could have been addressed from the start.",
    conservative:
      "Energy projects too often get derailed late in the process by local opposition that could have been addressed months or years earlier, if the community had actually been asked first. Requiring real, early engagement and a binding community benefit agreement protects local property owners and cuts down on the drawn out fights that waste everyone's time and money.",
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
    "Thank you for your time and your service to our district.",
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
