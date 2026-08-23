# WaitingForPower — an Energy Project Tracker

Open source, MIT licensed — see [`LICENSE`](LICENSE). Contributions,
forks, and issues welcome.

Tracks proposed U.S. energy projects — generation, transmission, storage,
LNG, and pipelines, every fuel type — and how long each has been waiting for
approval, and why.

**The argument is structural, not partisan:** solar, wind, storage, gas,
nuclear, hydro, LNG, pipelines, and transmission all get stuck in the same
handful of bottlenecks. Every tracked delay is mapped to one of seven named
cause categories ([`src/lib/data/causeCategories.ts`](src/lib/data/causeCategories.ts)).
The site's policy argument — six specific, bipartisan reform proposals, one
per structural bottleneck, each with a stated problem, proposal, strengths,
weaknesses, and bill links — lives on a single page,
[`/policies`](src/app/policies/page.tsx)
([`src/lib/data/policies.ts`](src/lib/data/policies.ts)), deliberately kept
separate from the neutral cause-category data so "why a project is stuck"
and "what we're arguing should change" aren't the same object.

## Quick start

```bash
npm install
cp .env.example .env      # set DATABASE_URL to your own Postgres instance
npx prisma migrate deploy # applies the committed migrations to your database
npm run ingest:permitting-dashboard  # populate from a live, no-key-needed source
npm run dev
```

Needs a real Postgres connection string in `DATABASE_URL` — there's no
bundled local database file. The deployed app and local dev both point at
the same hosted Postgres instance for this project (see "Architecture"
below for why); for your own fork, any Postgres works (Neon, Supabase,
Vercel/Prisma Postgres, RDS, local `postgres` via Docker, etc.).

## Data & sourcing

**All project data comes from live, re-runnable sources — no hand-curated
one-off research.** An earlier version of this project shipped a small
hand-researched seed set; it was removed deliberately in favor of sources
that stay current on their own, rather than a snapshot that goes stale.
See [`src/lib/ingest/README.md`](src/lib/ingest/README.md) for the full
per-source table, open questions, and how each is scheduled:

