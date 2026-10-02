# Changelog

Changes to WaitingForPower's public data surfaces: the REST API
(`/api/*`, spec at `/openapi.json`), the MCP server at `/mcp`, and the
bulk export. Site-only changes aren't listed here.

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
