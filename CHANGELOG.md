# Changelog

Changes to WaitingForPower's public data surfaces: the REST API
(`/api/*`, spec at `/openapi.json`), the MCP server at `/mcp`, and the
bulk export. Site-only changes aren't listed here.

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
