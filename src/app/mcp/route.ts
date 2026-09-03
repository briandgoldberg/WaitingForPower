// Remote MCP server exposing the WaitingForPower dataset as tools an agent
// can call directly, rather than fetching and filtering raw JSON itself.
// Point an MCP-capable client (Claude, etc.) at this route's URL
// (https://waitingforpower.com/mcp) to connect. See also /llms.txt and the
// plain REST API at /api/projects, which this shares its query logic with
// (src/lib/queryProjects.ts).

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { queryProjects, getProjectBySlug, toFilterState } from "@/lib/queryProjects";
import { computeAggregateStats } from "@/lib/stats";
import { CAUSE_CATEGORIES } from "@/lib/data/causeCategories";
import { POLICIES } from "@/lib/data/policies";
import { STATE_NAMES } from "@/lib/data/usStates";
import { prisma } from "@/lib/db";

const FUEL_TYPES = [
  "solar",
  "wind_onshore",
  "wind_offshore",
  "storage",
  "gas",
  "nuclear",
  "hydro",
  "lng",
  "pipeline",
  "transmission",
  "geothermal",
  "other",
] as const;

const PROJECT_TYPES = ["generation", "transmission", "storage", "lng", "pipeline"] as const;

const PROJECT_STAGES = [
  "interconnection_study",
  "environmental_review",
  "planned_pre_filing",
  "regulatory_approvals_pending",
  "agency_permitting",
  "local_review",
  "litigation",
] as const;

const STATUSES = ["in_permitting", "cancelled_suspended", "permits_complete", "no_longer_reported", "all"] as const;

// Trimmed per-project shape for list results — full detail (sources,
// milestones) is a lot of tokens across dozens of results; get_project
// fetches the complete record for one project once an agent has a slug.
function toSummary(p: Awaited<ReturnType<typeof queryProjects>>[number]) {
  return {
    slug: p.slug,
    name: p.name,
    projectType: p.projectType,
    fuelType: p.fuelType,
    state: p.state,
    capacityValue: p.capacityValue,
    capacityUnit: p.capacityUnit,
    currentStage: p.currentStage,
    causeSlugs: p.causeSlugs,
    yearsWaiting: p.yearsWaiting,
    verificationStatus: p.verificationStatus,
  };
}