| Source | Module | Checked | Source's own publish cadence |
|---|---|---|---|
| EIA-860M "Planned" generator inventory | `src/lib/ingest/eia860mPlanned.ts` | Cron weekly (13:00 UTC Sundays), `/api/cron/ingest-eia` | Monthly, ~2-month lag on EIA's end |
| Federal Permitting Dashboard (FAST-41) | `src/lib/ingest/permittingDashboard.ts` | Cron weekly (14:00 UTC Sundays), `/api/cron/ingest-permitting-dashboard` | Live API — no periodic file, effectively real-time |
| LBNL Queued Up | `src/lib/ingest/lbnlQueuedUp.ts` | Cron weekly (15:00 UTC Sundays), `/api/cron/ingest-lbnl` | ~Annual |
| ORNL HydroSource hydropower relicensing | `src/lib/ingest/ornlHydropowerRelicensing.ts` | Cron weekly (16:00 UTC Sundays), `/api/cron/ingest-ornl-hydro` | ~Annual |
| EIA Natural Gas Pipeline Projects tracker | `src/lib/ingest/eiaPipelineProjects.ts` | Cron weekly (17:00 UTC Sundays), `/api/cron/ingest-eia-pipelines` | ~Quarterly |
| Virginia SCC CPCN dockets | `src/lib/ingest/vaSccDockets.ts` | **Not scheduled yet — run manually.** First of a planned per-state series covering state PUC/PSC dockets, the structural bottleneck this site's other sources can't see (see open question #10). | Live API, but only one state so far |
| Texas PUCT CCN dockets | `src/lib/ingest/txPuctDockets.ts` | **Not scheduled yet — run manually.** Second state in the series — higher-volume than Virginia but with no structured status field, so "still waiting" is inferred from filing history (see file header for how that was calibrated). | Server-rendered HTML, no auth |
| Colorado PUC CPCN dockets | `src/lib/ingest/coPucDockets.ts` | **Not scheduled yet — run manually.** Third state — the cleanest yet: status is a real structured field already present in search results, no filing-history inference needed at all. | Server-rendered HTML, no auth |
| Ohio Power Siting Board cases | `src/lib/ingest/ohOpsbCases.ts` | **Not scheduled yet — run manually.** Fourth state — the simplest fetch yet (one unauthenticated JSON request returns the entire case history), and the first source in the series where both status and fuel/project type are real structured fields, not inferred. | Single JSON endpoint, no auth |
| South Carolina PSC siting-certificate dockets | `src/lib/ingest/scPscDockets.ts` | **Not scheduled yet — run manually.** Fifth state — like Texas, has no reliable status field, but its captions are unusually descriptive (facility type, capacity, county spelled out in the text), and "still waiting" is inferred from an embedded Orders sub-table rather than a full filing-history scan. | Server-rendered HTML, no auth |
| Arizona ACC Line Siting Committee dockets | `src/lib/ingest/azAccLineSiting.ts` | **Not scheduled yet — run manually.** Sixth state — a real JSON API, but with the same "status field lies" problem as South Carolina, independently rediscovered: `docketStatus` can read "Open" on a docket that's actually been decided. The real signal is a separate `decisions` array. | Real JSON API, no auth |
| Washington EFSEC facility site-certifications | `src/lib/ingest/waEfsecFacilities.ts` | **Not scheduled yet — run manually.** Seventh state — Washington's own utility commission (WUTC) turned out to have no siting-certificate authority at all; the real authority is a separate body, EFSEC, whose small (19-facility) all-time list is ingested directly. The one state so far where the *structured* status field is the reliable one and a free-text description was the one caught lying. | Server-rendered HTML, no auth |
| New Mexico PRC CCN dockets | `src/lib/ingest/nmPrcDockets.ts` | **Not scheduled yet — run manually.** Eighth state — a real JSON API behind an Angular SPA front-end, found by capturing the app's own network requests. Its CCN category also catches water-utility certificates and intake-rejected duplicate filings, both filtered out locally; its status field held up under testing, unlike several other states here. | Real JSON API, no auth |
| Illinois ICC CPCN dockets | `src/lib/ingest/ilIccDockets.ts` | **Not scheduled yet — run manually.** Ninth state — its CPCN case-type bucket also catches declaratory-ruling and eminent-domain petitions, filtered locally; capacity is published as voltage (kV), not MW, a first for this series. Its Grain Belt Express docket is the same physical line as an existing Permitting Dashboard entry — the case that surfaced and fixed a real cross-source merge bug, see open question #1. | Server-rendered HTML, no auth |

All five workbook/API sources above `vaSccDockets.ts` run on Vercel Cron (`vercel.json`) with no manual step — checking weekly means
this site never lags more than ~1 week behind whatever each source most recently published, not
that each source itself updates that often. Weekly (not the every-3-days this site originally
shipped with) is a deliberate tradeoff to cut invocation volume — see
[`src/lib/ingest/README.md`](src/lib/ingest/README.md). Every ingestion run upserts by a stable per-source
ID, so a re-run updates existing projects in place instead of duplicating them.

Every ingested project links back to its public source (see each project's
detail page). Where a date or figure wasn't confidently available, the
project is marked `dateConfidence: "approximate"` or carries a
`dataQualityNote` saying so, rather than presenting invented precision as
fact. Notably absent so far: sub-250MW generation/storage projects (see
each source's capacity floor / scope above — this includes the large
majority of hydropower relicensing dockets, which skew small), and any
cause-category assignment for automatically-ingested projects (none of the
five sources publishes *why* a project is delayed — see open question #4).
This site only tracks projects still waiting on approval — see
"RESOLVED_STAGES" in `src/lib/ingest/README.md` for what's deliberately
excluded and why.

**Interconnection queue detail.** `lbnlQueuedUp.ts` carries two extra fields
for LBNL-sourced projects, added 2026-08-21: `interconnectionQueueStage`
(the workbook's own study-phase label, e.g. "Feasibility Study") and
`networkUpgradeCostUsd` (reserved for a join against LBNL's separate,
irregularly-updated interconnection cost-analysis datasets — not yet
populated by any module). Per explicit product decision, a *suspended*
interconnection request is treated the same as withdrawn: not shown as
"waiting." Every ingestion run now also actively removes a previously-shown
project the moment a later edition reports it withdrawn, suspended, or
operational, rather than leaving it frozen in its last-known state — see
`src/lib/ingest/README.md` for the full detail and open question #9.

## Open questions

Flagged deliberately rather than guessed at — see also
[`src/lib/ingest/README.md`](src/lib/ingest/README.md) for the
per-data-source version of this list.

1. **Cross-source project identity matching is a real, ongoing problem,
   not fully solved.** EIA, the Permitting Dashboard, and now the growing
   state-docket series each use their own name/ID for what might be the
   same physical project. `src/lib/ingest/manualOverrides.ts` + `.csv`
   lets a human declare two source records the same project via a shared
   `matchKey` — there's no automated fuzzy-matching, deliberately (name
   similarity + geographic proximity + capacity similarity is flagged as
   the highest-value follow-up engineering task, not attempted here).
   **A real merge bug in this mechanism was found and fixed 2026-08-23**:
   `upsertNormalizedProject` (`common.ts`) used to look up existing
   projects by `slug`, but `slug` is derived from a project's *name*, which
   differs between sources — so two records sharing a manually-declared
   `matchKey` still produced two separate rows instead of merging into one,
   silently defeating the override file's entire purpose (caught by hand
   when Illinois's new CPCN docket for Grain Belt Express turned out to
   duplicate an existing Permitting Dashboard entry for the same line).
   Fixed by adding a real `matchKey` column to `Project` (`prisma/schema.
   prisma`) and keying the upsert on that instead, with a slug-based
   fallback lookup so every project ingested before this column existed
   self-heals (gets its real matchKey backfilled) the next time its own
   source naturally re-ingests it — no separate backfill migration needed.
   `ProjectSource` rows are now upserted by `(projectId, label)` rather
   than deleted-and-recreated on every run too, so a merged project keeps
   both sources' links instead of the more-recently-run source's write
   wiping out the other's. `manualOverrides.csv` currently has one real
   entry (Grain Belt Express: Permitting Dashboard project_id 109441 +
   Illinois ICC docket 22-0499) — the two other originally-flagged
   duplicates, SouthCoast Wind and Ocean Wind 1, have no current overlap to
   merge (see the "NOTE on cross-source identity matching" comment in
   `permittingDashboard.ts`), so nothing is declared for them yet.
2. **Permitting Dashboard's Socrata dataset is a denormalized join, not
   one row per project** — a single query can return dozens of
   byte-for-byte duplicate rows per project. The ingestion module dedupes
   before normalizing; watch for this if the row count from a fresh run
   ever looks far higher than expected.
3. **Permitting Dashboard has no public milestone/timeline or
   application-filed-date field** on the open Socrata dataset this project
   used — that data likely exists behind the token-gated
   `/api/v1/project/{id}` endpoint mentioned in the dashboard's own docs,
   which wasn't registered for in this pass.
4. **EIA-860M, the Permitting Dashboard, ORNL's hydropower relicensing
   dataset, and EIA's pipeline projects tracker don't publish a cause
   category.** Every project ingested from any of the four ships with
   `causeSlugs: []` and an explicit note that it needs manual/derived
   assignment, rather than a guessed default. (LBNL Queued Up is the
   exception — every row it produces is tagged
   `interconnection_queue_backlog`, since that's definitionally what an
   interconnection queue entry is waiting on.)
5. **LBNL Queued Up and ORNL hydropower relicensing column names are
   unverified against a future downloaded workbook** — both parsers were
   written from familiarity with past/current editions of their respective
   codebooks and fail loudly (naming the missing column) rather than
   silently misreading a shifted one. Check the current workbook's own
   codebook/field-descriptions tab before relying on either after a new
   annual edition ships.
6. **Redistribution terms aren't fully confirmed for any source.** Federal
   (.gov) data is generally public domain under 17 U.S.C. §105, consistent
   with default federal open-data licensing norms, but no dataset-specific
   terms page was found for `data.permits.performance.gov` or the EIA API;
   LBNL's Queued Up asks for citation in a way that reads like an academic
   norm, not a formal license; and ORNL HydroSource links a Data Use Policy
   whose exact redistribution terms weren't independently confirmed either.
   Get an explicit answer per source before redistributing bulk data via
   this site's own API at scale.
7. **Investment-waiting only covers generation/storage projects with MW
   capacity and a published construction-cost figure.** Transmission,
   pipeline, and LNG projects show "not estimated" rather than a number
   built on assumptions this project couldn't defend as well — see
   `src/lib/calc/investmentWaiting.ts` and `/methodology`.
8. **LBNL's interconnection cost-analysis datasets aren't a single
   reliably-updated source.** Confirmed 2026-08-21: `networkUpgradeCostUsd`
   is reserved on the schema but not yet populated by any ingestion module.
   The underlying data (`emp.lbl.gov/interconnection_costs`) is six
   independent per-region publications (MISO, PJM, SPP, ISO-NE, NYISO,
   non-ISO BAs), not one combined/annually-refreshed file like Queued Up —
   several editions are years stale (MISO's is from 2021). The join to
   existing LBNL Queued Up projects (by `entity`+`q_id`) does check out —
   spot-checked against PJM — but coverage against currently-*active* queue
   entries will be sparse, since most rows in these cost studies are
   long-since-operational or withdrawn projects. See
   `src/lib/ingest/README.md`.
9. **SQLite + serverless deployment (resolved).** v1 originally shipped
   with a committed SQLite file for zero-config local dev. On the first
   Vercel deploy this broke completely: Next.js's serverless file tracer
   doesn't know to bundle a file that's only referenced via a connection
   string (not `import`ed), so `prisma/dev.db` was silently missing from
   the deployed function and every DB read 500'd — a strictly worse
   failure mode than the "writes won't persist" issue originally flagged
   here. Fixed by moving to a hosted Postgres instance (Prisma Postgres via
   Vercel's Storage integration) used by both local dev and production.
10. **State PUC/PSC dockets: nine states down, 41 to go, each with its own
    hard problem.** Confirmed 2026-08-23: no national aggregator exists for
    state utility-commission dockets — each state runs its own system, and
    FERC eLibrary covers the federal side alone. `vaSccDockets.ts`,
    `txPuctDockets.ts`, `coPucDockets.ts`, `ohOpsbCases.ts`,
    `scPscDockets.ts`, `azAccLineSiting.ts`, `waEfsecFacilities.ts`,
    `nmPrcDockets.ts`, and `ilIccDockets.ts` are all plain-HTTP-fetch
    sources, not scraping projects — no headless browser needed for any of
    them, same shape as this site's other sources — but none was "just add
    a module":
    - **Virginia** has a real, structured `Status` field, but its search
      scope (caption contains the exact phrase "Certificate of Public
      Convenience and Necessity") is precise and narrow: only 46 cases in
      Virginia's *entire history* match it, and only 1 is currently active.
    - **Texas** has no status field at all — "still waiting" is inferred
      from scanning each docket's full filing history for a closing signal
      (a final order, order on rehearing, or similar), calibrated by hand
      against real dockets rather than guessed at (see `txPuctDockets.ts`'s
      header for the specific false-negative this caught and fixed before
      shipping). In exchange, its yield is far higher — over 100 recent
      candidates vs. Virginia's single-digit count.
    - **Colorado** has status
      (Active/Closed/Effective/Withdrawn/Suspended/Appealed) already as a
      column in the search results themselves — no per-candidate detail
      fetch needed just to know whether a docket is still open, unlike
      either Virginia or Texas.
    - **Ohio** turned out the simplest yet: its Power Siting Board publishes
      the entire case history (227 cases) as one unauthenticated JSON
      request, no search/pagination/session at all, with both status and
      fuel/project type as real structured fields — the first source in
      this series where fuel type isn't a keyword guess. The catch was
      finding it: Ohio's regular PUCO docketing system sits behind a
      bot-defense WAF that blocks every search regardless of headers, a
      real dead end confirmed by hand before pivoting to OPSB.
    - **South Carolina** has no reliable status field either (its "Status"
      column reads "Open" even on a docket granted years earlier), so
      "still waiting" is inferred from an embedded Orders sub-table already
      present on the same detail-page fetch — cheaper than Texas's full
      filing-history scan since it's one small table, not every filing.
      Its bigger gotcha was scoping: a server-side exact-phrase search for
      the CPCN phrase Virginia and Texas both use almost entirely missed
      SC's real captions, which use a longer statutory name ("Certificate
      of *Environmental Compatibility and* Public Convenience and
      Necessity"); and a broader keyword search let through two petitions
      that merely argued *about* a certificate rather than applying for
      one, caught in a real post-run data-quality check and fixed by
      requiring captions start with "Application of."
    - **Arizona** has a real JSON API (unlike VA/TX/SC's HTML), but its
      docket-level `docketStatus` field turned out to have the exact same
      unreliability as South Carolina's Status field — independently
      rediscovered rather than assumed to carry over: a docket filed in
      December 2022 still reads `docketStatus: "Open"` today despite a
      certificate having been granted five months after filing. The real
      signal is a separate `decisions` array (empty = still pending, any
      entry = a Commission ruling occurred) — confirmed against a real
      64-docket batch, where the deceptive "Compliance Due" status (81% of
      that batch) reliably meant "already granted, now in post-approval
      compliance monitoring," not "still waiting." Its search endpoint also
      silently returns zero rows if `rowsPerPage` is omitted or zero,
      despite a correct nonzero total count and no error — caught before
      it could look like "no candidates found."
    - **Washington** has no CPCN/siting authority in its own utility
      commission at all — WUTC's ~36,500 dockets are tariffs, rate cases,
      and affiliated-interest filings, confirmed by hand to contain
      essentially nothing siting-related. That authority instead sits with
      a separate body, the Energy Facility Site Evaluation Council (EFSEC),
      whose entire all-time facility history is only 19 records (RCW 80.50
      only reaches *major* energy facilities), cheap enough to ingest
      without any date-based lookback at all. Washington is also the one
      state so far where this series' now-familiar "don't trust the status
      field" lesson ran backwards: EFSEC's structured status field turned
      out to be the *reliable* one, and it was a free-text description
      paragraph that was caught lying — a facility whose narrative still
      described it as active and awaiting construction had actually had its
      site certification terminated four months earlier, correctly
      reflected only in the structured field.
    - **New Mexico** has a real JSON API behind an Angular SPA front end
      (found by capturing the app's own network requests, not guessed),
      and — unusually for this series — its status field held up under
      independent testing rather than lying. Its real gotchas were
      scoping ones instead: its CCN category also covers water/sewer
      utility certificates (excluded by caption keyword) and, separately,
      an e-filing *intake* rejection that never got a real docket number
      assigned but still appeared in search results as if it were a case.
    - **Illinois** turned out to be this series' first real cross-source
      duplicate: its CPCN docket for Grain Belt Express is the same
      physical interstate transmission line already tracked via the
      federal Permitting Dashboard. Confirming and fixing that surfaced a
      genuine bug in `manualOverrides.csv`'s merge mechanism itself (see
      open question #1) — worth more than the state module in its own
      right. Illinois's own scoping problem: its CPCN case-type bucket
      also catches a declaratory-ruling petition and a pure eminent-domain
      petition, both naturally excluded by requiring the actual CPCN
      phrase; capacity is published as voltage (kV) rather than MW, a
      first for this series (Illinois's 1997 generation deregulation means
      its CPCN docket is now almost entirely a transmission-siting
      instrument — 58 of 59 real candidates since 2000 are transmission
      lines, not generation).
    Widening any of the nine states' scope, or evaluating the other
    research leads already confirmed viable in parallel (North Carolina
    works too but needs a stateful session/postback-counter dance and
    Cloudflare-aware headers, real extra engineering weight; Pennsylvania,
    Georgia, Minnesota, and Michigan stay deferred — PA has no caption
    field in search results, GA's has one but it's server-side broken and
    always returns the full unfiltered set, Minnesota's entire eDockets/
    eFiling platform sits behind a live Cloudflare Turnstile CAPTCHA or an
    account login with no unauthenticated path at all, and Michigan's real
    docket search is a Salesforce Experience Cloud app whose data only
    loads via an internal Aura RPC endpoint — the same access pattern
    documented as a 2025-26 mass-scraping technique against misconfigured
    Salesforce orgs, not a risk worth taking on for this project, and its
    one plain-HTTP fallback has no caption field without adding a new
    PDF-parsing dependency), are real next options — each needs the same
    "confirm before guessing" treatment this project holds itself to, one
    state (and one scope/status decision) at a time, not assumed to
    generalize.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind v4**, single app.
- **Prisma + Postgres** (`prisma/schema.prisma`) — one hosted instance used
  for both local dev and production; see open question #9 for why this
  project moved off SQLite.
- **MapLibre GL JS** for the map — a free CARTO Voyager vector basemap (no
  API token required), with projects rendered as plain DOM markers
  (`maplibregl.Marker`) sized by capacity, colored uniformly. An earlier
  version used a clustered GeoJSON source rendered as GL circle layers, but
  that pipeline (worker-built tiles + GL repaint) wasn't reliably rendering
  in production; DOM markers sidestep it entirely at the cost of native
  clustering — see git history on `src/components/Map.tsx`.
- Filters live as React state in `src/components/Explorer.tsx` and drive
  both the map and the sortable list/table view from one source of truth
  (`src/lib/filters.ts`), with live-updating aggregate stats
  (`src/lib/stats.ts`).

## Project schema

See `prisma/schema.prisma` for the authoritative version. Key point: cause
categories (and the policies argued for at `/policies`) are **not** a
database table — they're fixed, small, code-reviewed sets in
`src/lib/data/causeCategories.ts` and `src/lib/data/policies.ts`. Projects
reference a cause by string slug, validated in app code, not a DB foreign
key — adding a new cause category or policy is meant to be a deliberate
product/policy decision, not something an ingestion script can do silently.
