import { NextResponse } from "next/server";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { groupProjectsByUtility } from "@/lib/utilityGrouping";
import type { StatusBucket } from "@/lib/data/taxonomies";
import { prisma } from "@/lib/db";
import { hashIp, srcTag } from "@/lib/requestLog";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

// Public, read-only, no key required — same CORS/rate-limit/logging pattern
// as /api/projects (see that route for why). Groups the same underlying
// projects by utility service territory instead of returning them flat —
// see src/lib/utilityGrouping.ts for the known EIA-861 imprecision (a
// project can land under more than one utility).
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

// Query params: same filters as /api/projects (see that route's doc
// comment) — narrows which projects get grouped, same semantics as the
// on-site Utility Company dimension's filters.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const ipHash = hashIp(request);
  prisma.apiRequestLog
    .create({
      data: {
        endpoint: "api_utilities",
        method: "GET",
        userAgent: request.headers.get("user-agent"),
        query: searchParams.toString() || null,
        ipHash,
        src: srcTag(request),
      },
    })
    .catch((err) => console.error("Failed to log /api/utilities request:", err));

  if (await isRateLimited("api_utilities", ipHash, { windowMs: 60_000, max: 60 })) {
    return rateLimitedResponse(60, CORS_HEADERS);
  }

  const status = searchParams.get("status") as StatusBucket | "all" | null;
  const filters = toFilterState({
    state: searchParams.get("state"),
    fuelType: parseList(searchParams.get("fuelType")),
    projectType: parseList(searchParams.get("projectType")),
    stage: parseList(searchParams.get("stage")),
    minYearsWaiting: parseNumber(searchParams.get("minYearsWaiting")),
    minCapacity: parseNumber(searchParams.get("minCapacity")),
    status,
  });

  const filtered = await queryProjects(filters, { allStatuses: status === "all" });
  const groups = groupProjectsByUtility(filtered).map((g) => ({
    utility: g.utility,
    slug: g.slug,
    url: `https://waitingforpower.com/utility/${g.slug}`,
    count: g.count,
    totalCapacityMw: g.totalCapacityMw,
    totalInvestmentWaitingUsd: g.totalInvestment,
    lat: g.lat,
    lon: g.lon,
    projectSlugs: g.projectSlugs,
  }));

  return NextResponse.json(groups, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
