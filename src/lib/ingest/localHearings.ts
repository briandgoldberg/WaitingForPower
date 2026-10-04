// Hand-researched city and county hearings on energy projects in and around
// big metros (suburbs included) — the planning commissions, city councils,
// zoning boards and county boards that state regulators' dockets (every other
// module here) never cover, and where most metro energy fights actually
// happen. Also the odd state proceeding a state module's search misses (see
// the Virginia entry). A weekly research pass (the Claude
// Code routine that also maintains handResearched.ts) adds and updates
// entries; see ingest/README.md "Local hearings".
//
// Rules for that pass, so the site never shows a hearing that isn't real:
//   - Only a hearing the public can speak at (a public hearing, public
//     comment period at a meeting, or public forum), still ahead, and
//     confirmed on the government body's own page (agenda, hearing notice,
//     or official press release) where one exists. Until the body posts its
//     agenda, a date reported by at least one named local outlet from the
//     meeting itself (a continuance announced on the record) may go in with
//     `dateFrom` naming that outlet; the site then says the date is from
//     local news. Replace it with the official page once posted.
//   - Each entry is its own project (matchKey "local:<id>"). Skip a project
//     some state source already tracks, rather than attaching to it — an
//     upsert here would overwrite that source's own fields.
//   - When the body decides (approves, denies, or the applicant withdraws),
//     set `resolved` instead of deleting the entry, so the site takes it off
//     the waiting list; delete it once it has been resolved for a while.
//   - Past hearings can stay listed; the site only shows upcoming ones.

import type { FuelType, ProjectType } from "@/lib/data/taxonomies";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

interface LocalHearing {
  date: string; // ISO date-time with offset, e.g. "2026-10-13T19:00:00-07:00"
  label: string; // as the notice names it, e.g. "Public hearing", "City Council public hearing"
  location: string | null; // venue or remote-access line, as published
  // Set when no official page confirms the date yet: the outlet that
  // reported it, e.g. "Patch". Shown on the site next to the label.
  dateFrom?: string;
}

interface LocalHearingEntry {
  id: string; // stable slug, e.g. "covina-reliability-bess"
  name: string;
  state: string; // two-letter code
  county: string | null;
  city: string; // the big city or metro this counts toward, e.g. "Los Angeles area"
  authority: string; // the deciding body, e.g. "Covina City Council"
  projectType: ProjectType;
  fuelType: FuelType;
  capacityMw: number | null;
  applicant: string | null;
  hearings: LocalHearing[];
  // Official page(s) confirming the hearing: agenda, notice, press release.
  sources: { label: string; url: string }[];
  verifiedOn: string; // YYYY-MM-DD, the date the sources were last read
  // Written-comment deadline, if the notice gives one (ISO date-time).
  commentDeadline?: string;
  // Overrides the default "waiting on a local land-use decision" wording,
  // e.g. for a state proceeding.
  causeDetail?: string;
  // A state regulator's case the state importer misses, not a local body's.
  stateProceeding?: boolean;
  resolved?: { outcome: "approved" | "denied" | "withdrawn"; evidence: string };
}

