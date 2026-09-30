// Hand-verified, sourced opposition to tracked projects: parties that formally
// intervened in a docket, local government votes and moratoria, lawsuits,
// and organized groups. Loaded daily by /api/cron/ingest-opposition into
// ProjectOpposition (see schema.prisma), which the project page shows under
// its Opposition pill and each state's contested-projects page lists. The
// weekly hand-research routine adds entries; see ingest/README.md
// "Opposition".
//
// Rules for that pass, so the site never calls a project opposed without
// showing why:
//   - Every record needs a public source that says it directly: the docket's
//     own filing or service list for an intervenor, the body's minutes,
//     agenda or press release for a vote or moratorium, the court docket or
//     a named news outlet for a lawsuit, the group's own site or a named news
//     outlet for an organized group, or the Sabin Center's "Opposition to
//     Renewable Energy Facilities in the United States" report (origin
//     "sabin_center"; cite the edition).
//   - Name organizations and government bodies only. Never name a private
//     individual, even one who intervened or sued in their own name; write
//     "Nearby landowners" or "A group of residents" instead.
//   - State what happened, not motives: "Petitioned to intervene", "Voted
//     5-2 to deny the special-use permit", "Sued to overturn the certificate".
//     No adjectives, no characterizing the opposition or the project.
//   - A party that intervened only to support the project, or a neutral
//     party such as commission staff or the state consumer advocate, is not
//     opposition. Leave it out.
//   - `project` is the project's slug from its page URL
//     (waitingforpower.com/project/<slug>), or its matchKey (contains ":")
//     for projects defined in this repo, e.g. "local:<id>" from
//     localHearings.ts. A slug merged into another project resolves to it.
//   - This file owns every ProjectOpposition row: a project dropped from
//     this list loses its records on the next run.

import { prisma } from "@/lib/db";
import type { OppositionKind } from "@/lib/types";

export type OppositionOrigin = "hand_research" | "sabin_center" | "docket";

export interface OppositionRecord {
  kind: OppositionKind;
  party: string;
  action: string;
  date?: string; // YYYY-MM-DD, when the source gives one
  source: { label: string; url: string };
  origin: OppositionOrigin;
}

export interface OppositionEntry {
  project: string; // slug or matchKey, see the rules above
  verifiedOn: string; // YYYY-MM-DD, the date the sources were last read
  records: OppositionRecord[];
}

export const OPPOSITION: OppositionEntry[] = [];

export const OPPOSITION_CAUSE = "local_state_opposition";

async function findProjectId(ref: string): Promise<string | null> {
  const where = ref.includes(":") ? { matchKey: ref } : { slug: ref };
  const p = await prisma.project.findUnique({ where, select: { id: true, mergedIntoId: true } });
  if (!p) return null;
  return p.mergedIntoId ?? p.id;
}

export async function ingestOpposition(entries: OppositionEntry[] = OPPOSITION): Promise<{
  entries: number;
  projects: number;
  records: number;
  cleared: number;
  errors: { project: string; message: string }[];
}> {
  const errors: { project: string; message: string }[] = [];
  // Several entries can resolve to the same project (a slug and its merged
  // duplicate); their records are combined.
  const byProject = new Map<string, { records: OppositionRecord[]; verifiedOn: Date }>();
  for (const e of entries) {
    const id = await findProjectId(e.project);
    if (!id) {
      errors.push({ project: e.project, message: "No project with this slug or matchKey" });
      continue;
    }
    const prev = byProject.get(id);
    byProject.set(id, { records: [...(prev?.records ?? []), ...e.records], verifiedOn: new Date(e.verifiedOn) });
  }

  let records = 0;
  for (const [projectId, { records: rs, verifiedOn }] of byProject) {
    await prisma.$transaction([
      prisma.projectOpposition.deleteMany({ where: { projectId } }),
      prisma.projectOpposition.createMany({
        data: rs.map((r) => ({
          projectId,
          kind: r.kind,
          party: r.party,
          action: r.action,
          date: r.date ? new Date(`${r.date}T00:00:00Z`) : null,
          sourceLabel: r.source.label,
          sourceUrl: r.source.url,
          origin: r.origin,
          verifiedOn,
        })),
      }),
      prisma.projectCause.upsert({
        where: { projectId_causeSlug: { projectId, causeSlug: OPPOSITION_CAUSE } },
        create: { projectId, causeSlug: OPPOSITION_CAUSE },
        update: {},
      }),
    ]);
    records += rs.length;
  }

  // Projects no longer on the list lose their records and the cause tag.
  const keep = [...byProject.keys()];
  const stale = await prisma.projectOpposition.findMany({
    where: { projectId: { notIn: keep } },
    select: { projectId: true },
    distinct: ["projectId"],
  });
  const staleIds = stale.map((s) => s.projectId);
  if (staleIds.length > 0) {
    await prisma.projectOpposition.deleteMany({ where: { projectId: { in: staleIds } } });
  }
  // Also clears a tag left on a project with no records at all.
  await prisma.projectCause.deleteMany({ where: { causeSlug: OPPOSITION_CAUSE, projectId: { notIn: keep } } });

  return { entries: entries.length, projects: byProject.size, records, cleared: staleIds.length, errors };
}
