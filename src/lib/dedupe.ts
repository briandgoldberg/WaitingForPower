// Cross-source duplicate detection: the same physical project is often listed
// twice, once as an EIA-860M planned generator and once as an interconnection
// queue request (LBNL Queued Up). Ingest keeps both rows updating, so nothing
// is ever deleted or overwritten. Instead the EIA row is *merged into* the
// queue row (Project.mergedIntoId): hidden from lists, totals and search, with
// its sources and best fields shown on the queue row (see overlayMerged).
//
// Rules (v2, checked by hand against ~35 pairs):
//   1. same state, same county, same fuel
//   2. capacity within 15% (6% when nothing but size ties them together)
//   3. timeline is sane: the planned online date is at least ~10 months after
//      the queue request was filed, and a "completed" plant can't match a
//      request filed after it came online
//   4. identity: applicant or project name overlap, OR the only candidate in
//      the county at that size
//   5. one-to-one: the queue row is claimed by a single EIA plant (several
//      units of the same plant may share one queue row)
//   6. neither side is cancelled or no longer reported
//
// Recomputed by /api/cron/dedupe, so it also applies to projects that appear
// later and un-merges a pair if a later ingest breaks a rule.

import { prisma } from "@/lib/db";

const MERGE_SOURCE = "eia";
const CANONICAL_SOURCE = "lbnl";
const MIN_LEAD_MS = 300 * 86_400_000;

export interface MergeRow {
  id: string;
  slug: string;
  name: string;
  state: string | null;
  county: string | null;
  capacityValue: number | null;
  capacityUnit: string | null;
  fuelType: string;
  matchKey: string | null;
  applicant: string | null;
  currentStage: string;
  noLongerReported: boolean;
  applicationFiledDate: Date | null;
  expectedOnlineDate: Date | null;
}

const source = (k: string | null) => (k ?? "").split(":")[0];
const plantOf = (k: string | null) => (k ?? "").split(":")[1]?.split("-")[0] ?? "";
const cn = (x: string | null) => (x ?? "").toLowerCase().replace(/ (county|parish)$/, "").replace(/[^a-z]/g, "");

const STOP = /\b(llc|inc|corp|company|energy|solar|power|lp|holdings|capital|the|of|and|bess|storage|wind|project|center|station|generating)\b|\(unit[^)]*\)|[^a-z0-9 ]/g;
const tokens = (s: string | null) => new Set((s ?? "").toLowerCase().replace(STOP, " ").split(/\s+/).filter((w) => w.length > 2));
function overlaps(a: string | null, b: string | null): boolean {
  const B = tokens(b);
  for (const t of tokens(a)) if (B.has(t)) return true;
  return false;
}

const isDead = (r: MergeRow) => r.currentStage === "cancelled" || r.noLongerReported;

interface Candidate {
  queue: MergeRow;
  nameHit: boolean;
  capDiff: number;
}

function candidatesFor(e: MergeRow, byCounty: Map<string, MergeRow[]>): Candidate[] {
  if (!e.capacityValue || !e.county || !e.state || isDead(e)) return [];
  const pool = byCounty.get(`${e.state}|${cn(e.county)}|${e.fuelType}`) ?? [];
  const out: Candidate[] = [];
  for (const l of pool) {
    if (!l.capacityValue || isDead(l)) continue;
    const capDiff = Math.abs(l.capacityValue - e.capacityValue) / e.capacityValue;
    if (capDiff > 0.15) continue;
    if (l.applicationFiledDate && e.expectedOnlineDate) {
      if (e.expectedOnlineDate.getTime() < l.applicationFiledDate.getTime() + MIN_LEAD_MS) continue;
    }
    if (e.currentStage === "completed" && l.applicationFiledDate && e.expectedOnlineDate && l.applicationFiledDate > e.expectedOnlineDate) continue;
    const nameHit = overlaps(e.applicant, l.applicant) || overlaps(e.name, l.applicant) || overlaps(e.name, l.name);
    out.push({ queue: l, nameHit, capDiff });
  }
  return out;
}