// Checked 2026-09-28. Every entry's hearings and sources were read that day.
export const LOCAL_HEARINGS: LocalHearingEntry[] = [
  {
    id: "va-morrisville-wishing-star-500kv",
    name: "Morrisville–Wishing Star 500 kV transmission line (VA SCC PUR-2026-00021)",
    state: "VA",
    county: "Loudoun",
    city: "Washington, DC suburbs (Loudoun, Prince William and Fauquier counties)",
    authority: "Virginia State Corporation Commission",
    projectType: "transmission",
    fuelType: "transmission",
    capacityMw: null,
    applicant: "Dominion Energy Virginia",
    hearings: [
      {
        date: "2026-09-30T10:00:00-04:00",
        label: "Public witness hearing (Microsoft Teams, webcast)",
        location: "Microsoft Teams; speaker pre-registration closed Sept 25, written comments open through Oct 30",
      },
    ],
    // The state importer (vaSccDockets.ts) searches captions for
    // "Certificate of Public Convenience and Necessity"; this case's caption
    // ("For approval & certification of electric transmission facilities")
    // doesn't use the phrase, so it's not double-tracked.
    sources: [
      { label: "Loudoun County: SCC schedule for the Morrisville–Wishing Star case", url: "https://www.loudoun.gov/m/newsflash/Home/Detail/10742" },
      { label: "Virginia SCC docket PUR-2026-00021", url: "https://scc.virginia.gov/docketsearch" },
    ],
    verifiedOn: "2026-09-28",
    commentDeadline: "2026-10-30T23:59:00-04:00",
    stateProceeding: true,
    causeDetail: "Waiting on a Virginia State Corporation Commission decision on the transmission certificate; evidentiary hearing Nov 16, 2026.",
  },
  {
    id: "nj-bridgewater-rockland-bess",
    name: "Rockland APV / Bridgewater Energy battery storage, 760 East Main Street",
    state: "NJ",
    county: "Somerset",
    city: "New York City area (Bridgewater Township)",
    authority: "Bridgewater Township Zoning Board of Adjustment",
    projectType: "storage",
    fuelType: "storage",
    capacityMw: null,
    applicant: "Rockland APV / Bridgewater Energy LLC",
    hearings: [
      {
        date: "2026-10-27T19:00:00-04:00",
        label: "Zoning Board public hearing (continued)",
        location: "Bridgewater Township Municipal Building, 100 Commons Way, Bridgewater, NJ",
      },
    ],
    sources: [
      // Official: the Board meets at 7 p.m. on the 2nd and 4th Tuesdays at
      // 100 Commons Way (Oct 27 is a 4th Tuesday); the continuance to Oct 27
      // was announced on the record at the Sept meeting (Patch, Citizen Portal).
      { label: "Bridgewater Township Zoning Board of Adjustment agendas", url: "https://bridgewaternj.gov/agenda-library/board-of-adjustment-meetings" },
      { label: "Bridgewater Township 2026 Board of Adjustment meeting dates", url: "https://bridgewaternj.gov/all-legal-notices/board-of-adjustment-notices/978-public-legal-notice-board-of-adjustment-meeting-dates-2026/file" },
      { label: "Patch: hearing carried to Oct. 27 at 7 p.m.", url: "https://patch.com/new-jersey/bridgewater/battery-storage-plan-pressed-flooding-security-fire-safety-bridgewater" },
    ],
    verifiedOn: "2026-09-28",
  },
  {
    id: "ca-menifee-seaflower-bess",
    name: "Seaflower Battery Energy Storage System (100 MW / 400 MWh)",
    state: "CA",
    county: "Riverside",
    city: "Los Angeles area (Menifee, Inland Empire)",
    authority: "Menifee Planning Commission",
    projectType: "storage",
    fuelType: "storage",
    capacityMw: 100,
    applicant: null,
    hearings: [
      {
        date: "2026-10-28T18:00:00-07:00",
        label: "Planning Commission public hearing",
        location: "Menifee City Hall Council Chambers, 29844 Haun Road, Menifee, CA",
      },
    ],
    // Official: the draft IS/MND (Plot Plan PLN 25-0027, CUP PLN 25-0019;
    // 100 MW / 4-hour) and the Commission's regular 6 p.m. meetings on the
    // 2nd and 4th Wednesdays (Oct 28 is a 4th Wednesday); the Oct 28 date is
    // from the city's hearing notice as reported by Menifee 24/7.
    sources: [
      { label: "City of Menifee environmental notices (Seaflower BESS draft IS/MND)", url: "https://www.menifee.ca.gov/325/Environmental-Notices-Documents" },
      { label: "Menifee Planning Commission (meets 2nd and 4th Wednesdays, 6 p.m.)", url: "https://www.menifee.ca.gov/160/Planning-Commission" },
      { label: "Menifee 24/7: Planning Commission hearing Oct. 28", url: "https://menifee247.com/2026/09/planning-commission-to-consider-third-battery-storage-facility-in-menifee.html" },
    ],
    verifiedOn: "2026-09-28",
    // Written comments on the draft Mitigated Negative Declaration.
    commentDeadline: "2026-10-21T23:59:00-07:00",
  },
  {
    id: "ny-new-scotland-vista-bess",
    name: "Vista Technology Park battery energy storage system (AIP BESS, SUP #648)",
    state: "NY",
    county: "Albany",
    city: "Albany, NY area (New Scotland)",
    authority: "New Scotland Planning Board",
    projectType: "storage",
    fuelType: "storage",
    capacityMw: 4.5,
    applicant: "Adaptive Infrastructure Partners (AIP)",
    hearings: [
      {
        date: "2026-10-06T18:00:00-04:00",
        label: "Planning Board public hearing",
        location: "St. Matthews Church, 25 Mountainview St., Voorheesville, NY 12186",
      },
    ],
    // Official: the town's own Planning Board page names this exact hearing
    // ("AIP BESS SUP #648 at Vista Blvd.") with date/time/location. Daily
    // Gazette confirms capacity (4.5 MW, three 1.5 MW enclosures) and
    // applicant.
    sources: [
      { label: "Town of New Scotland Planning Board", url: "https://www.townofnewscotland.gov/192/Planning-Board" },
      {
        label: "Daily Gazette: New Scotland moves battery storage forward",
        url: "https://www.dailygazette.com/spotlightnews/news/government/new-scotland-moves-battery-storage-forward-2-more-coming/article_fba99e9b-e2fe-4d50-a7f7-c6e5239f5959.html",
      },
    ],
    verifiedOn: "2026-10-04",
  },
  {
    id: "mi-marshall-solar-slu26-0004",
    name: "Marshall Solar (SLU 26-0004)",
    state: "MI",
    county: "Calhoun",
    city: "Battle Creek area (Marshall)",
    authority: "City of Marshall Planning Commission",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: 10.5,
    applicant: null,
    hearings: [
      {
        date: "2026-10-14T19:00:00-04:00",
        label: "Planning Commission public hearing",
        location: "Marshall City Hall, 323 W. Michigan Avenue, Marshall, MI 49068",
      },
    ],
    // Official: the Commission's own page confirms it meets the 2nd
    // Wednesday of every month, 7 p.m., at City Hall (Oct 14, 2026 is that
    // month's 2nd Wednesday); CitizenPortal (a local-news aggregator)
    // reported the Commission voted to schedule this specific hearing for
    // the 10.5 MW special land use permit on that date.
    sources: [
      { label: "City of Marshall Planning Commission (meets 2nd Wednesday, 7 p.m., City Hall)", url: "https://cityofmarshall.com/271/Planning-Commission" },
      {
        label: "CitizenPortal: Planning commission schedules public hearing for 10.5 MW Marshall solar project",
        url: "https://citizenportal.ai/articles/10012411/Michigan/Calhoun-County/Marshall/Planning-commission-schedules-public-hearing-for-105-MW-Marshall-solar-project",
      },
    ],
    verifiedOn: "2026-10-04",
  },
];

