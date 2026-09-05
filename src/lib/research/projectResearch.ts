// One-time-per-project research pass: reads a project's own docket filings
// (its ProjectSource rows — the same source links already shown on the
// project page) and asks an LLM to (a) synthesize the reasons for and
// against building it that are actually on the record, and (b) pull out
// the most recent public comment period and how to submit a comment, if
// either is published there. Writes straight to the Project row and stamps
// researchedAt so this never re-runs for a project once it's done — see
// the schema.prisma comments on these fields for why this is deliberately
// one-time rather than kept fresh.
//
// Requires ANTHROPIC_API_KEY (see .env.example) — not currently a
// dependency anywhere else in this codebase, so this is the one ingestion
// module that fails outright (per-project, caught and logged, not thrown
// past the batch) if that env var is missing.

import { prisma } from "@/lib/db";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-5";

// Per-source fetched text is capped well before it'd threaten the model's
// context window — these are docket pages, not books, and a few thousand
// words of the actual filing/case page is plenty for an LLM to work with.
const MAX_CHARS_PER_SOURCE = 15_000;
const MAX_SOURCES = 4;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSourceText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text") && !contentType.includes("json")) {
      return null; // don't waste tokens on PDFs/binaries a plain fetch can't usefully render as text
    }
    const raw = await res.text();
    return stripHtml(raw).slice(0, MAX_CHARS_PER_SOURCE);
  } catch {
    return null;
  }
}

interface ResearchResult {
  reasonsFor: string[];
  reasonsAgainst: string[];
  commentPeriodStart: string | null; // YYYY-MM-DD
  commentPeriodEnd: string | null;
  commentLink: string | null;
}

function parseModelJson(text: string): ResearchResult | null {
  // The model is instructed to return bare JSON, but strip a ```json fence
  // if it adds one anyway — cheaper than a stricter response format for a
  // single-shot batch job like this.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1] : text;
  try {
    const parsed = JSON.parse(jsonText.trim());
    return {
      reasonsFor: Array.isArray(parsed.reasonsFor) ? parsed.reasonsFor.filter((s: unknown) => typeof s === "string") : [],
      reasonsAgainst: Array.isArray(parsed.reasonsAgainst)
        ? parsed.reasonsAgainst.filter((s: unknown) => typeof s === "string")
        : [],
      commentPeriodStart: typeof parsed.commentPeriodStart === "string" ? parsed.commentPeriodStart : null,
      commentPeriodEnd: typeof parsed.commentPeriodEnd === "string" ? parsed.commentPeriodEnd : null,
      commentLink: typeof parsed.commentLink === "string" ? parsed.commentLink : null,
    };
  } catch {
    return null;
  }
}

async function callAnthropic(projectSummary: string, sourcesText: string): Promise<ResearchResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const prompt = `You are reading public regulatory-docket material about one energy infrastructure project, gathered from the project's own official filing pages. Your job is strictly extraction and neutral synthesis from THIS text only — never invent or assume anything not actually supported by it.

PROJECT
${projectSummary}

DOCKET TEXT (from its own official source pages)
${sourcesText}

Return ONLY a JSON object, no other text, with this exact shape:
{
  "reasonsFor": string[],       // 0-5 short (<20 words) reasons TO build this project that are actually stated/attributable in the text above (e.g. by the applicant, supportive testimony, economic development findings). Empty array if none are actually present — do not invent generic pro-renewable arguments that aren't in the text.
  "reasonsAgainst": string[],   // same, but reasons AGAINST — objections, opposition comments, county/local resolutions, environmental or land-use concerns, etc., only if actually present in the text.
  "commentPeriodStart": string | null,  // YYYY-MM-DD if the text names an explicit public comment window's start date, else null
  "commentPeriodEnd": string | null,    // YYYY-MM-DD for that window's end/deadline, else null
  "commentLink": string | null  // exactly how the text says to submit a comment — an email address, a web form URL, or a mailing address, verbatim. Null if not stated.
}

Be conservative: an empty array or null is the correct answer whenever the text doesn't actually support a value. Do not pad reasonsFor/reasonsAgainst with boilerplate to fill space.`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") return null;
  return parseModelJson(text);
}

export interface ResearchSummary {
  processed: number;
  updated: number;
  skippedNoSources: number;
  skippedNoText: number;
  errors: { projectId: string; message: string }[];
}

// Processes up to `limit` never-researched projects, oldest-created first
// (so a long backlog shrinks in a stable, visible order rather than being
// picked at random each run). Sequential, not parallel — gentle on both
// the ~40 docket sites this hits and the Anthropic API's own rate limits.
export async function researchProjects(limit: number): Promise<ResearchSummary> {
  const projects = await prisma.project.findMany({
    where: { researchedAt: null },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { sources: true },
  });

  const summary: ResearchSummary = { processed: 0, updated: 0, skippedNoSources: 0, skippedNoText: 0, errors: [] };

  for (const project of projects) {
    summary.processed++;
    try {
      if (project.sources.length === 0) {
        // Nothing to research from — mark done so it doesn't get retried
        // forever, but leave the research fields null.
        await prisma.project.update({ where: { id: project.id }, data: { researchedAt: new Date() } });
        summary.skippedNoSources++;
        continue;
      }

      const texts = await Promise.all(project.sources.slice(0, MAX_SOURCES).map((s) => fetchSourceText(s.url)));
      const sourcesText = project.sources
        .slice(0, MAX_SOURCES)
        .map((s, i) => (texts[i] ? `--- Source: ${s.label} (${s.url}) ---\n${texts[i]}` : null))
        .filter((t): t is string => t !== null)
        .join("\n\n");

      if (!sourcesText) {
        await prisma.project.update({ where: { id: project.id }, data: { researchedAt: new Date() } });
        summary.skippedNoText++;
        continue;
      }

      const projectSummary = [
        `Name: ${project.name}`,
        `Type: ${project.fuelType} ${project.projectType}`,
        project.state ? `Location: ${[project.county, project.state].filter(Boolean).join(", ")}` : null,
        project.capacityValue ? `Capacity: ${project.capacityValue} ${project.capacityUnit ?? ""}`.trim() : null,
        project.applicant ? `Applicant: ${project.applicant}` : null,
        `Current stage: ${project.currentStage}`,
      ]
        .filter(Boolean)
        .join("\n");

      const result = await callAnthropic(projectSummary, sourcesText);

      await prisma.project.update({
        where: { id: project.id },
        data: {
          reasonsFor: result?.reasonsFor ?? [],
          reasonsAgainst: result?.reasonsAgainst ?? [],
          commentPeriodStart: result?.commentPeriodStart ? new Date(result.commentPeriodStart) : null,
          commentPeriodEnd: result?.commentPeriodEnd ? new Date(result.commentPeriodEnd) : null,
          commentLink: result?.commentLink ?? null,
          researchedAt: new Date(),
        },
      });
      summary.updated++;
    } catch (err) {
      // Deliberately does NOT set researchedAt here — a transient fetch/API
      // failure should retry next run, not silently give up on the project.
      summary.errors.push({ projectId: project.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return summary;
}

if (require.main === module) {
  const limit = Number(process.argv[2]) || 10;
  researchProjects(limit)
    .then((summary) => {
      console.log(`Project research complete:`, summary);
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
