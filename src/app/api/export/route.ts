import { NextResponse } from "next/server";
import { queryProjects, toFilterState } from "@/lib/queryProjects";
import { projectsToCsv } from "@/lib/exportCsv";
import type { StatusBucket } from "@/lib/data/taxonomies";
import { prisma } from "@/lib/db";

// Bulk export — the full dataset in one request, for researchers/journalists
// doing their own offline analysis rather than paging through /api/projects
// (capped there at whatever a caller sets, with no single "give me
// everything" shape). Same filter params and defaults as /api/projects
// (see that route's own comment) so the two stay predictable together —
// this isn't a separate query language, just a different output shape.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: 'format must be "json" or "csv"' }, { status: 400 });
  }

  prisma.apiRequestLog
    .create({
      data: {
        endpoint: "api_export",
        method: "GET",
        userAgent: request.headers.get("user-agent"),
        query: searchParams.toString() || null,
      },
    })
    .catch((err) => console.error("Failed to log /api/export request:", err));

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

  const projects = await queryProjects(filters, { allStatuses: status === "all" });
  const today = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    return new NextResponse(projectsToCsv(projects), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="waitingforpower-export-${today}.csv"`,
      },
    });
  }

  return NextResponse.json(
    { exportedAt: new Date().toISOString(), count: projects.length, projects },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
