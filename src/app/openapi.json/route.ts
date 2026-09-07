// Machine-readable spec for the plain REST surface (not the MCP server,
// which is self-describing via its own tool schemas already) — lets an
// agent that's never seen this API self-configure against it rather than
// relying on prose in /methodology or /llms.txt. Hand-written rather than
// generated: this project has no OpenAPI-generation step in its build, and
// the REST surface is small and stable enough that keeping this in sync by
// hand (same discipline as /llms-full.txt reusing source-of-truth modules
// where the shape is dynamic) is simpler than adding a generator dependency.

import { NextResponse } from "next/server";

const FUEL_TYPES = [
  "solar", "wind_onshore", "wind_offshore", "storage", "gas", "nuclear",
  "hydro", "lng", "pipeline", "transmission", "geothermal", "other",
];
const PROJECT_TYPES = ["generation", "transmission", "storage", "lng", "pipeline"];
const PROJECT_STAGES = [
  "interconnection_study", "environmental_review", "planned_pre_filing",
  "regulatory_approvals_pending", "agency_permitting", "local_review",
  "litigation", "approved_awaiting_construction", "under_construction",
  "cancelled", "completed",
];
const STATUSES = ["in_permitting", "cancelled_suspended", "permits_complete", "no_longer_reported", "all"];

const filterParams = [
  { name: "state", in: "query", schema: { type: "string", minLength: 2, maxLength: 2 }, description: 'USPS state code, e.g. "CA".' },
  { name: "fuelType", in: "query", schema: { type: "string" }, description: `Comma-separated. One or more of: ${FUEL_TYPES.join(", ")}.` },
  { name: "projectType", in: "query", schema: { type: "string" }, description: `Comma-separated. One or more of: ${PROJECT_TYPES.join(", ")}.` },
  { name: "stage", in: "query", schema: { type: "string" }, description: `Comma-separated. One or more of: ${PROJECT_STAGES.join(", ")}.` },
  { name: "minYearsWaiting", in: "query", schema: { type: "number", minimum: 0 } },
  { name: "minCapacity", in: "query", schema: { type: "number", minimum: 0 }, description: "Minimum capacity in MW." },
  { name: "status", in: "query", schema: { type: "string", enum: STATUSES }, description: 'Defaults to "in_permitting".' },
];

const projectSchema = {
  type: "object",
  description: "See https://waitingforpower.com/llms-full.txt for the full field reference.",
  properties: {
    slug: { type: "string" },
    name: { type: "string" },
    projectType: { type: "string", enum: PROJECT_TYPES },
    fuelType: { type: "string", enum: FUEL_TYPES },
    state: { type: "string", nullable: true },
    capacityValue: { type: "number", nullable: true },
    capacityUnit: { type: "string", nullable: true },
    currentStage: { type: "string", enum: PROJECT_STAGES },
    causeSlugs: { type: "array", items: { type: "string" } },
    yearsWaiting: { type: "number", nullable: true },
    verificationStatus: { type: "string", enum: ["verified", "user_submitted_pending", "user_submitted_verified"] },
  },
};

const spec = {
  openapi: "3.1.0",
  info: {
    title: "WaitingForPower API",
    version: "1.0.0",
    description:
      "Read-only REST access to WaitingForPower's tracked U.S. energy permitting projects. CORS-open, no API key required. " +
      "See https://waitingforpower.com/llms.txt for the full list of machine-readable surfaces (including the MCP server), " +
      "and https://waitingforpower.com/data-licensing for per-source redistribution terms.",
    license: { name: "See /data-licensing (varies by underlying source)" },
  },
  servers: [{ url: "https://waitingforpower.com" }],
  paths: {
    "/api/projects": {
      get: {
        summary: "Search tracked projects",
        parameters: filterParams,
        responses: {
          "200": {
            description: "Matching projects (filtered, not paginated — see /api/export for the full dataset in one request).",
            content: { "application/json": { schema: { type: "array", items: projectSchema } } },
          },
        },
      },
    },
    "/api/changes": {
      get: {
        summary: "Recent project changes (new filings, stage advances, resolutions, capacity revisions)",
        parameters: [
          { name: "state", in: "query", schema: { type: "string", minLength: 2, maxLength: 2 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          "200": {
            description: "One row per project per day something changed — not a full audit log.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    changes: { type: "array", items: { type: "object" } },
                    hasMore: { type: "boolean" },
                    nextOffset: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/export": {
      get: {
        summary: "Bulk export of every project matching the given filters (default: everything in the default status bucket)",
        parameters: [
          ...filterParams,
          { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"], default: "json" } },
        ],
        responses: {
          "200": {
            description: "The full matching set in one response — CSV is a flattened summary (see /data-licensing), JSON mirrors /api/projects exactly.",
            content: {
              "application/json": { schema: { type: "object", properties: { exportedAt: { type: "string" }, count: { type: "integer" }, projects: { type: "array", items: projectSchema } } } },
              "text/csv": { schema: { type: "string" } },
            },
          },
        },
      },
    },
    "/api/snapshots": {
      get: {
        summary: "List available point-in-time dataset snapshots (metadata only)",
        responses: {
          "200": {
            description: "Monthly captures, kept indefinitely, for citing an exact past state rather than today's live numbers.",
            content: {
              "application/json": {
                schema: { type: "object", properties: { snapshots: { type: "array", items: { type: "object", properties: { id: { type: "string", example: "2026-09-01" }, createdAt: { type: "string" }, projectCount: { type: "integer" } } } } } },
              },
            },
          },
        },
      },
    },
    "/api/snapshots/{id}": {
      get: {
        summary: "Fetch one full snapshot by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "2026-09-01" } }],
        responses: {
          "200": {
            description: "The full snapshot, including every project's serialized data at capture time.",
            content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" }, createdAt: { type: "string" }, projectCount: { type: "integer" }, data: { type: "array", items: projectSchema } } } } },
          },
          "404": { description: "No snapshot exists for that id." },
        },
      },
    },
  },
};

export function GET() {
  return NextResponse.json(spec);
}
