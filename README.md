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
| Virginia SCC CPCN dockets | `src/lib/ingest/vaSccDockets.ts` | Cron weekly (18:00 UTC Sundays), `/api/cron/ingest-va-scc`. First of a planned per-state series covering state PUC/PSC dockets, the structural bottleneck this site's other sources can't see (see open question #10). | Live API, but only one state so far |
| Texas PUCT CCN dockets | `src/lib/ingest/txPuctDockets.ts` | Cron weekly (18:30 UTC Sundays), `/api/cron/ingest-tx-puct`. Second state in the series — higher-volume than Virginia but with no structured status field, so "still waiting" is inferred from filing history (see file header for how that was calibrated). | Server-rendered HTML, no auth |
| Colorado PUC CPCN dockets | `src/lib/ingest/coPucDockets.ts` | Cron weekly (19:00 UTC Sundays), `/api/cron/ingest-co-puc`. Third state — the cleanest yet: status is a real structured field already present in search results, no filing-history inference needed at all. | Server-rendered HTML, no auth |
| Ohio Power Siting Board cases | `src/lib/ingest/ohOpsbCases.ts` | Cron weekly (19:30 UTC Sundays), `/api/cron/ingest-oh-opsb`. Fourth state — the simplest fetch yet (one unauthenticated JSON request returns the entire case history), and the first source in the series where both status and fuel/project type are real structured fields, not inferred. | Single JSON endpoint, no auth |
| South Carolina PSC siting-certificate dockets | `src/lib/ingest/scPscDockets.ts` | Cron weekly (20:00 UTC Sundays), `/api/cron/ingest-sc-psc`. Fifth state — like Texas, has no reliable status field, but its captions are unusually descriptive (facility type, capacity, county spelled out in the text), and "still waiting" is inferred from an embedded Orders sub-table rather than a full filing-history scan. | Server-rendered HTML, no auth |
| Arizona ACC Line Siting Committee dockets | `src/lib/ingest/azAccLineSiting.ts` | Cron weekly (20:30 UTC Sundays), `/api/cron/ingest-az-acc`. Sixth state — a real JSON API, but with the same "status field lies" problem as South Carolina, independently rediscovered: `docketStatus` can read "Open" on a docket that's actually been decided. The real signal is a separate `decisions` array. | Real JSON API, no auth |
| Washington EFSEC facility site-certifications | `src/lib/ingest/waEfsecFacilities.ts` | Cron weekly (21:00 UTC Sundays), `/api/cron/ingest-wa-efsec`. Seventh state — Washington's own utility commission (WUTC) turned out to have no siting-certificate authority at all; the real authority is a separate body, EFSEC, whose small (19-facility) all-time list is ingested directly. The one state so far where the *structured* status field is the reliable one and a free-text description was the one caught lying. | Server-rendered HTML, no auth |
| New Mexico PRC CCN dockets | `src/lib/ingest/nmPrcDockets.ts` | Cron weekly (21:30 UTC Sundays), `/api/cron/ingest-nm-prc`. Eighth state — a real JSON API behind an Angular SPA front-end, found by capturing the app's own network requests. Its CCN category also catches water-utility certificates and intake-rejected duplicate filings, both filtered out locally; its status field held up under testing, unlike several other states here. | Real JSON API, no auth |
| Illinois ICC CPCN dockets | `src/lib/ingest/ilIccDockets.ts` | Cron weekly (22:00 UTC Sundays), `/api/cron/ingest-il-icc`. Ninth state — its CPCN case-type bucket also catches declaratory-ruling and eminent-domain petitions, filtered locally; capacity is published as voltage (kV), not MW, a first for this series. Its Grain Belt Express docket is the same physical line as an existing Permitting Dashboard entry — the case that surfaced and fixed a real cross-source merge bug, see open question #1. | Server-rendered HTML, no auth |
| Florida PSC + DEP siting certification | `src/lib/ingest/flPscDockets.ts` | Cron weekly (22:30 UTC Sundays), `/api/cron/ingest-fl-psc`. Tenth state — Florida has no CPCN at the PSC at all; siting runs through a separate DEP process the PSC only opens with a small "determination of need" sub-docket. Two agencies' pages are cross-checked against each other, and — unusually for this series — it's the *state-docket agency's own* status field that lies, while a second agency's page is the reliable one. | Real JSON API (PSC) + server-rendered HTML (DEP), no auth |
| New York DPS Article VII/VIII dockets | `src/lib/ingest/nyDpsDockets.ts` | Cron weekly (23:00 UTC Sundays), `/api/cron/ingest-ny-dps`. Eleventh state — two live siting-certificate tracks (transmission under Article VII, renewable generation under Article VIII/its predecessor § 94-c) in one system, covered by one module. Publishes no status field at all, and the renewable track's grant order isn't even filed as an Order/Decision — it's a plain correspondence filing, found only by scanning every document title regardless of type. | Real JSON API, no auth |
| Nevada PUCN UEPA permit dockets | `src/lib/ingest/nvPucnDockets.ts` | Cron weekly (23:30 UTC Sundays), `/api/cron/ingest-nv-pucn`. Twelfth state — no CPCN; Nevada's equivalent is a Utility Environmental Protection Act permit spanning two separate PUCN systems (a legacy WebForms docket list plus a modern OnBase JSON API). Its multi-phase transmission reviews (an already-"GRANTED" phase followed by a new phase filing months later) required a real "no later substantive filing" check, not just "does any order say GRANTED." | Legacy ASP.NET WebForms + real JSON API (OnBase), no auth |
| Oregon EFSC facility site-certifications | `src/lib/ingest/orEfscFacilities.ts` | Cron weekly (00:00 UTC Mondays), `/api/cron/ingest-or-efsc`. Thirteenth state — like Washington, Oregon's own utility commission has no siting authority; the real body is the Energy Facility Siting Council. Unusually, *both* of its structured status fields turned out unreliable (37 of 97 facilities disagreed between them) — the real signal is a free-text narrative field instead. One current candidate, Cascade Renewable Transmission, is the same physical HVDC line already tracked via Washington's EFSEC module — merged via `manualOverrides.csv`. | Real JSON API (SharePoint REST), no auth |
| Massachusetts EFSB dockets | `src/lib/ingest/maEfsbDockets.ts` | Cron weekly (00:30 UTC Mondays), `/api/cron/ingest-ma-efsb`. Fourteenth state — like Washington/Oregon, the state's DPU itself isn't the real siting authority; a board (EFSB) that sits administratively inside DPU issues the actual certificate. Its own "Closed Date" field can stay null for years after a real grant, so resolution is instead inferred from scanning every filed document's own type for a "Final Decision." | Real JSON API, no auth |
| Oklahoma OCC High Voltage Transmission COA dockets | `src/lib/ingest/okOccDockets.ts` | Cron weekly (01:00 UTC Mondays), `/api/cron/ingest-ok-occ`. Fifteenth state — no generic CPCN; Oklahoma's own "CCN" relief type is used almost exclusively by telecom carriers, and the real electric-siting equivalent is a narrower "High Voltage Transmission COA" certificate — only 4 cases have ever been filed under it since 2022, all already resolved as of shipping, a real (not buggy) zero-candidate result. | Real JSON API (Laserfiche WebLink), no auth |
| Utah PSC CPCN dockets | `src/lib/ingest/utPscDockets.ts` | Cron weekly (01:30 UTC Mondays), `/api/cron/ingest-ut-psc`. Sixteenth state — across Utah's entire electric-docket history back to 1987, only 12 dockets are genuine new CPCN applications and all 12 are already granted, another real zero-candidate result (PacifiCorp/Rocky Mountain Power's resource decisions go through Integrated Resource Plan acknowledgment instead). No PDF-parsing dependency exists in this project, so final orders (unstructured PDFs) are read by decompressing their own FlateDecode streams directly with Node's built-in zlib. | Server-rendered HTML, no auth |
| Wisconsin PSC CPCN / Certificate of Authority dockets | `src/lib/ingest/wiPscDockets.ts` | Cron weekly (02:00 UTC Mondays), `/api/cron/ingest-wi-psc`. Seventeenth state — both the large-facility CPCN and smaller-facility Certificate of Authority processes share one docket case-type code. PSC's own "Status" field is a records-retention lifecycle flag, not a case-decision flag — dockets decided 7+ years ago still show "Active" indefinitely; the real signal is a filed order titled "Final Decision." | Server-rendered HTML (ASP.NET WebForms), no auth |
| Kentucky PSC CPCN / Certificate of Construction dockets | `src/lib/ingest/kyPscDockets.ts` | Cron weekly (02:30 UTC Mondays), `/api/cron/ingest-ky-psc`. Eighteenth state — unusually, its "Include Closed" search filter turned out to be reliable, verified both directions against real dockets; used as the primary status signal for the first time in this series, with a text-based grant/deny scan kept as a defensive secondary check anyway. | Server-rendered HTML (ASP.NET MVC), no auth |
| Missouri PSC Certificate of Convenience and Necessity dockets | `src/lib/ingest/moPscDockets.ts` | Cron weekly (03:00 UTC Mondays), `/api/cron/ingest-mo-psc`. Nineteenth state — a real antiforgery-protected AJAX API. A post-run data-quality check against the live DB caught a real bug before shipping: an anchored regex missed real "Order Approving Third/Unanimous Stipulation and Agreement" titles, and an Order/Notice-type filter entirely missed real "Closing File" filings, together leaving several already-resolved 2018/2019 dockets wrongly shown as still waiting. | Real JSON API (ASP.NET Core MVC, antiforgery-protected), no auth |
| Indiana IURC CPCN dockets | `src/lib/ingest/inIurcDockets.ts` | Cron weekly (03:30 UTC Mondays), `/api/cron/ingest-in-iurc`. Twentieth state — the public portal's visible reCAPTCHA is only checked in client-side JS; the real backing API (a separate companion Azure App Service) never receives or validates a token. An "Appealed" case status maps to this site's own "litigation" stage instead of being deleted, since the Commission's Final Order exists but isn't yet legally final. | Real JSON API (separate companion Azure App Service), no auth |
| New Jersey BPU 40:55D-19 determination / CSI siting-waiver dockets | `src/lib/ingest/njBpuDockets.ts` | Cron weekly (04:00 UTC Mondays), `/api/cron/ingest-nj-bpu`. Twenty-first state — New Jersey has no CPCN at all; the closest equivalents are two distinct docket types covered by one module (a 40:55D-19 "reasonably necessary for the public" determination, and a Competitive Solar Incentive Program siting-prohibition waiver). BPU's own "Case Status" field was found stale by nine years on a real docket, so resolution is instead read from the most recent Board Order PDF's own text, decompressed with Node's built-in zlib (no PDF-parsing dependency exists in this project). | Server-rendered HTML (ASP.NET WebForms, Imperva-fronted), no auth |
| Maryland PSC CPCN dockets | `src/lib/ingest/mdPscDockets.ts` | Cron weekly (04:30 UTC Mondays), `/api/cron/ingest-md-psc`. Twenty-second state — no "Status" field at all; "still waiting" is inferred from scanning every filed document for a dispositive Commission/Public Utility Law Judge order, an allow-vs-exclude-list approach needed because real dispositive orders use surprisingly varied phrasing (some with a blank subject beyond the order number itself). A post-run data-quality check caught a real county-extraction bug (a free-form regex swept in preceding caption text) and a genuine source typo ("DORCESTER" for "Dorchester" in one real caption), both fixed before shipping. | Server-rendered HTML (ASP.NET WebForms, cookie-less viewstate-only postback), no auth |
| Connecticut Siting Council (CSC) dockets/petitions | `src/lib/ingest/ctCscDockets.ts` | Cron weekly (05:00 UTC Mondays), `/api/cron/ingest-ct-csc`. Twenty-third state — like Washington/Oregon/Massachusetts, the real siting authority isn't the obvious utility commission (PURA is only a commenter into CSC's own process). CSC has no queryable docket search at all, only hand-typed CMS pages; its own disclaimer that it "may not be able to keep the information ... up to date" was confirmed true by hand (a petition granted in 2013 still listed as open in 2026), so every candidate is cross-checked against CSC's own historical Decision and Order List before being treated as still pending. A structural bug found during this project's own verification step — resolved candidates were silently excluded from the ingestion run rather than passed through with a resolved stage, meaning a project that later resolved would never be deleted from the site — was fixed before shipping. | Server-rendered HTML (hand-authored CMS, no search/API), no auth |
| West Virginia PSC CPCN + Siting Certificate dockets | `src/lib/ingest/wvPscDockets.ts` | Cron weekly (05:30 UTC Mondays), `/api/cron/ingest-wv-psc`. Twenty-fourth state — two docket types (a general CPCN and a separate Siting Certificate for merchant generators), and one of the richest real STATUS datasets in this series: a confirmed real denial, a case resolved via an ALJ Recommended Decision auto-finalizing with no separate Commission order, and a confirmed false-positive (an unrelated attorney-admission motion using the word "granted" in the same docket) that the resolution regex is written to avoid. Also caught a real fuel-classification bug (a hybrid gas+solar filing was tagged "solar" by a fixed keyword-priority order instead of whichever fuel is named first in the caption) and the same "vanished candidate" structural bug found in Connecticut — WV's own search is Active-only, so a case whose Active flag flips to Closed disappears from every future search rather than being caught by the module's own resolution check; fixed by diffing previously-tracked matchKeys against each run's active list. | Server-rendered HTML (decades-old ColdFusion, no auth) |
| Tennessee TPUC CCN dockets | `src/lib/ingest/tnTpucDockets.ts` | Cron weekly (06:00 UTC Mondays), `/api/cron/ingest-tn-tpuc`. Twenty-fifth state — a genuine, confirmed zero-yield source: TVA (a federal instrumentality exempt from TPUC's certificate jurisdiction) supplies the overwhelming majority of Tennessee's generation, and its ~150 local power companies hold exclusive pre-assigned territories, so a new-entrant electric CCN essentially never triggers. Scanning the entire 160-docket active population by hand found zero currently-open electric candidates — every real CCN-type caption is a water utility or telecom filing. Kept live (not dropped) as a "standing watch for a rare event" source, the same convention as ORNL hydro's own thin population, with the same preventive "vanished candidate" fix applied as Connecticut/West Virginia even though nothing exists yet to have gone stale. | Server-rendered static HTML (S3/CloudFront), no auth |
| California Energy Commission (CEC) power plant siting dockets | `src/lib/ingest/caCecDockets.ts` | Cron weekly (06:30 UTC Mondays), `/api/cron/ingest-ca-cec`. Twenty-sixth state — CPUC (the obvious candidate) was tried and correctly deferred: its search form's real submit path is client-side Dynamic Action logic invisible to a plain `fetch()`, confirmed both via a raw POST replay and a real-browser session where the click never reached the actual search endpoint at all. CEC turned out to be the real siting gate instead — it has exclusive jurisdiction over ≥50MW thermal/geothermal plants and, since AB 205, ≥50MW solar/wind and ≥200MWh storage, and nearly every large project files there rather than at CPUC. A false-positive resolution signal (a local air district's own "Notice of Decision," unrelated to CEC's siting decision) was caught and excluded before shipping, along with the same "vanished candidate" structural bug already found in Connecticut/West Virginia. | Server-rendered HTML (Drupal + ASP.NET WebForms), no auth |
| New Hampshire Site Evaluation Committee (SEC) dockets | `src/lib/ingest/nhSecDockets.ts` | Cron weekly (07:00 UTC Mondays), `/api/cron/ingest-nh-sec`. Twenty-seventh state — the fourth real instance of "the real siting authority isn't the obvious utility commission" (after WA/OR/MA/CT): the PUC's 3 commissioners are only 3 of SEC's 5 statutory members and cannot alone constitute a quorum. A December 2025 restructuring moved SEC's docket records onto the PUC's own website under an "SEC" prefix, which is what makes it look like "the PUC does siting" at first glance. Caught a real false-positive resolution signal before shipping — a docket "rejected" as procedurally incomplete reads exactly like a final denial by keyword match but isn't one, confirmed against a real 190+-filing docket that continued on after its own "rejection." A curl-specific TLS-fingerprint bot block on every nh.gov subdomain (unrelated to Node's own `fetch()`, which this module actually uses) is documented so a future maintainer doesn't mistake it for a real blocker. | Server-rendered HTML (ASP.NET WebForms), no auth |
| Idaho PUC CPCN dockets | `src/lib/ingest/idPucDockets.ts` | Cron weekly (07:30 UTC Mondays), `/api/cron/ingest-id-puc`. Twenty-eighth state — one of the first to publish a genuinely structured Status field, but since `common.ts`'s RESOLVED_STAGES deletes a project identically whether it's "approved" or "cancelled," Idaho's own open/closed split alone is enough — no order-document text parsing needed here, unlike WV/MD/CT. A real singular/plural regex bug (`\bcertificate\b`'s trailing word boundary silently excluded every "CERTIFICATES OF..." plural caption) undercounted 4 real candidates down to 1, caught by comparing the dry-run's output against a hand-verified count before shipping — the same gap confirmed live in IPUC's own search box. Also caught a real joint-owner duplicate (two utilities each filing their own CPCN for the same physical transmission line), kept as two rows per this project's non-dedup policy. | Server-rendered HTML (ASP.NET-ish CMS), no auth |
| Nebraska Power Review Board (PRB) applications | `src/lib/ingest/nePrbDockets.ts` | Cron weekly (08:00 UTC Mondays), `/api/cron/ingest-ne-prb`. Twenty-ninth state — Nebraska has no investor-owned electric utilities and no PSC jurisdiction over electric certificates at all; the real authority is the Power Review Board, which publishes no case-search tool or docket database of any kind — "still waiting" is inferred entirely from the Board's own meeting minutes prose. Two real structural bugs were found and fixed via a live DB check before shipping: a contested case's facts and its resolution can each live in a different, non-adjacent paragraph than its first/last mention, which an initial "first mention = facts, last mention = status" design got wrong both ways — once garbling a real case's name/fields, once misclassifying a genuinely-granted case as still pending. All 13 real in-scope candidates as of shipping had already resolved (Nebraska's small, mostly-uncontested caseload usually clears within a single Board meeting), a real zero-currently-pending result confirmed by hand, not a scraping gap. | Server-rendered HTML (Drupal, prose-only minutes, no search tool), no auth |
| Louisiana PSC certification dockets | `src/lib/ingest/laPscDockets.ts` | Cron weekly (08:30 UTC Mondays), `/api/cron/ingest-la-psc`. Thirtieth state — no single named CPCN statute (a promising-looking hit, La. R.S. 45:1503, turned out to be a 1968 telecom statute, a real wrong-guess trap caught by reading the actual text); the real gate is a consistent "certification"/"approval to construct" docket practice confirmed against a full, real 191-docket sample with zero false positives. Confirmed New Orleans's exclusion definitively (Entergy New Orleans never appears in LPSC's ~16,900-docket history at all — it's regulated solely by the City Council). LPSC's own Status field lies in an unusually sharp way — it stays "Open" for months or years after a real granting order, since LPSC keeps a docket open for post-approval compliance monitoring. This project's own live-DB verification step caught a real bug the module's original calibration missed: a confirmed-real grant order used a curly Unicode apostrophe ("Judge’s Recommendation") that a straight-ASCII-apostrophe regex silently failed to match, leaving a resolved docket wrongly shown as still pending. | Real JSON API (ASP.NET MVC + Kendo UI), no auth |
| Alabama PSC CPCN dockets | `src/lib/ingest/alPscDockets.ts` | Cron weekly (09:00 UTC Mondays), `/api/cron/ingest-al-psc`. Thirty-first state — Alabama's CPCN statute isn't electric-specific and shares one flat docket-number sequence across every utility type, so scoping runs on client-side content filtering rather than a docket-code prefix. Found a real full-text search indexing gap that would have made the exact kind of very-recently-filed docket this site cares about most systematically invisible — Alabama Power's real, current "Lindsay Hill" CPCN (granted 2025) never appeared in the phrase search at all across a 26-year lookback; fixed with a second, structured-metadata discovery path scoped to Alabama Power's own filings. A real vanished-candidate bug was also found in a new shape: two false positives upserted before a content filter was tightened would have frozen in the DB forever, since content-based rejection (unlike every prior state's status-filter-based version of this bug) never naturally revisits an already-tracked row — fixed the same way, by diffing every matchKey this run reached a confident decision about against what actually got upserted. | Server-rendered HTML (stateful ASP.NET WebForms via session cookie, no ViewState), no auth |
| Arkansas PSC CECPN/CCN dockets | `src/lib/ingest/arPscDockets.ts` | Cron weekly (09:30 UTC Mondays), `/api/cron/ingest-ar-psc`. Thirty-second state — Arkansas has no dedicated per-type case code; every matter (CECPN, CCN, rate cases, complaints, rulemakings, etc.) shares one flat docket-number sequence, with only the "-U" ("Utility") suffix ever carrying a real construction-certificate application, confirmed by sampling a live docket under every other real suffix in use. Also the first state in this series to be re-run live to verify the new Status-filter architecture (see the "Stop hiding resolved projects" commit): 17 real Arkansas dockets now persist at their true stage (11 granted, 1 denied, 5 pending) instead of resolved ones being deleted. | Server-rendered HTML, no auth |
| Delaware PSC Transmission CPCN + Community Energy Facility dockets | `src/lib/ingest/dePscDockets.ts` | Cron weekly (10:00 UTC Mondays), `/api/cron/ingest-de-psc`. Thirty-third state — Delaware's CPCN authority is split across two different statutes; this module deliberately tracks the project-specific one (26 Del. C. §203F, for renewable-interconnection facilities ≥30 MW) plus the non-CPCN "Preliminary Certificate to Operate" gate for Community Solar facilities up to 4 MW, and excludes the entity-level electric-supplier CPCN the same way this series excludes every other state's utility-licensing docket. | Server-rendered HTML (ASP.NET WebForms, cookie-based), no auth |

Every source above — the five original federal/national workbook/API sources plus all thirty-one
state docket modules — runs on Vercel Cron (`vercel.json`) with no manual step, staggered by the hour so
no two sources' runs overlap. Checking weekly means this site never lags more than ~1 week behind
whatever each source most recently published, not that each source itself updates that often.
Weekly (not the every-3-days this site originally shipped with) is a deliberate tradeoff to cut
invocation volume — see [`src/lib/ingest/README.md`](src/lib/ingest/README.md). Every ingestion run
upserts by a stable per-source ID (see the `matchKey`/`manualOverrides.csv` identity mechanism in
open question #1), so a re-run updates existing projects in place instead of duplicating them.

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
10. **State PUC/PSC dockets: thirty-three states down, 17 to go, each with
    its own hard problem.** Confirmed 2026-08-24: no national aggregator
    exists for state utility-commission dockets — each state runs its own
    system, and FERC eLibrary covers the federal side alone. `vaSccDockets.ts`,
    `txPuctDockets.ts`, `coPucDockets.ts`, `ohOpsbCases.ts`,
    `scPscDockets.ts`, `azAccLineSiting.ts`, `waEfsecFacilities.ts`,
    `nmPrcDockets.ts`, `ilIccDockets.ts`, `flPscDockets.ts`,
    `nyDpsDockets.ts`, `nvPucnDockets.ts`, `orEfscFacilities.ts`,
    `maEfsbDockets.ts`, `okOccDockets.ts`, `utPscDockets.ts`,
    `wiPscDockets.ts`, `kyPscDockets.ts`, `moPscDockets.ts`,
    `inIurcDockets.ts`, `njBpuDockets.ts`, `mdPscDockets.ts`,
    `ctCscDockets.ts`, `wvPscDockets.ts`, `tnTpucDockets.ts`,
    `caCecDockets.ts`, `nhSecDockets.ts`, `idPucDockets.ts`,
    `nePrbDockets.ts`, `laPscDockets.ts`, `alPscDockets.ts`,
    `arPscDockets.ts`, and `dePscDockets.ts` are all plain-HTTP-fetch
    sources, not scraping projects — no headless browser needed for any
    of them, same shape as this site's other sources — but none was
    "just add a module":
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
    - **Florida** has no CPCN process at the PSC at all — siting runs
      through a separate DEP process, and the PSC's "determination of
      need" is only a small opening sub-docket, confirmed by hand to cover
      exactly two dockets in the PSC's entire 30,555-docket history (solar
      is statutorily exempt from mandatory siting certification in
      Florida unless the developer opts in, so most of Florida's actual
      solar/storage build-out never touches this process at all). Also the
      one state where the *agency-of-record's own* status field is the
      one caught lying, not a second source: the PSC's own docket for an
      FPL transmission line shows a 2026-06-01 close date, but DEP's live
      Applications-in-Process page — the real multi-agency process the PSC
      docket only opens — still shows filings from 8/18/2026, ten weeks
      later.
    - **New York** covers two live siting-certificate tracks in one module
      since both live in the same underlying system: Article VII
      (transmission) and Article VIII of the Public Service Law (renewable
      generation, formerly Executive Law § 94-c until a 2024 state law
      repealed and replaced it — DPS's own records straddle both names
      inconsistently, confirmed by hand, so this module queries both). NY
      publishes no status field at all, and — a real gotcha found only by
      checking a specific granted case, Alfred Oaks Solar — the renewable
      track's actual grant order isn't even filed as an Order or Decision
      document type; it's plain correspondence titled
      "...Final_Siting_Permit_-_Signed," found only by scanning every
      filed document's title regardless of type. Real request volume also
      forced a scheduling tradeoff: a full run took 236s against a 300s
      cron budget, so its candidate cap was tightened for safety margin,
      a documented, accepted limitation (see the module header).
    - **Nevada** has no CPCN either — its equivalent, a Utility
      Environmental Protection Act (UEPA) permit, spans two entirely
      separate PUCN systems (a legacy WebForms docket list good only
      through ~October 2023, plus a modern OnBase JSON API for real status).
      Its hardest problem was multi-phase transmission reviews: a docket
      can have a bare "GRANTED" order and still be genuinely active months
      later because a new phase was filed after it — confirmed against
      five real GridLiance West dockets that would have been wrongly
      deleted as resolved under a naive "does any order say GRANTED"
      check. Fixed by requiring no later *substantive* filing (excluding
      routine same-day companion documents like service lists) after the
      most recent disposition.
    - **Oregon** has no siting authority in its own utility commission
      either, same pattern as Washington — the real body is the Energy
      Facility Siting Council (EFSC). Unusually, *both* of its own
      structured status fields turned out unreliable rather than just one:
      confirmed by cross-checking all 97 tracked facilities against each
      other, 37 disagreed, and every spot-checked disagreement was resolved
      correctly by a free-text narrative field and incorrectly by at least
      one structured field. Also this series' second real cross-state
      duplicate (after Grain Belt Express): Cascade Renewable Transmission,
      a 400kV HVDC line crossing the Columbia River, is the same physical
      project as an existing Washington EFSEC entry — merged via
      `manualOverrides.csv` into one row carrying both states' source
      links.
    - **Massachusetts** also has a real siting board (EFSB) separate from
      its DPU, same shape as WA/OR — confirmed by checking rather than
      assuming, since DPU's own "Siting" docket track mostly turned out to
      be companion filings to an EFSB docket already covered here. Its own
      "Closed Date" field can stay null for years after a real certificate
      grant (a docket kept receiving post-approval compliance filings
      indefinitely) — resolution is instead inferred from scanning every
      filed document's own type for a "Final Decision," cross-checked
      against a case that closed the opposite way (a formal withdrawal
      notice, no final decision ever filed). A near-miss caught by hand: a
      docket's most recent filing was "Notice of Withdrawal of Counsel,"
      an attorney leaving the case, not the project being withdrawn — a
      loose keyword match would have wrongly closed it.
    - **Oklahoma** has no generic CPCN process at all — its own "CCN"
      relief type is used almost exclusively by telecom carriers (zero of
      ~60 real filings sampled were electric). The real electric-siting
      equivalent is a narrower certificate under the High-Voltage
      Transmission Line Siting Act, and only 4 cases have ever been filed
      under it since the state's imaged-document system began in 2022 —
      all 4 already resolved as of shipping, so this module correctly
      upserts zero projects today, a real result confirmed by hand, not a
      bug. Real gotchas found anyway: case numbers aren't unique across
      docket types (a bare case-number search silently merged two
      unrelated dockets), and a real case's opening filing was clerked as
      "Other Document" rather than "Application," missed entirely by the
      obvious document-type filter.
    - **Utah** turned out similarly sparse: across the state's entire
      electric-docket history back to 1987, only 12 dockets are genuine new
      CPCN applications, and all 12 are already granted — another real,
      confirmed zero-candidate result (PacifiCorp/Rocky Mountain Power, which
      owns virtually all Utah retail generation and transmission, gets its
      resource decisions blessed through periodic Integrated Resource Plan
      acknowledgment rather than case-by-case CPCN siting). This project has
      no PDF-parsing dependency, so final orders — unstructured PDFs with no
      machine-readable grant/deny field — are read by decompressing their
      own FlateDecode content streams directly with Node's built-in `zlib`
      and pulling text out of the raw PDF operators, no new dependency
      added.
    - **Wisconsin** shares one docket case-type code across two statutes —
      the large-facility CPCN (Wis. Stat. § 196.491) and the smaller-facility
      Certificate of Authority (§ 196.49) — so no separate module or search
      was needed for each. Its own "Status" field turned out to be a
      records-retention lifecycle flag, not a case-decision one: two
      independently-known-decided dockets (one energized since 2023, one
      operating since shortly after its 2019 grant) both still show
      "Active" 7+ years later. The real signal is a filed order titled
      "Final Decision" — confirmed via a real docket whose title has an
      actual typo, "Signed ad Served," which is why the detection regex
      matches on "final decision" alone rather than the fuller phrase.
    - **Kentucky** is the first state in this series where the obvious
      status signal actually held up: its case-search "Include Closed"
      filter was checked both directions against real dockets (a
      years-old still-open case with no PSC action since 2022; a closed
      case with a real "Final Order Entered" granting a certificate) and
      used as the primary signal, with a text-based grant/deny scan kept
      only as a defensive secondary check. Its own scoping problem instead:
      a broad "Construct" case-type code also covers new headquarters
      buildings, AMI rollouts, fiber/broadband construction, and
      cooling-tower retrofits, none of them a generation/transmission
      project — filtered out by requiring the real construction phrase.
    - **Missouri** required a real post-shipping fix, caught in this
      project's own standard verification step, not left to production: an
      anchored regex for "Order Approving Stipulation and Agreement" missed
      real title variants with a modifier word inserted ("...Approving
      Third Stipulation..." / "...Approving Unanimous Stipulation..."), and
      a second signal — "Closing File" — was filed under both "Order" and
      "Notice" filing types, but the original resolution check only ever
      scanned type "Order". Together these left several already-resolved
      2018/2019 dockets showing as still waiting until a post-run
      data-quality check against the live DB caught it, fixed both, and
      confirmed the fix removed exactly the stale rows and no others.
    - **Indiana** turned out to have a soft security gap rather than a data
      gotcha: its public docket-search page shows a Google reCAPTCHA
      widget, but that widget is checked only in the page's own client-side
      JS — the real backing search API (a separate companion Azure App
      Service the portal's JS calls cross-origin) never receives or
      validates a token, confirmed by posting to it directly. Its "Case
      Status" field held up under independent checking against filed Final
      Orders; an "Appealed" case gets its own dedicated stage
      ("litigation") instead of being deleted like every other resolved
      status, since the Commission's Final Order already exists but is
      still being challenged in court.
    - **New Jersey** has no CPCN process at all; the closest equivalents are
      two distinct docket types (a 40:55D-19 "reasonably necessary for the
      public" determination, and a Competitive Solar Incentive Program
      siting-prohibition waiver) covered by one module. Its own "Case
      Status" field was found stale by nine years on a real granted docket,
      so resolution is instead read from the most recent Board Order PDF's
      own text — decompressed with Node's built-in `zlib`, since this
      project has no PDF-parsing dependency and Utah's module
      (`utPscDockets.ts`) had already proven the same technique works.
    - **Maryland** has no case "Status" field at all; "still waiting" is
      inferred from scanning every filed document for a dispositive
      Commission/Public Utility Law Judge order, calibrated against a full
      scan of all 175 real cases (not a sample) after four different
      heuristics were tried and rejected — real dispositive orders use
      surprisingly varied phrasing, including some filed with no descriptive
      subject at all beyond the order number itself. A post-run data-quality
      check against the live DB (this project's own standard verification
      step, not left to production) caught a real county-extraction bug — a
      free-form "capitalized words before COUNTY" regex swept in preceding
      caption text since these captions are themselves ALL CAPS — fixed with
      a whitelist of Maryland's 23 real county names, which also caught a
      genuine source typo ("DORCESTER" for "Dorchester" in one real caption).
    - **Connecticut** follows the same "real siting authority isn't the
      obvious one" pattern as Washington, Oregon, and Massachusetts — PURA
      is only a commenter into the Connecticut Siting Council's own process.
      CSC has no queryable docket search at all, only hand-typed CMS pages,
      and its own disclaimer that it may not stay up to date was confirmed
      true by hand: a petition granted in 2013 was still listed as an open
      matter in 2026, caught only by cross-checking every candidate against
      CSC's own historical Decision and Order List. A structural bug — not
      a parsing bug — was found and fixed during this project's own
      verification step: the module was silently excluding resolved
      candidates from its output entirely rather than passing them through
      with a resolved stage, which meant a project already tracked from a
      prior run that later resolved would never be revisited or deleted
      (`upsertNormalizedProject` in `common.ts` only deletes a project when
      it's *passed in* with a resolved stage — it never diffs "everything
      previously tracked, minus what showed up this run"). Fixed by pushing
      every resolved candidate through with `currentStage: "cancelled"`.
    - **West Virginia** splits its construction-certificate authority
      across a general CPCN and a separate Siting Certificate for merchant
      generators, and produced this series' richest real STATUS dataset
      yet: a confirmed real denial, a case resolved via an ALJ Recommended
      Decision that auto-finalizes with no separate Commission order, and a
      confirmed false-positive (an unrelated Pro Hac Vice attorney-admission
      motion using the word "granted" in the same docket the resolution
      regex is written to ignore). Also caught two real bugs before
      shipping: a hybrid gas+solar filing was tagged "solar" because fuel
      keywords were checked in a fixed declaration order rather than
      whichever technology is actually named first in the caption; and the
      same structural "vanished candidate" bug found in Connecticut, here
      triggered a different way — WV's own case search is scoped
      Active-only, so a case whose Active flag flips to Closed disappears
      from every future search before this module's own resolution check
      ever gets a chance to run on it, rather than the check itself missing
      it. Fixed by diffing this source's previously-tracked matchKeys
      (queried directly from the DB) against each run's active-candidate
      list and pushing a resolved stub for anything that vanished.
    - **Tennessee** is a genuine, confirmed zero-yield source, not a
      scraping gap: TVA, a federal instrumentality exempt from TPUC's
      certificate jurisdiction, supplies the overwhelming majority of the
      state's generation, and its ~150 local power companies hold
      exclusive pre-assigned territories under TVA contracts — so a
      new-entrant electric CCN essentially never triggers. Scanning the
      entire 160-docket active population by hand (not a sample) found
      zero currently-open electric generation/transmission/storage CCN
      candidates; every real CCN-type caption is a water utility expanding
      service territory or a telecom carrier's franchise application. Kept
      live anyway as a "standing watch for a rare event" source, the same
      convention this project already uses for ORNL hydro's own thin
      population, and given the same preventive "vanished candidate" fix
      as Connecticut/West Virginia even though nothing exists yet to have
      gone stale.
    - **California** required ruling out the obvious agency first: CPUC's
      own "Proceeding Information Search" is an Oracle APEX app whose real
      search submit path is client-side Dynamic Action logic invisible to a
      plain `fetch()` — confirmed two ways (a raw POST replay that gets
      redirected but never actually persists the search terms, and a real
      Chromium session where the search click never reached the actual
      postback endpoint at all, losing the typed value both times). No
      CAPTCHA, no login wall — just a fragile SPA-only interface with no
      plain-HTTP path, correctly deferred per this project's standing
      guidance rather than forced. CEC turned out to be the real gate
      instead: it has exclusive jurisdiction over ≥50MW thermal/geothermal
      plants and, since AB 205, ≥50MW solar/wind and ≥200MWh storage, and
      nearly every large project files there rather than at CPUC. A false
      positive was caught before shipping — a local air district's own
      "Notice of Decision," unrelated to CEC's actual siting decision, an
      earlier version of the resolution regex would have wrongly matched —
      along with the same "vanished candidate" structural bug already found
      in Connecticut/West Virginia (CEC's own listing query is scoped to
      Under Review/Suspended Proceedings status only).
    - **New Hampshire** is the fourth real confirmed instance of "the real
      siting authority isn't the obvious utility commission" (after
      Washington, Oregon, Massachusetts, and Connecticut): RSA 162-H
      assigns siting authority exclusively to the Site Evaluation
      Committee, and the PUC's 3 commissioners are only 3 of SEC's 5
      statutory members — they cannot alone constitute a quorum. A
      December 2025 restructuring moved SEC's own docket records onto the
      PUC's website under an "SEC" prefix, which is exactly what makes it
      look like "the PUC does siting" at first glance. Caught a real
      false-positive before shipping: a docket "rejected" as procedurally
      incomplete reads exactly like a final denial by keyword match
      ("Application" + "Certificate" + "Rejecting" all present) but isn't
      one — confirmed against a real docket that continued for 190+ more
      filings after its own "rejection." Also confirmed and documented a
      real access-tooling gotcha: a bare `curl` GET against any nh.gov
      subdomain returns a hard TLS-fingerprint bot block, but the exact
      same request via Node's own `fetch()` (the real runtime this module
      and Vercel's serverless functions use) returns a clean 200 with no
      special handling — not a real blocker, just a curl-specific false
      alarm, documented so a future maintainer doesn't mistake it for one.
    - **Idaho** is one of the first states in this series to publish a
      genuinely structured case Status field — but it turned out not to
      need order-document text parsing anyway, for a real structural
      reason: `common.ts`'s RESOLVED_STAGES logic deletes a project
      identically whether it's given "approved" or "cancelled," so once a
      case closes, IPUC's own open/closed split is already enough — this
      site can't visibly distinguish "granted" from "denied" either way. A
      real regex bug was caught before shipping by comparing the dry-run's
      own output against a hand-verified count: a word-bounded
      `\bcertificate\b` search silently excluded every real
      "CERTIFICATES OF..." (plural) caption, since there's no word
      boundary between "certificate" and a trailing "s" — undercounting 4
      real candidates down to 1, the same gap independently confirmed live
      in IPUC's own search box. Also confirmed a real joint-owner
      duplicate (two utilities each filing their own CPCN for the same
      physical transmission line segment), kept as two separate rows per
      this project's standing non-dedup policy.
    - **Nebraska** has no investor-owned electric utilities at all (the only
      state served entirely by public power) and no PSC jurisdiction over
      electric certificates — the real authority is the Power Review Board,
      which publishes no case-search tool or docket database of any kind.
      "Still waiting" is inferred entirely from the Board's own meeting
      minutes prose. Two real structural bugs were found and fixed via a
      live DB check before shipping: a contested case's facts and its
      resolution can each live in a different, non-adjacent paragraph than
      its first/last mention — an initial "first mention = facts, last
      mention = status" design got this wrong both directions, once
      garbling a real case's name and fields, once misclassifying a
      genuinely-granted case as still pending because a later, unrelated
      paragraph merely name-dropped the case number in a segue sentence.
      All 13 real in-scope candidates as of shipping had already resolved
      — Nebraska's small, mostly-uncontested caseload usually clears
      within a single Board meeting — a real zero-currently-pending result
      confirmed by hand against live minutes text, not a scraping gap.
    - **Louisiana** has no single named CPCN statute — a promising-looking
      hit, La. R.S. 45:1503, turned out to be a 1968 telecom statute, a
      real wrong-guess trap caught only by reading the actual statute
      text. The real gate is a consistent "certification"/"approval to
      construct" docket practice, calibrated against a full, real
      191-docket sample with zero false positives. New Orleans's exclusion
      was confirmed definitively, not assumed: Entergy New Orleans never
      appears anywhere in LPSC's ~16,900-docket history, since it's
      regulated solely by the City Council. LPSC's own Status field lies
      in an unusually sharp way among this series' sources — it stays
      "Open" for months or years after a real granting order, since LPSC
      keeps a docket open for post-approval compliance monitoring. This
      project's own live-DB verification step caught a real bug the
      module's original calibration missed: a confirmed-real grant order
      used a curly Unicode apostrophe ("Judge’s Recommendation") that a
      straight-ASCII-apostrophe regex silently failed to match, leaving a
      resolved docket wrongly shown as still pending.
    - **Alabama** has a CPCN statute that isn't electric-specific — the
      same flat docket-number sequence covers electric, gas, water, and
      steam utilities, so scoping runs entirely on client-side content
      filtering rather than a dedicated docket-code prefix the way most
      sibling states have. Found a real full-text search indexing gap that
      would have made the exact kind of very-recently-filed docket this
      site cares about most systematically invisible: Alabama Power's
      real, current "Lindsay Hill" generating-station CPCN (granted 2025)
      never appeared in the phrase search at all, across a full 26-year
      lookback, confirmed three separate ways including a site-wide search
      for the docket's own misspelled wording. Fixed with a second,
      independent discovery path over structured metadata (company name +
      filed date) rather than full-text search, scoped to Alabama Power
      itself since it's confirmed to be effectively the sole real filer of
      electric generation/transmission CPCN petitions. Also found a real
      vanished-candidate bug in a new shape: two false positives upserted
      before a content filter was tightened would have frozen in the DB
      forever, since content-based rejection — unlike every prior state's
      status-filter-triggered version of this same bug class — never
      naturally revisits an already-tracked row on a later run. Fixed the
      same way, by diffing every matchKey this run reached a confident
      decision about (pushed through OR positively rejected) against what
      actually ended up upserted.
    Widening any of the thirty-one states' scope, or evaluating the other
    research leads already confirmed viable in parallel (North Carolina
    works too but needs a stateful session/postback-counter dance and
    Cloudflare-aware headers, real extra engineering weight; Pennsylvania,
    Georgia, Minnesota, Michigan, Kansas, Iowa, Montana, and Mississippi stay
    deferred — PA has no caption
    field in search results, GA's has one but it's server-side broken and
    always returns the full unfiltered set, Minnesota's entire eDockets/
    eFiling platform sits behind a live Cloudflare Turnstile CAPTCHA or an
    account login with no unauthenticated path at all, Michigan's real
    docket search is a Salesforce Experience Cloud app whose data only
    loads via an internal Aura RPC endpoint — the same access pattern
    documented as a 2025-26 mass-scraping technique against misconfigured
    Salesforce orgs, not a risk worth taking on for this project, and its
    one plain-HTTP fallback has no caption field without adding a new
    PDF-parsing dependency — and Kansas's old plain-HTTP docket portal
    (`estar.kcc.ks.gov`) was fully decommissioned in November 2025, replaced
    by "KCC-Connect," the exact same kind of Salesforce Aura Community site
    as Michigan's (confirmed via its `robots.txt`, response headers, and a
    content-free Aura loading shell in place of any server-rendered docket
    data), but with no plain-HTTP fallback left at all, unlike Michigan's
    partial one — and Iowa's Electronic Filing System (`efs.iowa.gov`, a
    2023-relaunched Angular SPA over a real REST API) confirmed its exact
    CPCN-equivalent scope via its own public lookup-table endpoints (a
    Generating Certificate Utility docket type and a separate Chapter 478
    electric-franchise process, complete with a `countyIds` filter that
    would have sidestepped Iowa's 99-county whitelist problem entirely) but
    every docket/franchise search-view and detail endpoint returns a real
    backend-enforced HTTP 401 requiring a logged-in account — a genuine auth
    wall, not just a frontend guard, confirmed by hitting the API directly —
    and Montana has two real candidate authorities, both confirmed
    unworkable: the PSC's modern case system (REDDI, migrated onto Pega
    Constellation) gates its login behind a live CAPTCHA and its own
    "Continue as Guest" option only exists inside an HTML comment, rendered
    by client-side JS never reachable via plain `fetch()` — its older
    plain-HTML predecessor systems are fully decommissioned (connection
    reset/404). The alternate real siting authority, DEQ's Major Facility
    Siting Act (which, following this series' WA/OR/MA/CT precedent, turned
    out to be the real gate for large transmission/pipeline projects, not
    the PSC), is reachable with no auth at all but has a population of
    exactly one in-scope project and no case-numbering, search, or
    historical archive of any kind to calibrate a status heuristic
    against — thinner and less verifiable than this series' existing
    thinnest shipped source — and Mississippi's real docket system
    (`ctsportal.psc.ms.gov`, the same underlying "Valence" platform
    laPscDockets.ts already ingests successfully) is currently down with a
    live, reproducible backend bug: every Docket-related endpoint returns
    HTTP 500 with a TLS handshake failure between MPSC's own app server and
    its internal REST API dependency, confirmed against 4 different real
    docket IDs and reproduced across several minutes of retries, while a
    sibling non-docket search on the same server returns a clean 200 — an
    ops-side outage on MPSC's own infrastructure, not a structural wall,
    worth a quick recheck in a few weeks rather than ruled out permanently
    (Mississippi's own fallback community portal is Salesforce Aura-only,
    the same class of blocker as Kansas/Michigan, so isn't a usable
    workaround in the meantime)), are real next options — each needs the
    same "confirm before guessing" treatment this project holds itself to,
    one state (and one scope/status decision) at a time, not assumed to
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
