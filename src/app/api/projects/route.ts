import { NextResponse } from "next/server";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { prisma } from "@/lib/db";

// Public, read-only, no key required — CORS is wide open on purpose so
// external tools/agents can call this directly from the browser or a server.
// For agent use via a tool call (rather than a raw HTTP fetch), see the MCP
// server at /mcp — it wraps this same query logic with response sizes
// bounded for a model's context window.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Query params (all optional, combine with AND, same semantics as the
// on-site filter panel — see src/lib/filters.ts):
//   state           USPS code, e.g. "CA"
//   fuelType        comma-separated, e.g. "solar,wind_onshore"
//   projectType     comma-separated, e.g. "generation,storage"
//   stage           comma-separated currentStage values
//   minYearsWaiting number
//   minCapacity     number, MW
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // See src/app/mcp/route.ts's matching ApiRequestLog write for why this
  // exists — no analytics package, and Vercel's CLI log retention here is
  // too short to ever answer "has this been used" without a durable row.
  prisma.apiRequestLog
    .create({
      data: {
        endpoint: "api_projects",
        method: "GET",
        userAgent: request.headers.get("user-agent"),
        query: searchParams.toString() || null,
      },
    })
    .catch((err) => console.error("Failed to log /api/projects request:", err));

  const filters = toFilterState({
    state: searchParams.get("state"),
    fuelType: parseList(searchParams.get("fuelType")),
    projectType: parseList(searchParams.get("projectType")),
    stage: parseList(searchParams.get("stage")),
    minYearsWaiting: parseNumber(searchParams.get("minYearsWaiting")),
    minCapacity: parseNumber(searchParams.get("minCapacity")),
  });

  const filtered = await queryProjects(filters);

  return NextResponse.json(filtered, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
