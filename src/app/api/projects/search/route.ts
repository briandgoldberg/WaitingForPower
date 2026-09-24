import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HEARING_LOOKBACK_DAYS } from "@/lib/data/advocacyPoints";
import { hashIp } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// A lightweight name typeahead for the "I Reached Out!" form's project
// picker (src/components/advocacy/AdvocacyContactForm.tsx) — deliberately
// not routed through queryProjects (src/lib/queryProjects.ts), which fetches
// the entire dataset page by page to stay under Prisma Accelerate's 5MB cap;
// a search-as-you-type box only ever needs a handful of name matches, so a
// direct, narrow query is both simpler and far cheaper per keystroke.
export async function GET(req: NextRequest) {
  const ipHash = hashIp(req);
  if (await isRateLimited("api_projects_search", ipHash, { windowMs: 60_000, max: 60 })) {
    return rateLimitedResponse(60);
  }
  void prisma.apiRequestLog
    .create({ data: { endpoint: "api_projects_search", method: "GET", userAgent: req.headers.get("user-agent"), ipHash } })
    .catch((err) => console.error("Failed to log /api/projects/search request:", err));

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const cutoff = new Date(Date.now() - HEARING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const projects = await prisma.project.findMany({
    where: { mergedIntoId: null, isAggregateExample: false, name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      slug: true,
      name: true,
      state: true,
      hearings: { where: { date: { gte: cutoff, lte: new Date() } }, select: { date: true, label: true }, orderBy: { date: "desc" } },
    },
    orderBy: { name: "asc" },
    take: 8,
  });

  const results = projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    state: p.state,
    hearings: p.hearings.map((h) => ({ date: h.date.toISOString(), label: h.label })),
  }));
  return NextResponse.json({ results });
}
