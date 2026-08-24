# Ingestion modules

One module per data source, each normalizing into the shared
`NormalizedProject` shape (`common.ts`) and upserting into the Prisma
schema. This project deliberately sticks to **updatable data sources** —
no hand-curated one-off research (an earlier version of this project
shipped a small hand-researched seed set; it was removed in favor of
sources that can be re-run and stay current on their own).

| Module | Source | Live API? | Auth needed | Scheduled? |
|---|---|---|---|---|
| `eia860mPlanned.ts` | EIA-860M "Planned" generator inventory | Yes — monthly Excel workbook, auto-discovered | Free API key not required for this module (see `eia.ts` below for the one that does) | Cron weekly (13:00 UTC Sundays), `/api/cron/ingest-eia` |
| `permittingDashboard.ts` | Federal Permitting Dashboard (FAST-41) | Yes — public Socrata endpoint | None found needed | Cron weekly (14:00 UTC Sundays), `/api/cron/ingest-permitting-dashboard` |
| `lbnlQueuedUp.ts` | LBNL Queued Up | Yes — annual Excel workbook, scraped off the landing page | None (no auth, just a browser-like User-Agent — see file header) | Cron weekly (15:00 UTC Sundays), `/api/cron/ingest-lbnl`, even though LBNL itself only republishes ~annually — see file header for why checking this still makes sense |
| `ornlHydropowerRelicensing.ts` | ORNL HydroSource hydropower relicensing/license-surrender dataset | Yes — annual Excel workbook, edition-year page auto-discovered then scraped, same two-step pattern as LBNL | None (no auth, just a browser-like User-Agent) | Cron weekly (16:00 UTC Sundays), `/api/cron/ingest-ornl-hydro`, same "cheap periodic check of an annual source" rationale as LBNL |
| `eiaPipelineProjects.ts` | EIA "Natural Gas Pipeline Projects" tracker | Yes — quarterly Excel workbook, scraped off the landing page (naming convention itself isn't consistent — see file header) | None (no auth) | Cron weekly (17:00 UTC Sundays), `/api/cron/ingest-eia-pipelines` |
| `eia.ts` | EIA API v2 `operating-generator-capacity` | Yes | Free API key | **Superseded, do not run** — see file header. This route only covers already-operating plants; `eia860mPlanned.ts` replaced it. |
| `vaSccDockets.ts` | Virginia State Corporation Commission (SCC) CPCN dockets | Yes — public Breeze/OData JSON API, no auth | None (no auth) | Cron weekly (18:00 UTC Sundays), `/api/cron/ingest-va-scc`. |
| `txPuctDockets.ts` | Texas Public Utility Commission (PUCT) CCN dockets | Yes — server-rendered HTML, no auth | None (no auth) | Cron weekly (18:30 UTC Sundays), `/api/cron/ingest-tx-puct`. |
| `coPucDockets.ts` | Colorado Public Utilities Commission (PUC) CPCN dockets | Yes — server-rendered HTML (Oracle PL/SQL web gateway), no auth | None (no auth) | Cron weekly (19:00 UTC Sundays), `/api/cron/ingest-co-puc`. |
| `ohOpsbCases.ts` | Ohio Power Siting Board (OPSB) cases | Yes — single JSON endpoint, no auth | None (no auth) | Cron weekly (19:30 UTC Sundays), `/api/cron/ingest-oh-opsb`. |
| `scPscDockets.ts` | South Carolina Public Service Commission (PSC) siting-certificate dockets | Yes — server-rendered HTML, no auth | None (no auth) | Cron weekly (20:00 UTC Sundays), `/api/cron/ingest-sc-psc`. |
| `azAccLineSiting.ts` | Arizona Corporation Commission (ACC) Line Siting Committee dockets | Yes — real JSON API, no auth | None (no auth) | Cron weekly (20:30 UTC Sundays), `/api/cron/ingest-az-acc`. |
| `waEfsecFacilities.ts` | Washington Energy Facility Site Evaluation Council (EFSEC) facility site-certifications | Yes — server-rendered HTML, no auth | None (no auth) | Cron weekly (21:00 UTC Sundays), `/api/cron/ingest-wa-efsec`. |
| `nmPrcDockets.ts` | New Mexico Public Regulation Commission (PRC) CCN dockets | Yes — real JSON API, no auth | None (no auth) | Cron weekly (21:30 UTC Sundays), `/api/cron/ingest-nm-prc`. |
| `ilIccDockets.ts` | Illinois Commerce Commission (ICC) CPCN dockets | Yes — server-rendered HTML, no auth | None (no auth) | Cron weekly (22:00 UTC Sundays), `/api/cron/ingest-il-icc`. |
| `flPscDockets.ts` | Florida PSC determination-of-need dockets + DEP siting applications | Yes — real JSON API (PSC) + server-rendered HTML (DEP), no auth | None (no auth) | Cron weekly (22:30 UTC Sundays), `/api/cron/ingest-fl-psc`. |
| `nyDpsDockets.ts` | New York DPS Article VII (transmission) + Article VIII/94-c (renewable siting) dockets | Yes — real JSON API, no auth | None (no auth) | Cron weekly (23:00 UTC Sundays), `/api/cron/ingest-ny-dps`. |
| `nvPucnDockets.ts` | Nevada PUCN Utility Environmental Protection Act (UEPA) permit dockets | Yes — legacy ASP.NET WebForms + real JSON API (OnBase), no auth | None (no auth) | Cron weekly (23:30 UTC Sundays), `/api/cron/ingest-nv-pucn`. |
| `orEfscFacilities.ts` | Oregon Energy Facility Siting Council (EFSC) facility site-certifications | Yes — real JSON API (SharePoint REST), no auth | None (no auth) | Cron weekly (00:00 UTC Mondays), `/api/cron/ingest-or-efsc`. |
| `maEfsbDockets.ts` | Massachusetts Energy Facilities Siting Board (EFSB) dockets | Yes — real JSON API, no auth | None (no auth) | Cron weekly (00:30 UTC Mondays), `/api/cron/ingest-ma-efsb`. |
| `okOccDockets.ts` | Oklahoma Corporation Commission (OCC) High Voltage Transmission Certificate of Authority dockets | Yes — real JSON API (Laserfiche WebLink), no auth | None (no auth) | Cron weekly (01:00 UTC Mondays), `/api/cron/ingest-ok-occ`. |
| `utPscDockets.ts` | Utah Public Service Commission (PSC) CPCN dockets | Yes — server-rendered HTML, no auth | None (no auth) | Cron weekly (01:30 UTC Mondays), `/api/cron/ingest-ut-psc`. |
| `wiPscDockets.ts` | Wisconsin PSC CPCN / Certificate of Authority dockets | Yes — server-rendered HTML (ASP.NET WebForms), no auth | None (no auth) | Cron weekly (02:00 UTC Mondays), `/api/cron/ingest-wi-psc`. |
| `kyPscDockets.ts` | Kentucky PSC CPCN / Certificate of Construction dockets | Yes — server-rendered HTML (ASP.NET MVC), no auth | None (no auth) | Cron weekly (02:30 UTC Mondays), `/api/cron/ingest-ky-psc`. |
| `moPscDockets.ts` | Missouri PSC Certificate of Convenience and Necessity dockets | Yes — real JSON API (ASP.NET Core MVC, antiforgery-protected), no auth | None (no auth) | Cron weekly (03:00 UTC Mondays), `/api/cron/ingest-mo-psc`. |
| `inIurcDockets.ts` | Indiana Utility Regulatory Commission (IURC) CPCN dockets | Yes — real JSON API (separate companion Azure App Service), no auth | None (no auth) | Cron weekly (03:30 UTC Mondays), `/api/cron/ingest-in-iurc`. |
| `njBpuDockets.ts` | New Jersey Board of Public Utilities (BPU) 40:55D-19 determination + CSI siting-waiver dockets | Yes — server-rendered HTML (ASP.NET WebForms, Imperva-fronted), no auth | None (no auth) | Cron weekly (04:00 UTC Mondays), `/api/cron/ingest-nj-bpu`. |
| `mdPscDockets.ts` | Maryland Public Service Commission (PSC) Certificate of Public Convenience and Necessity (CPCN) dockets | Yes — server-rendered HTML (ASP.NET WebForms, cookie-less viewstate-only postback), no auth | None (no auth) | Cron weekly (04:30 UTC Mondays), `/api/cron/ingest-md-psc`. |
| `ctCscDockets.ts` | Connecticut Siting Council (CSC) Certificate of Environmental Compatibility and Public Need dockets/petitions | Yes — server-rendered HTML (hand-authored CMS, no search/API), no auth | None (no auth) | Cron weekly (05:00 UTC Mondays), `/api/cron/ingest-ct-csc`. |
| `wvPscDockets.ts` | West Virginia Public Service Commission (PSC) CPCN + Siting Certificate dockets | Yes — server-rendered HTML (decades-old ColdFusion), no auth | None (no auth) | Cron weekly (05:30 UTC Mondays), `/api/cron/ingest-wv-psc`. |
| `tnTpucDockets.ts` | Tennessee Public Utility Commission (TPUC) CCN dockets | Yes — server-rendered static HTML (S3/CloudFront), no auth | None (no auth) | Cron weekly (06:00 UTC Mondays), `/api/cron/ingest-tn-tpuc`. |
| `caCecDockets.ts` | California Energy Commission (CEC) power plant siting dockets (AFC + Opt-In) | Yes — server-rendered HTML (Drupal + ASP.NET WebForms), no auth | None (no auth) | Cron weekly (06:30 UTC Mondays), `/api/cron/ingest-ca-cec`. |
| `nhSecDockets.ts` | New Hampshire Site Evaluation Committee (SEC) dockets | Yes — server-rendered HTML (ASP.NET WebForms), no auth | None (no auth) | Cron weekly (07:00 UTC Mondays), `/api/cron/ingest-nh-sec`. |
| `idPucDockets.ts` | Idaho Public Utilities Commission (PUC) CPCN dockets | Yes — server-rendered HTML (ASP.NET-ish CMS), no auth | None (no auth) | Cron weekly (07:30 UTC Mondays), `/api/cron/ingest-id-puc`. |

All five workbook/API sources above `vaSccDockets.ts` run via Vercel Cron (see `vercel.json`) with no
manual step required — checking weekly bounds this site's staleness
to ~1 week behind whatever each source most recently published, it doesn't
mean the source itself changes that often (EIA-860M republishes monthly, the
EIA pipeline tracker ~quarterly, LBNL and ORNL annually; only the Permitting
Dashboard's live API is closer to real-time). Weekly, not the every-3-days
this site originally shipped with — changed 2026-08-23 to cut Vercel
invocation volume; five sources running every 3 days was seven runs/source/
week for no real freshness gain given how infrequently most of these
sources actually republish. Every ingestion run upserts by
a stable per-source ID, so re-running a source updates existing projects in place
rather than duplicating them.

Run a module directly with `npx tsx src/lib/ingest/<module>.ts` (or the
`npm run ingest:eia` / `npm run ingest:permitting-dashboard` / `npm run
ingest:lbnl` / `npm run ingest:ornl-hydro` / `npm run
ingest:eia-pipelines` scripts) for a manual run outside the cron schedule.

## Interconnection queue detail (`interconnectionQueueStage`, `networkUpgradeCostUsd`)

Two `Project` fields, added 2026-08-21, hold interconnection-source-specific
detail that doesn't fit the shared cross-source `currentStage`/`dataQualityNote`
fields cleanly — see their comments in `schema.prisma`. Null for every
non-interconnection source.

- `interconnectionQueueStage`: `lbnlQueuedUp.ts` now carries the LBNL
  workbook's own `IA_phase_clean` value (e.g. "Feasibility Study", "System
  Impact Study") through onto the project, rather than discarding it after
  collapsing it into the coarse shared `currentStage` bucket.
- `networkUpgradeCostUsd`: reserved for a join against LBNL's *separate*
  interconnection cost-analysis datasets (`emp.lbl.gov/interconnection_costs`)
  — not yet populated by any module. Confirmed 2026-08-21: those datasets are
  six independent per-region publications (MISO, PJM, SPP, ISO-NE, NYISO,
  non-ISO BAs), not one combined/annually-refreshed file like Queued Up, and
  several editions are years stale (MISO's is from 2021). The per-region
  project IDs do join cleanly to LBNL Queued Up's own `entity`+`q_id` (spot-
  checked against PJM: "A03" appears as both `q_id` in Queued Up and
  `Project #` in the PJM cost file), so a join is technically sound — but
  coverage against currently-*active* queue entries will be sparse, since
  most rows in these cost studies are long-since-operational or withdrawn
  projects. Whenever this gets built, any populated `networkUpgradeCostUsd`
  must carry a `dataQualityNote` citing LBNL's own "preliminary estimate"
  caveat, per the same pattern as this site's `dateConfidence: "approximate"`
  fields.

## RESOLVED_STAGES: what never appears on the site

This site tracks projects still waiting on a regulatory yes — a project
that's already been approved and is awaiting construction, is under
construction, was cancelled/withdrawn, or is already operating/completed
is excluded entirely, not just deprioritized. Enforced in one place
(`upsertNormalizedProject`, `common.ts`) rather than per-module: any
`NormalizedProject` whose `currentStage` is one of `RESOLVED_STAGES`
(`src/lib/data/taxonomies.ts`) gets deleted (if it previously existed) and
is never created. `eia860mPlanned.ts`, `permittingDashboard.ts`, and
`eiaPipelineProjects.ts` all normalize *every* row — including
already-approved/cancelled/operating ones — and let this shared guard
decide, specifically so a project this site previously tracked as waiting
gets removed the moment a source reports it's moved on, rather than
freezing in a stale "still waiting" state forever. `lbnlQueuedUp.ts` and
`ornlHydropowerRelicensing.ts` still filter these rows out *before*
normalizing (see open question #9) — a narrower, currently-safe gap, not
the same guarantee.

## Open questions (flagged, not guessed at)

These are called out here — and inline in each module — instead of being
silently assumed, per this project's own positioning: a site whose core
argument rests on data credibility shouldn't paper over gaps in that data.

1. **Cross-source project identity matching is a real, ongoing problem,
   not fully solved.** EIA and the Permitting Dashboard use their own
   name/ID for what might be the same physical project. Three confirmed
   duplicates (Grain Belt Express, SouthCoast Wind, Ocean Wind 1) were
   found and fixed by hand after the Permitting Dashboard's first live run
   — see `KNOWN_DUPLICATE_PROJECT_IDS` in `permittingDashboard.ts`. There's
   also a `manualOverrides.ts` + `.csv` path for declaring two source
   records the same project via a shared `matchKey`, for future cases
   where both sides go through the ingestion pipeline (as opposed to one
   side being the special-cased skip list above). No automated fuzzy
   matching is attempted — building real matching (name similarity +
   geographic proximity + capacity similarity) is the single highest-value
   follow-up engineering task.
2. **Permitting Dashboard's Socrata dataset is a denormalized join, not
   one row per project** — a query can return dozens of byte-for-byte
   duplicate rows per project_id. `permittingDashboard.ts` dedupes before
   normalizing; if this ever silently regresses, the symptom is way more
   projects than expected from a single ingestion run.
3. **Permitting Dashboard: no milestone/timeline or application-filed-date
   field found** on the public Socrata dataset used
   (`fh3k-bqsc` / "FAST-41 Projects Data"). The dashboard clearly has this
   data — it's the whole point of the site's timeline feature — but it's
   likely behind the token-gated `/api/v1/project/{id}` endpoint mentioned
   in the dashboard's own docs, which hasn't been registered for.
4. **Permitting Dashboard, EIA-860M, ORNL hydropower relicensing & EIA's
   pipeline tracker: no cause-category field.** None of the four tells you
   *why* a project is delayed in terms of this site's seven categories. All
   four modules ship every ingested project with `causeSlugs: []` and a
   note that it needs manual/derived assignment — deliberately, rather
   than guessing a plausible-sounding default.
5. **EIA-860M has no application-filed date either** — only a planned
   in-service date — so "days/years waiting" can't be computed for
   EIA-sourced projects without a manual override.
6. **LBNL Queued Up and ORNL hydropower relicensing column names are
   unverified against a future downloaded workbook.** Both parsers were
   written from familiarity with past/current editions of their respective
   codebooks and fail loudly (naming the missing column) rather than
   silently misreading a shifted one. Check each workbook's own
   codebook/field-descriptions tab before relying on either after a new
   annual edition ships.
7. **Redistribution terms aren't fully confirmed for any source.** Federal
   (.gov) data is generally public domain under 17 U.S.C. §105, consistent
   with default federal open-data licensing norms, but no dataset-specific
   terms page was found for `data.permits.performance.gov` or the EIA API;
   LBNL's Queued Up dataset asks for citation in a way that reads like an
   academic norm, not a formal license; and ORNL HydroSource's Data Use
   Policy wasn't independently confirmed as a formal redistribution
   license either. Get an explicit answer per source before redistributing
   bulk data via this site's own API at scale.
8. **ORNL hydropower relicensing skews far smaller than this site's other
   sources.** Only 17 of the 200 currently-waiting relicensing dockets
   clear the 250 MW floor (as of the 2026 edition) — most FERC-licensed
   hydro projects are small municipal or private dams. That's expected,
   not a bug, but it means this source contributes a much thinner slice of
   real projects than EIA-860M or LBNL Queued Up do.
9. **Resolved for `lbnlQueuedUp.ts` as of 2026-08-21; still open for ORNL
   hydropower relicensing.** Both modules used to filter out already-cleared
   rows (withdrawn/operational/suspended queue entries; IA-executed/pending/
   under-construction phases; issued relicenses; exemption conversions)
   *before* ever calling `normalize*Row`, rather than normalizing them with
   their real terminal stage and letting the shared `RESOLVED_STAGES` guard
   in `common.ts` delete a stale row (see "RESOLVED_STAGES" above).
   `lbnlQueuedUp.ts` now normalizes every row regardless of status — see
   `STATUS_TO_RESOLVED_STAGE` and the module header — so a project that
   moves to withdrawn/suspended/operational, or clears its interconnection
   agreement, gets removed the moment a new edition reports it, same
   guarantee as `eia860mPlanned.ts` / `permittingDashboard.ts`.
   `ornlHydropowerRelicensing.ts` still has the gap: audited 2026-08-16 and
   confirmed zero rows were in that stale state as of then, but it's real for
   whenever the next annual edition ships. Bringing it in line is the
   follow-up.
10. **EIA's pipeline projects tracker's filename convention isn't
    consistent** — confirmed 2026-08-16, most historical archive links use
    `EIA-NaturalGasPipelineProjects_<Mon><YYYY>.xlsx` (leading underscore,
    inconsistent month abbreviations across editions) but the current live
    one is `EIA-NaturalGasPipelineProjectsAug2026.xlsx` (no underscore).
    `eiaPipelineProjects.ts` scrapes the landing page for the current link
    rather than guessing a filename, so this shouldn't break ingestion, but
    it means a predictable-URL approach (like `eia860mPlanned.ts` uses)
    isn't viable for this source. Also has no capacity floor and no
    lat/lon (pipelines span multiple states) — both explicit product
    decisions, see the file header for the reasoning.
