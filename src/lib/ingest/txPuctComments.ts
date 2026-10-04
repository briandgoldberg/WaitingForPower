// Real, individually-filed public comments pulled from the Texas Public
// Utility Commission's own docket filing index (PUC Interchange) — same
// idea as caCecComments.ts, different source. Confirmed live 2026-10-04
// against real TX PUCT dockets (interchange.puc.texas.gov/search/filings/
// ?ControlNumber={n}&UtilityType=E, the same filings list txPuctDockets.ts
// already fetches for status/resolution — this reads the same rows for a
// different purpose): each filing has an "Item Type" code, and two of
// those codes carry real public input, confirmed by actual row content —
// "COM" (e.g. "Sierra Club Lone Star Chapter and Golden Triangle Regional
// Group" — "Comments on ETI's proposed renewable plan and suggestions for
// improvement") and "PC" (e.g. "Lone Star College" — "Support Letter for
// Entergy's filing"). The "Party" column is the real filer name/org
// directly, same as CEC's "From" column. Other item-type codes (LTRS, PL,
// TEST, CONF, MISC, PRJ, RFI, TRAN, BR) are procedural/party filings, not
// public input — left out.
import { prisma } from "@/lib/db";

const BASE_URL = "https://interchange.puc.texas.gov";
const COMMENT_ITEM_TYPES = new Set(["COM", "PC"]);

// Same row shape txPuctDockets.ts's own FILING_ROW_RE matches (item
// number | file stamp | party | item type | description), reused here
// rather than re-exported since this module needs the party/description
// text that one throws away.
const FILING_ROW_RE =
  /<tr>\s*<td>\s*<strong>\s*<a href="[^"]*itemNumber=(\d+)"[^>]*>\d+<\/a>\s*<\/strong>\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/g;

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

function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface TxCommentsSummary {
  projectsScanned: number;
  commentsFound: number;
  commentsUpserted: number;
}

// Every still-tracked (non-merged) project sourced from a TX PUCT docket —
// read from the ProjectSource rows txPuctDockets.ts already writes ("Texas
// PUCT Docket No. 56865" etc.), so a new TX project that module picks up
// is automatically in scope here too.
export async function ingestTxPuctComments(): Promise<TxCommentsSummary> {
  const projects = await prisma.project.findMany({
    where: { mergedIntoId: null, sources: { some: { label: { startsWith: "Texas PUCT Docket No. " } } } },
    select: { id: true, sources: { where: { label: { startsWith: "Texas PUCT Docket No. " } }, select: { label: true }, take: 1 } },
  });

  let commentsFound = 0;
  let commentsUpserted = 0;

  for (const p of projects) {
    const controlNumber = p.sources[0]?.label.replace(/^Texas PUCT Docket No\.\s*/, "").trim();
    if (!controlNumber || !/^\d+$/.test(controlNumber)) continue;

    const url = `${BASE_URL}/search/filings/?ControlNumber=${controlNumber}&UtilityType=E`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const html = await res.text();

    for (const m of html.matchAll(FILING_ROW_RE)) {
      const [, itemNumber, dateRaw, partyRaw, itemTypeRaw, descRaw] = m;
      const itemType = stripTags(itemTypeRaw);
      if (!COMMENT_ITEM_TYPES.has(itemType)) continue;
      const filedDate = parseMDY(stripTags(dateRaw));
      if (!filedDate) continue;
      commentsFound++;

      const filerName = stripTags(partyRaw) || null;
      const title = stripTags(descRaw) || `${itemType === "PC" ? "Public comment" : "Comments"} (Item ${itemNumber})`;
      const sourceUrl = `${BASE_URL}/search/documents/?controlNumber=${controlNumber}&itemNumber=${itemNumber}`;

      await prisma.publicComment.upsert({
        where: { projectId_sourceUrl: { projectId: p.id, sourceUrl } },
        create: { projectId: p.id, filedDate, filerName, title, sourceUrl, docketLabel: controlNumber, origin: "tx_puct" },
        update: { filedDate, filerName, title },
      });
      commentsUpserted++;
    }
  }

  return { projectsScanned: projects.length, commentsFound, commentsUpserted };
}