const searchFilterShape = {
  state: z
    .string()
    .length(2)
    .describe('USPS state code, e.g. "CA". Omit for all states.')
    .optional(),
  fuelType: z.array(z.enum(FUEL_TYPES)).describe("Filter to one or more fuel/technology types.").optional(),
  projectType: z.array(z.enum(PROJECT_TYPES)).describe("Filter to one or more project types.").optional(),
  stage: z
    .array(z.enum(PROJECT_STAGES))
    .describe("Filter to one or more current permitting stages.")
    .optional(),
  minYearsWaiting: z.number().min(0).describe("Only projects waiting at least this many years.").optional(),
  minCapacity: z.number().min(0).describe("Only projects with capacity at least this many MW.").optional(),
  status: z
    .enum(STATUSES)
    .describe(
      'Which status bucket to search. Defaults to "in_permitting" (the site\'s original "still waiting" scope) if omitted — pass "permits_complete", "cancelled_suspended", "no_longer_reported", or "all" to reach approved, cancelled, or untracked-by-source projects too.',
    )
    .optional(),
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_projects",
      {
        title: "Search energy projects",
        description:
          "Search the WaitingForPower dataset of U.S. energy projects (generation, transmission, storage, LNG, pipelines) currently stuck waiting on permitting approval. Returns a paginated summary; call get_project with a slug for full detail (sources, milestone timeline).",
        inputSchema: z.object({
          ...searchFilterShape,
          limit: z.number().int().min(1).max(100).default(20).describe("Max results to return (1-100)."),
          offset: z.number().int().min(0).default(0).describe("Number of matching results to skip, for paging."),
        }),
      },
      async ({ state, fuelType, projectType, stage, minYearsWaiting, minCapacity, status, limit, offset }) => {
        const filters = toFilterState({
          state,
          fuelType,
          projectType,
          stage,
          minYearsWaiting,
          minCapacity,
          status,
        });
        const all = await queryProjects(filters, { allStatuses: status === "all" });
        const page = all.slice(offset, offset + limit).map(toSummary);
        const result = { totalMatches: all.length, offset, limit, results: page };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      "get_project",
      {
        title: "Get project detail",
        description:
          "Full detail for one WaitingForPower project by slug — cited sources, milestone timeline, capacity, and estimated investment waiting. Get a slug from search_projects first.",
        inputSchema: z.object({
          slug: z.string().describe("Project slug, as returned by search_projects."),
        }),
      },
      async ({ slug }) => {
        const project = await getProjectBySlug(slug);
        if (!project) {
          return {
            content: [{ type: "text", text: `No project found with slug "${slug}".` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
          structuredContent: project,
        };
      },
    );

    server.registerTool(
      "get_stats",
      {
        title: "Get aggregate stats",
        description:
          "Headline aggregate numbers (project count, capacity waiting, clean-energy capacity waiting, estimated investment waiting) for the WaitingForPower dataset, optionally scoped by the same filters as search_projects.",
        inputSchema: z.object(searchFilterShape),
      },
      async ({ state, fuelType, projectType, stage, minYearsWaiting, minCapacity, status }) => {
        const filters = toFilterState({ state, fuelType, projectType, stage, minYearsWaiting, minCapacity, status });
        const filtered = await queryProjects(filters, { allStatuses: status === "all" });
        const stats = computeAggregateStats(filtered);
        return {
          content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
          structuredContent: stats,
        };
      },
    );

    server.registerTool(
      "list_causes",
      {
        title: "List delay cause categories",
        description:
          "The fixed set of structural bottleneck categories (interconnection queue backlog, NEPA review, multi-agency permitting, transmission siting, litigation, local/state opposition, financing/supply chain) every tracked project's delay is mapped to — with a neutral description of each.",
        inputSchema: z.object({}),
      },
      async () => {
        const causes = CAUSE_CATEGORIES.map((c) => ({
          slug: c.slug,
          label: c.label,
          description: c.description,
          isControlGroup: c.isControlGroup ?? false,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(causes, null, 2) }],
          structuredContent: { causes },
        };
      },
    );

    server.registerTool(
      "list_policies",
      {
        title: "List permitting reform policy proposals",
        description:
          "WaitingForPower's six bipartisan permitting-reform policy proposals, one per structural cause category — each with a summary, strengths, weaknesses, and related bills. This is the site's argued position, distinct from the neutral cause categories in list_causes.",
        inputSchema: z.object({}),
      },
      async () => {
        const policies = POLICIES.map((p) => ({
          slug: p.slug,
          title: p.title,
          oneLiner: p.oneLiner,
          summary: p.summary,
          strengths: p.strengths,
          weaknesses: p.weaknesses,
          bills: p.bills,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(policies, null, 2) }],
          structuredContent: { policies },
        };
      },
    );

    server.registerTool(
      "list_states",
      {
        title: "List states with tracked projects",
        description: "USPS state codes and full names usable as the `state` filter in other tools.",
        inputSchema: z.object({}),
      },
      async () => {
        return {
          content: [{ type: "text", text: JSON.stringify(STATE_NAMES, null, 2) }],
          structuredContent: STATE_NAMES,
        };
      },
    );
  },
  {
    serverInfo: { name: "waitingforpower", version: "1.0.0" },
  },
);

// Durable usage logging (ApiRequestLog) — this project has no analytics
// package and Vercel's CLI log retention here is only ~20 minutes with no
// Log Drains configured, so without a DB row there was no way to ever
// answer "has an agent used this" even a day later, let alone feed the
// daily digest email (src/app/api/cron/daily-digest). User-Agent is the
// one signal likely to distinguish a real MCP client from a browser
// hitting this URL directly. Logging failures are swallowed — a broken
// log write must never break the actual MCP response.
async function loggedHandler(req: Request) {
  prisma.apiRequestLog
    .create({ data: { endpoint: "mcp", method: req.method, userAgent: req.headers.get("user-agent") } })
    .catch((err) => console.error("Failed to log MCP request:", err));
  return handler(req);
}

export { loggedHandler as GET, loggedHandler as POST };
