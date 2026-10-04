// Real, individually-filed public comments pulled from the California
// Energy Commission's own docket filing index — a different data source
// than caCecDockets.ts's project/status/hearing extraction (same site,
// same docket logs, different rows: this pulls the individual comment
// letters, that module skips them entirely).
//
// Confirmed live 2026-10-04 against efiling.energy.ca.gov/Lists/
// DocketLog.aspx?docketnumber=23-OPT-01 (Fountain Wind Project, a
// contested case): the filings GridView's real "From" column names each
// commenter directly (e.g. "Aaron Burns"), and real comment filing titles
// follow one consistent shape — name/org, then "Comment(s)", then a dash
// or "on"/"regarding" — e.g. "Aaron Burns Comments - Support for the
// Fountain Wind Project", "Native Roots Network Comments - Public Comment
// - Opposing Fountain Wind", "County of Shasta Comments on Application for
// Confidential Designation". That one docket alone carries 700+ real rows
// matching this shape. Procedural filings that merely mention "comment"
// (e.g. "Joint Order Clarifying the Deadline for Public Comment Periods on
// Preliminary Staff Assessment is September 4, 2024") don't have that
// name-then-dash shape and are correctly excluded — confirmed by scanning
// the real docket text for both patterns before picking this regex.
import { prisma } from "@/lib/db";

const EFILING_BASE_URL = "https://efiling.energy.ca.gov";

// See module header: a real commenter's name/org directly followed by
// "Comment(s)" and a dash/on/regarding connector, not "comment" appearing
// incidentally inside a longer procedural title.
const COMMENT_TITLE_RE = /^.{1,80}?\bComments?\b\s*(-|on\b|regarding\b)/i;
// The agency's own staff documents (e.g. "Response to Comments on the ...
// Staff Assessment") can match COMMENT_TITLE_RE too, but aren't a public
// comment — confirmed live: 4 of 721 real matches on Fountain Wind's
// docket were filed by the Commission itself, not a member of the public.
const AGENCY_FROM_RE = /^California Energy Commission$|^CEC\b/i;

// One row of efiling.energy.ca.gov's real #MainContent_grdFilings GridView:
// TN # | Docketed Date | Document Title (<strong><a href>title</a></strong>,
// the <a> optional for rows with no PDF) | Exhibit # | To | From. Captures
// date, the title's href (if any) and text, and the From column — the
// commenter's own name, confirmed live to be a separate real column, not
// something that needs parsing out of the title.
const FILING_ROW_RE =
  /<td>\d+<\/td><td>([^<]*)<\/td><td[^>]*>\s*<span id="MainContent_grdFilings_lblDocumentList_\d+"><strong>(?:<a href="([^"]*)"[^>]*>)?([^<]*)(?:<\/a>)?<\/strong>[\s\S]*?<\/span>\s*<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>([^<]*)<\/td>/g;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface CecCommentsSummary {
  projectsScanned: number;
  commentsFound: number;
  commentsUpserted: number;
}

// Every still-tracked (non-merged) project sourced from a CEC docket —
// read from the already-tracked ProjectSource rows caCecDockets.ts writes
// ("CEC Docket 23-OPT-01" etc.), so a new CEC project picked up by that
// module is automatically in scope here too, no hardcoded docket list.
export async function ingestCaCecComments(): Promise<CecCommentsSummary> {
  const projects = await prisma.project.findMany({
    where: { mergedIntoId: null, sources: { some: { label: { startsWith: "CEC Docket " } } } },
    select: { id: true, sources: { where: { label: { startsWith: "CEC Docket " } }, select: { label: true }, take: 1 } },
  });

  let commentsFound = 0;
  let commentsUpserted = 0;

  for (const p of projects) {
    const docketNumber = p.sources[0]?.label.replace(/^CEC Docket\s+/, "").trim();
    if (!docketNumber) continue;

    const url = `${EFILING_BASE_URL}/Lists/DocketLog.aspx?docketnumber=${encodeURIComponent(docketNumber)}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const html = await res.text();

    for (const m of html.matchAll(FILING_ROW_RE)) {
      const [, dateRaw, href, titleRaw, fromRaw] = m;
      const title = decodeHtmlEntities(titleRaw);
      if (!COMMENT_TITLE_RE.test(title)) continue;
      const filerName = decodeHtmlEntities(fromRaw) || null;
      if (filerName && AGENCY_FROM_RE.test(filerName)) continue;
      const filedDate = parseMDY(dateRaw);
      if (!filedDate || !href) continue;
      commentsFound++;

      await prisma.publicComment.upsert({
        where: { projectId_sourceUrl: { projectId: p.id, sourceUrl: href } },
        create: { projectId: p.id, filedDate, filerName, title, sourceUrl: href, docketLabel: docketNumber, origin: "ca_cec" },
        update: { filedDate, filerName, title },
      });
      commentsUpserted++;
    }
  }

  return { projectsScanned: projects.length, commentsFound, commentsUpserted };
}