// Pure: returns eiaProjectId -> queueProjectId for every pair that passes the rules.
export function findMerges(rows: MergeRow[]): Map<string, string> {
  const eia = rows.filter((r) => source(r.matchKey) === MERGE_SOURCE);
  const lbnl = rows.filter((r) => source(r.matchKey) === CANONICAL_SOURCE);
  const byCounty = new Map<string, MergeRow[]>();
  for (const l of lbnl) {
    if (!l.county || !l.state) continue;
    const k = `${l.state}|${cn(l.county)}|${l.fuelType}`;
    byCounty.set(k, [...(byCounty.get(k) ?? []), l]);
  }

  const proposed = new Map<string, string>();
  for (const e of eia) {
    const cands = candidatesFor(e, byCounty);
    if (!cands.length) continue;
    const named = cands.filter((c) => c.nameHit).sort((a, b) => a.capDiff - b.capDiff);
    if (named.length) {
      proposed.set(e.id, named[0].queue.id);
      continue;
    }
    if (cands.length === 1 && cands[0].capDiff <= 0.06) proposed.set(e.id, cands[0].queue.id);
  }

  // One-to-one: a queue row may be claimed only by units of a single EIA plant.
  const claimants = new Map<string, Set<string>>();
  const byId = new Map(eia.map((e) => [e.id, e]));
  for (const [eid, qid] of proposed) {
    const plant = plantOf(byId.get(eid)!.matchKey);
    claimants.set(qid, (claimants.get(qid) ?? new Set()).add(plant));
  }
  for (const [eid, qid] of [...proposed]) {
    if ((claimants.get(qid)?.size ?? 0) > 1) proposed.delete(eid);
  }
  return proposed;
}

export async function loadMergeRows(): Promise<MergeRow[]> {
  const select = {
    id: true, slug: true, name: true, state: true, county: true, capacityValue: true, capacityUnit: true,
    fuelType: true, matchKey: true, applicant: true, currentStage: true, noLongerReported: true,
    applicationFiledDate: true, expectedOnlineDate: true,
  } as const;
  const rows: MergeRow[] = [];
  for (const prefix of [`${MERGE_SOURCE}:`, `${CANONICAL_SOURCE}:`]) {
    for (let skip = 0; ; skip += 1000) {
      const page = await prisma.project.findMany({ where: { matchKey: { startsWith: prefix }, isAggregateExample: false }, select, orderBy: { id: "asc" }, skip, take: 1000 });
      rows.push(...page);
      if (page.length < 1000) break;
    }
  }
  return rows;
}

// Recompute merges and write only the differences. Returns counts.
export async function syncMerges(): Promise<{ merged: number; added: number; removed: number }> {
  const rows = await loadMergeRows();
  const want = findMerges(rows);
  const current = await prisma.project.findMany({ where: { mergedIntoId: { not: null } }, select: { id: true, mergedIntoId: true } });
  const have = new Map(current.map((r) => [r.id, r.mergedIntoId as string]));

  let added = 0;
  let removed = 0;
  for (const [id, target] of want) {
    if (have.get(id) === target) continue;
    await prisma.project.update({ where: { id }, data: { mergedIntoId: target } });
    added++;
  }
  for (const id of have.keys()) {
    if (!want.has(id)) {
      await prisma.project.update({ where: { id }, data: { mergedIntoId: null } });
      removed++;
    }
  }
  return { merged: want.size, added, removed };
}

// ---- read-time overlay ----

const RESOLVED = new Set(["approved_awaiting_construction", "under_construction", "completed"]);

interface OverlayBase {
  id: string;
  name: string;
  applicant: string | null;
  expectedOnlineDate: Date | null;
  currentStage: string;
  currentStatus: string;
  sources: { id: number; projectId: string; label: string; url: string }[];
}

// Applies a merged duplicate's best facts onto the row that represents the
// project: the real project name (queue rows are named after the request),
// the developer, the planned online date, a more advanced stage, and the
// duplicate's sources.
export function overlayMerged<T extends OverlayBase>(canonical: T, children: OverlayBase[]): T {
  if (!children.length) return canonical;
  const out = { ...canonical, sources: [...canonical.sources] };
  const seen = new Set(out.sources.map((s) => s.url));
  for (const c of children) {
    for (const s of c.sources) if (!seen.has(s.url)) { seen.add(s.url); out.sources.push({ ...s, projectId: canonical.id }); }
    if (!out.applicant && c.applicant) out.applicant = c.applicant;
    if (!out.expectedOnlineDate && c.expectedOnlineDate) out.expectedOnlineDate = c.expectedOnlineDate;
    if (/interconnection request/i.test(out.name) && !/interconnection request/i.test(c.name)) out.name = c.name.replace(/\s*\(unit [^)]*\)\s*$/i, "").trim();
    if (RESOLVED.has(c.currentStage) && !RESOLVED.has(out.currentStage) && out.currentStage !== "cancelled") {
      out.currentStage = c.currentStage;
      out.currentStatus = c.currentStatus;
    }
  }
  return out;
}

const relations = { causes: true, sources: true, milestones: true } as const;

export async function mergedChildren(ids: string[]) {
  if (!ids.length) return [];
  return prisma.project.findMany({ where: { mergedIntoId: { in: ids } }, include: relations });
}
