# Changelog

Changes to WaitingForPower's public data surfaces: the REST API
(`/api/*`, spec at `/openapi.json`), the MCP server at `/mcp`, and the
bulk export. Site-only changes aren't listed here.

## 2026-10-03 — Removed points/leaderboard; Board gains utility/project tagging

OpenAPI spec 1.5.0

- **Removed:** the entire points/leaderboard system. "I Reached Out!" (project-page
  advocacy logging via `GET`/`POST /api/comments`, and the `/policies` official-contact
  form via `POST /api/advocacy-contacts`) is gone, along with `GET /api/community` and
  `GET /api/advocacy-feed`. The `log_project_advocacy` and `report_advocacy_contact`
  MCP tools are removed. Nothing reads or writes `AdvocacyContact` or the advocacy
  columns on `ProjectComment` (`advocacyType`, `hearingDate`, `stance`) anymore — the
  columns/table stay in the schema (historical data, no migration), just unused.
- **Added:** `ForumTopic` (the Message Board) gains two optional tags alongside its
  existing `issues`: `utilitySlug` (validated against `GET /api/utilities`' live slug
  set) and `projectSlug` (validated against a live, non-merged project). Any
  combination, or none. `GET /api/forum/topics` gains an optional `utility` filter
  param; each topic item gains `utilitySlug`, `projectSlug`, and `projectName`.
- The Board itself is unaffected otherwise — it never had points or a leaderboard.

## 2026-10-02 — New `/api/utilities` endpoint

OpenAPI spec 1.4.0

- **Added:** `GET /api/utilities` — the same tracked projects grouped by utility
  service territory (EIA-861 county-to-utility data) instead of returned flat. One
  object per utility: `utility`, `slug`, `url`, `count`, `totalCapacityMw`,
  `totalInvestmentWaitingUsd`, a centroid `lat`/`lon` (of this utility's own tracked
  projects, not its real service territory), and `projectSlugs` to cross-reference
  against `/api/projects`. Same optional filter params as `/api/projects`
  (`state`, `fuelType`, `projectType`, `stage`, `minYearsWaiting`, `minCapacity`,
  `status`). Mirrors the site's new Utility Company view at `/utilities` and
  `/utility/{slug}` — see `src/lib/utilityGrouping.ts` for the known imprecision
  (a county often lists several utilities, so a project can land under more than
  one utility's group).

## 2026-10-02 — Status history in the API and MCP server

MCP server 1.6.0 · OpenAPI spec 1.3.0

- **Added:** `statusHistory` on every project from `/api/projects`, `/api/export`, and
  the MCP server's `get_project` — hand-sourced milestones merged with this site's own
  detected stage/status changes, chronological (oldest first). Same data and logic the
  project page's Timeline tab now shows (`src/lib/projectTimeline.ts`), so the API and
  the website never drift apart on "what happened and when."
- Each entry: `date`, `label` (what happened, e.g. a milestone description or a
  change summary), `sub` (a short stage/change-type tag, nullable), `approximate`
  (true only for hand-sourced milestones whose date is estimated).
- Filtered to real transitions — a changeType of `new`, `advanced`, `resolved`,
  `no_longer_reported`, `reappeared`, or `new_filing`. Rows whose only detected change
  was `fact_revised` (a field value correction, not a status change) are excluded: some
  sources' values flap day to day without the project's actual status changing at all,
  which would otherwise drown real history in noise.
- `get_project`'s and `search_projects`' tool descriptions updated to mention it;
  `search_projects` summaries are unchanged (statusHistory is detail-only, like
  `milestones`).

## 2026-09-30 — Hearings and opposition in the API and MCP server

MCP server 1.5.0 · OpenAPI spec 1.2.0

- **Fixed:** projects returned by `/api/projects`, `/api/export`, `/api/snapshots` and the
  MCP tools (`search_projects`, `get_project`, `get_stats`) always had empty `hearings`
  and `opposition` arrays, even where the project page showed records. Both are now
  filled in.
- **`opposition`** — sourced records, newest first: `kind` (`intervenor`,
  `local_government`, `lawsuit`, `moratorium`, `organized_group`), `party`, `action`,
  `date`, `sourceLabel`, `sourceUrl`. An empty array means none were found, not that
  nobody objects.
- **`hearings`** — public hearings on file, past and upcoming: `date`, `endDate`, `label`,
  `location`.
- **`search_projects`** summaries add `oppositionCount` and `nextHearingDate`.
- **CSV export** adds an `opposition_count` column.
- Snapshots captured before this date keep the empty arrays they were saved with.
