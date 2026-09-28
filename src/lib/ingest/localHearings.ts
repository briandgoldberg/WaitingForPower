// Hand-researched city and county hearings on energy projects in big metros —
// the planning commissions, city councils and county boards that state
// regulators' dockets (every other module here) never cover, and where most
// big-city energy fights actually happen. A weekly research pass (the Claude
// Code routine that also maintains handResearched.ts) adds and updates
// entries; see ingest/README.md "Local hearings".
//
// Rules for that pass, so the site never shows a hearing that isn't real:
//   - Only a hearing the public can speak at (a public hearing, public
//     comment period at a meeting, or public forum), still ahead, and
//     confirmed on the government body's own page (agenda, hearing notice,
//     or official press release). News coverage can lead you to it but
//     can't confirm it.
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
  resolved?: { outcome: "approved" | "denied" | "withdrawn"; evidence: string };
}

// Empty until the weekly pass confirms one; see the rules above. (Checked
// 2026-09-28: every big-city project hearing found was already past, e.g.
// Covina's June 2026 BESS hearings and Staten Island's May 2024 one.)
export const LOCAL_HEARINGS: LocalHearingEntry[] = [];

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
      causeSlugs: ["local_state_opposition" as const],
      causeDetail: `Waiting on a local land-use decision from the ${e.authority}.`,
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
      dataQualityNote: `Hand-researched local hearing (${e.city}), not auto-updating: this project is decided by a city or county body, not a state regulator, so it comes from that body's own published notice, last checked ${e.verifiedOn}. No coordinates are published, so it will not appear on the map until geocoded another way.`,
      reviewStep: upcoming.length > 0 ? "Hearing scheduled" : null,
      reviewStepAt: null,
      hearings: e.hearings.map((h) => ({ date: new Date(h.date), endDate: null, label: h.label, location: h.location })),
      hearingDetailsLink: e.sources[0]?.url ?? null,
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