export function localHearingProjects(entries: LocalHearingEntry[] = LOCAL_HEARINGS): NormalizedProject[] {
  return entries.map((e) => {
    const base = {
      matchKey: `local:${e.id}`,
      name: `${e.name} (${e.authority})`,
      projectType: e.projectType,
      fuelType: e.fuelType,
      state: e.state,
      county: e.county,
      capacityValue: e.capacityMw,
      capacityUnit: e.capacityMw != null ? "MW" : null,
      applicant: e.applicant,
      causeSlugs: ["state_local_review" as const],
      causeDetail: e.causeDetail ?? `Waiting on a local land-use decision from the ${e.authority}.`,
      sources: e.sources,
      externalIds: { local: e.id },
    };
    if (e.resolved) {
      return {
        ...base,
        currentStatus: `${e.authority}: ${e.resolved.outcome} (hand-checked ${e.verifiedOn})`,
        currentStage: e.resolved.outcome === "approved" ? "approved_awaiting_construction" : "cancelled",
        dataQualityNote: `Hand-researched local hearing, not auto-updating. Resolved per ${e.resolved.evidence} (checked ${e.verifiedOn}).`,
        reviewStep: null,
        reviewStepAt: null,
      } satisfies NormalizedProject;
    }
    const upcoming = e.hearings.filter((h) => new Date(h.date).getTime() > Date.now());
    return {
      ...base,
      currentStatus: `Pending before the ${e.authority} (hand-checked ${e.verifiedOn})`,
      currentStage: "local_review",
      dataQualityNote: `Hand-researched hearing (${e.city}), not auto-updating: ${e.stateProceeding ? "this state case isn't picked up by the automatic state docket search" : "this project is decided by a city or county body, not a state regulator"}, so it comes from published notices and local reporting, last checked ${e.verifiedOn}. No coordinates are published, so it will not appear on the map until geocoded another way.`,
      reviewStep: upcoming.length > 0 ? "Hearing scheduled" : null,
      reviewStepAt: null,
      hearings: e.hearings.map((h) => ({
        date: new Date(h.date),
        endDate: null,
        label: h.dateFrom ? `${h.label} (date per ${h.dateFrom}; agenda not yet posted)` : h.label,
        location: h.location,
      })),
      hearingDetailsLink: e.sources[0]?.url ?? null,
      commentDeadline: e.commentDeadline && new Date(e.commentDeadline).getTime() > Date.now() ? new Date(e.commentDeadline) : null,
    } satisfies NormalizedProject;
  });
}

export async function ingestLocalHearings(): Promise<{ entries: number; upserted: number; removedResolved: number; errors: { matchKey: string; message: string }[] }> {
  const projects = localHearingProjects();
  if (projects.length === 0) return { entries: 0, upserted: 0, removedResolved: 0, errors: [] };
  // A hand-maintained partial list, so vanished-detection is skipped.
  const { upserted, removedResolved, errors } = await upsertNormalizedProjects(projects, { wasCapped: true, sourcePrefix: "local" });
  return { entries: projects.length, upserted, removedResolved, errors };
}
