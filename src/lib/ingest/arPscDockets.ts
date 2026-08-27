// Arkansas Public Service Commission (APSC) Certificate of Environmental
// Compatibility and Public Need (CECPN, Ark. Code Ann. §23-18-501 et seq.,
// the "Utility Facility Environmental and Economic Protection Act") +
// Certificate of Convenience and Necessity (CCN, Ark. Code Ann. §23-3-201
// et seq.) docket ingestion — one of several states built in parallel in
// the per-state series started with vaSccDockets.ts (see that file's
// header for the overall rationale). Confirmed by hand 2026-08-24/25 via
// real GET/POST requests against the live apps.apsc.arkansas.gov "olsv2"
// site — no assumption below was taken from documentation or
// training-data memory alone.
//
// SCOPING: Arkansas's own docket numbers are a single flat sequence
// (format YY-NNN-<suffix>) shared by every matter type, with the suffix
// letter(s) marking the docket's category — confirmed live by pulling the
// docket-search page's own "open dockets" dropdown (432 real open dockets
// as of 2026-08-24) and sampling every real suffix it contains: A, C, CA,
// F, FR, MR, P, PR, R, RP, SD, T, TF, and U. One real Style caption was
// pulled for a live sample docket under every suffix EXCEPT U (13 samples)
// and every single one turned out to be a non-project administrative
// matter — energy-efficiency opt-out notices (SD), gas-audit-program
// reports (RP), cost-of-energy adjustment reports (CA), a special-rate
// contract (P), a customer complaint (C), a promotional-practices document
// repository (PR), "miscellaneous non-docketed records" (MR), a formula
// rate review (FR), cogenerator/small-power-producer rules (F), Universal
// Service Fund reports (A), a literal "Test Docket" (T), a nuclear
// decommissioning cost rider (TF), and a rulemaking (R) — never a
// construction-certificate application. "U" ("Utility") is the one
// suffix, confirmed live across 235 real "-U" dockets pulled from the same
// open-dockets list spanning 2001-2026, that carries every real electric
// CECPN/CCN application found (see FUEL/PROJECT TYPE below for the full
// real sample). This matches Louisiana's own "U-" (laPscDockets.ts) and
// Alabama's flat-docket-sequence findings for this series — Arkansas has
// no dedicated per-type case code the way KY/WV do.
//   Three distinct real construction-gate mechanisms were confirmed live,
//   all funneling into "-U" dockets, all treated as in-scope here:
//   1. CECPN (Ark. Code Ann. §23-18-510) — required for a "major utility
//      facility" (an electric generating plant of 50 MW+ or certain
//      transmission lines). Real confirmed captions: Docket 25-054-U
//      ("...A CERTIFICATE OF ENVIRONMENTAL COMPATIBILITY AND PUBLIC NEED
//      FOR CONSTRUCTION AND RELATED FINDINGS AND APPROVALS OF A SOLAR
//      GENERATING AND BATTERY ENERGY STORAGE SYSTEM FACILITY ... IN
//      JEFFERSON COUNTY, ARKANSAS", Entergy's "Cypress Solar" project);
//      Docket 26-041-U (500kV transmission line, Union County); Docket
//      25-066-U (Arkansas Electric Cooperative Corporation generation,
//      Independence County).
//   2. CCN (Ark. Code Ann. §23-3-201) — Arkansas's separate, older,
//      general "public convenience and necessity" certificate, required
//      for construction/extension of any public-service facility. Real
//      confirmed live gotcha, caught only by reading a real order's own
//      PDF text (see STATUS below): a project otherwise eligible for CECPN
//      can be exempted from the CECPN statute specifically and fall back
//      to CCN-only review — Docket 25-047-U (Entergy's "Jefferson Power
//      Station", a 754 MW gas combined-cycle plant) was filed seeking "a
//      Certificate of Environmental Compatibility and Public Need (CECPN)
//      ... and, if necessary, a Certificate of Convenience and Necessity
//      (CCN)"; its real Order No. 8 (confirmed via direct PDF text
//      extraction) finds the project qualifies as a "strategic investment"
//      under Act 373 of 2025 (an exemption for facilities "located on the
//      same or adjacent property" as an existing site — here, EAL's
//      existing White Bluff site) and rules "EAL's Application is exempt
//      from the CECPN statute but subject to the requirements of the CCN
//      statute," ultimately granting "a CCN for construction of JPS," not
//      a CECPN. CECPN and CCN are therefore both treated as the same
//      "real construction gate" here, matching this project's own framing
//      of a state's CPCN-equivalent — which certificate a given
//      application actually needs/receives is Arkansas's own internal
//      statutory routing question, not a scoping distinction that matters
//      to this module.
//   3. "Notice and Authority to Proceed" (Ark. Code Ann. §23-18-104) — a
//      real, separate, non-certificate mechanism confirmed live for
//      MULTI-STATE Arkansas-regulated utilities (Southwestern Electric
//      Power Company/SWEPCO, Oklahoma Gas & Electric/OG&E, Arkansas
//      Electric Cooperative Corporation/AECC) adding a generating facility
//      PHYSICALLY LOCATED OUTSIDE ARKANSAS whose cost Arkansas ratepayers
//      will partly bear — since the facility itself isn't sited in
//      Arkansas, APSC's siting-certificate jurisdiction doesn't apply, but
//      the utility still needs Commission "authority to proceed" before
//      including the cost in Arkansas rates. Real confirmed captions:
//      Docket 24-045-U ("...NOTICE AND FOR AUTHORITY TO PROCEED WITH THE
//      CONSTRUCTION OF A NATURAL GAS COMBUSTION TURBINE GENERATION
//      FACILITIES IN MORRIS COUNTY, TEXAS ... PURSUANT TO ARK. CODE ANN.
//      §23-18-104", AECC); Docket 23-085-U (OG&E, two gas combustion
//      turbines at Tinker Air Force Base, Oklahoma). A closely related
//      real pattern found live carries NEITHER "certificate" NOR "notice
//      and authority to proceed" language at all — a bare "Application for
//      APPROVAL TO ACQUIRE" a new out-of-state generating facility: Docket
//      26-056-U (SWEPCO, "...APPROVAL TO ACQUIRE A 200 MW BATTERY ENERGY
//      STORAGE SYSTEM IN RUSK COUNTY, TEXAS..."); Docket 25-070-U (OG&E,
//      a battery storage facility "IN THE STATE OF OKLAHOMA"); Docket
//      22-019-U (SWEPCO, new renewable generation facilities). GATE_RE
//      below matches all of "certificate of environmental compatibility",
//      "certificate of (public) convenience and necessity", "notice and
//      (for) authority to proceed", "approval to acquire", and "approval
//      to construct" for exactly this reason — a CECPN/CCN-only search
//      would silently miss every one of these real out-of-state
//      acquisition dockets.
//   OUT-OF-STATE PROJECT LOCATIONS: a real, structural consequence of
//   mechanism 3 above, not a bug — a meaningful fraction of Arkansas's own
//   real "-U" construction-gate dockets are for facilities physically
//   located in Texas or Oklahoma (see above). `state`/`county` below are
//   set to the project's REAL physical location (extracted from the
//   caption's own "... COUNTY, TEXAS"/"... STATE OF OKLAHOMA" text), not
//   forced to "AR", even though the source docket is an Arkansas one.
//
// FETCHING: apps.apsc.arkansas.gov/olsv2 is a plain, decades-old classic-ASP
// site. Confirmed by hand: no auth wall, no CAPTCHA, no session/cookie
// requirement of any kind — every request below is a fresh, stateless
// GET/POST (the site does issue an ASPSESSIONID cookie, but never requires
// it echoed back). Two real endpoints are used:
//   1. `GET docket_search.asp` — confirmed live to embed a complete
//      `<select>` dropdown of every currently-"open" docket number
//      (236 real "-U" entries as of 2026-08-24) directly in the page HTML,
//      no separate AJAX call or pagination needed. This is this module's
//      only discovery mechanism — there is no global full-text/keyword
//      search across all dockets on this site (Action Summary Search and
//      the Filtered Search both require a specific docket number as input,
//      confirmed live; Company Search requires a specific company name).
//      Confirmed live and load-bearing for why a bounded, per-year
//      sequential-numbering guess (the way this series' other states
//      sometimes bisect by date) isn't attempted either: real open "-U"
//      dockets in this list go back to 1990 (e.g. 90-999-U) — Arkansas
//      dockets, once opened, evidently often never get administratively
//      closed at all, even ones resolved decades ago (01-055-U, a CECPN
//      granted in the early 2000s per its own real caption, is STILL in
//      the live 2026 "open" list) — so this dropdown is a real, if
//      noisy and ever-growing, superset of every "-U" docket worth
//      checking, not a tight recent-activity window.
//   2. `POST docket_search_results.asp` (body: `CaseNumber2=<docket>`) —
//      the per-docket detail view. Confirmed live: a SINGLE response
//      already contains everything needed — the docket's own "Style"
//      (caption) text, an "Open: True/False" flag (see STATUS — confirmed
//      unreliable), a Company Name/Docket Role table (the first row with
//      Docket Role "Initiating Party" is the applicant — confirmed live
//      across every real candidate checked, a more robust applicant
//      extraction than parsing the Style caption text the way
//      wvPscDockets.ts/alPscDockets.ts have to), and the docket's COMPLETE
//      action/filing log (date + full description per entry, including
//      every Commission/ALJ order's own text) — no separate per-candidate
//      activity or order-search endpoint is needed at all, unlike every
//      other state in this series (WV needs a second activity-log
//      request, LA needs a second Order Search request). No pagination:
//      confirmed live even a heavily-litigated real docket (25-047-U, 119
//      real log entries as of 2026-08-24) renders on one page.
//   PDF fallback (see STATUS): `GET Docket_Search_Documents.asp?Docket=
//   <docket>&DocNumVal=<n>` returns a small intermediate page whose own
//   `<a href="/olsv2/viewdoc/pdfview.asp?document=<docket>_<n>_<v>.pdf">`
//   link names the real per-document PDF (the version suffix `<v>` isn't
//   guessable — confirmed live it's read from this link, never assumed to
//   be "_1"); fetching that pdfview.asp URL 302-redirects (confirmed live,
//   `fetch()` follows this automatically) to a static
//   `/pdf/<YY>/<docket>_<n>_<v>.pdf` — the same static PDF path convention
//   also used by APSC's older apscservices.info mirror. Confirmed live
//   these order PDFs are digitally generated (FlateDecode content
//   streams, embedded Helvetica), not scanned images — the same
//   dependency-free `zlib.inflateSync`-based PDF text extractor
//   njBpuDockets.ts built (see extractPdfText below, ported with minor
//   literal-string-escape decoding added) works unmodified.
//
// STATUS: docket_search_results.asp's own "Open: True/False" field is
// CONFIRMED LIVE UNRELIABLE, the same lesson this series has learned state
// after state — Docket 25-047-U (Entergy's Jefferson Power Station) and
// Docket 24-072-U (Entergy's Lake Catherine Unit 5) both show "Open: True"
// as of 2026-08-24 despite BOTH having a real Commission/ALJ order already
// granting a CCN/CECPN, and both now being under construction with real
// quarterly "Construction Status Report" filings on the docket — APSC
// evidently never flips a docket to "Closed" while post-approval
// Independent Monitor oversight/quarterly reporting continues, exactly
// the pattern this series' WV/LA/AL modules document for their own
// sources. "Still waiting" is instead determined by scanning the docket's
// own action log for entries matching `^\d+\.\s*(?:ORDER|ORDR)\s*NO` (most
// recent first) — "ORDR" is a real, confirmed, live source typo for
// "ORDER" (Docket 25-047-U's own log entry #158, "ORDR NO. 10", not
// silently corrected, matched as a known alias) — then checking each
// order for a resolving verdict:
//   1. First, cheaply, against the order's own LOG-ENTRY SUMMARY TEXT
//      (GRANT_RE/DENY_RE/DISMISS_RE below). Real confirmed to work
//      directly for some orders: Docket 24-072-U's real Order No. 9 reads,
//      in full, in the log itself: "IT IS, THEREFORE, ORDERED THAT:
//      Entergy Arkansas, LLC is granted a CECPN for the construction and
//      operation of Lake Catherine Unit 5, a 446 MW hydrogen-capable,
//      simple-cycle natural gas combustion turbine in Hot Spring County,
//      Arkansas." — no PDF fetch needed for this one.
//   2. CONFIRMED REAL FALSE-POSITIVE RISK a bare "is granted" regex must
//      avoid, the same lesson wvPscDockets.ts's Case 26-0108-E-CN
//      pro-hac-vice example teaches, found live here in Docket 25-047-U's
//      own real order log: Order No. 1 ("...is granted on an interim
//      basis" — a protective-order motion), Order No. 4 ("...is hereby
//      granted intervention..." — a party's motion to intervene), and
//      Order No. 5 (same, a different intervenor) all say "granted" about
//      something that isn't the certificate/application at all. GRANT_RE/
//      DENY_RE below require "certificate"/"CECPN"/"CCN"/"application"
//      within 120 characters of the grant/deny verb specifically because
//      of this real, live data.
//   3. CONFIRMED LIVE, LOAD-BEARING REASON A PDF-TEXT FALLBACK IS
//      NECESSARY (not just a defensive nicety copied from
//      njBpuDockets.ts) — found via this project's own mandatory
//      full-population verification step, not assumed: Docket 25-047-U's
//      real Order No. 8 is genuinely the docket's dispositive grant order
//      (confirmed by fetching and text-extracting its own PDF: "EAL has
//      met the requirements of Ark. Code Ann. §23-3-201 et. seq. ... and
//      is granted a CCN for construction of JPS.") — yet ITS OWN LOG-ENTRY
//      SUMMARY reads only "Accordingly, the Commission finds, directs,
//      and orders as set forth in this order." — completely generic,
//      revealing nothing. Worse: this exact generic sentence is ALSO used
//      for at least one LATER, genuinely non-dispositive order in the same
//      docket (Order No. 9, a housekeeping order about the pending
//      rehearing petitions) — so "generic summary" cannot itself be used
//      as a positive signal for "this is the real grant," and a
//      "check only the most recent order" shortcut would have picked
//      Order No. 9 or Order No. 10 (an unrelated Independent-Monitor
//      consolidation order spanning three dockets) and missed the real
//      grant entirely. This module therefore scans EVERY order in a
//      candidate docket, most-recent first, checking the cheap
//      summary-text match first and falling back to fetching + extracting
//      that ONE order's own PDF only when the summary itself doesn't
//      resolve it — bounded by MAX_ORDER_PDF_FETCHES_PER_DOCKET as a
//      safety valve (flagged loudly via console.error, never silently
//      truncated, if a real docket ever exceeds it — not observed live in
//      this investigation; the busiest real candidate, 25-047-U, has 11
//      total order entries).
//   No real Arkansas CECPN/CCN DENIAL was found live to calibrate DENY_RE
//      against (a live web search for "denies"/"denied" alongside these
//      certificate phrases turned up nothing on point) — the same standing
//      gap this series' alPscDockets.ts/laPscDockets.ts document for their
//      own under-populated denial history. DENY_RE/DISMISS_RE are modeled
//      on the same statutory phrasing pattern GRANT_RE was confirmed
//      against, not independently confirmed live.
//   TWO REAL BUGS FOUND AND FIXED via this project's own mandatory full
//   live-DB-verification dry run (not hypothetical — both were caught by
//   actually inspecting what got upserted, not just reading code):
//   (a) GRANT_RE's original "is granted <certificate-word>" branch only
//       tolerated a single optional article, silently missing Docket
//       01-055-U's real Order No. 12 ("...is granted an Amended CECPN to
//       construct..." — "Amended" defeated the old regex); see GRANT_RE's
//       own comment below for the fix. (b) a real legacy-stub docket,
//       39-275-U (a 1938 rural-electrification CCN application still
//       sitting in APSC's own live 2026 "open" list — see FETCHING above
//       re: dockets that never get administratively closed), matches
//       GATE_RE/CONSTRUCTION_RE/ELECTRIC_RE by caption text alone but has
//       ZERO parseable action-log entries — no dates, no orders, nothing
//       — because it predates APSC's electronic filing system entirely.
//       With no filed date and no order history, this module cannot tell
//       whether it's really still pending; see the main loop's
//       `firstFiledDate === null` guard, which drops it rather than
//       guessing. A first, naive applicant-extraction fallback also
//       mis-reported this docket's applicant as "APSC General Staff" (a
//       standing-party name, present because no row is tagged "Initiating
//       Party" at all here) — fixed via NON_APPLICANT_PARTY_NAMES below.
//
// FUEL/PROJECT TYPE & CAPACITY: extracted from the docket's own Style
// caption text (no PDF fetch needed for non-candidates; real candidates
// that DO need a PDF fetch for resolution, per STATUS above, are not also
// re-mined for capacity from that PDF — matching this series' standing
// "don't fetch PDFs just for capacity" convention, e.g. wvPscDockets.ts).
// CONTENT_RE/GATE_RE was calibrated against a full, real, live 235-docket
// sample (every real "-U" docket in APSC's own open-dockets list as of
// 2026-08-24, spanning 2001-2026). The large majority of that sample (over
// 150 of 235) is Certificate-of-Public-Convenience-and-Necessity
// applications from COMPETITIVE LOCAL EXCHANGE CARRIERS/telecom
// companies — Arkansas, like Alabama, uses the exact same "certificate of
// public convenience and necessity" phrase for telecom CCNs as for
// electric ones (e.g. Docket 26-023-U, "...FOR A CERTIFICATE OF PUBLIC
// CONVENIENCE AND NECESSITY TO PROVIDE FACILITIES-BASED AND RESOLD LOCAL
// EXCHANGE AND INTEREXCHANGE TELECOMMUNICATIONS SERVICES..."). These are
// excluded WITHOUT needing a dedicated telecom keyword denylist, purely as
// a side effect of also requiring CONSTRUCTION_RE (construct/acquire/
// build/deploy) — confirmed live that not one of the 150+ real telecom CCN
// captions in the sample uses any of those verbs (they all say "TO
// PROVIDE ... SERVICES", never "TO CONSTRUCT"). NON_ELECTRIC_RE is kept
// anyway as defense-in-depth (telecom/water/gas-distribution keywords),
// matching alPscDockets.ts's own belt-and-suspenders convention, though
// never observed to actually fire against a real candidate in this
// sample. Other real, confirmed-live exclusions CONTENT_RE/CONSTRUCTION_RE
// correctly drop without a dedicated rule: a transmission-line SALE to a
// different utility (Docket 24-022-U, "...TO SELL A TRANSMISSION LINE AND
// ASSOCIATED ASSETS..." — no certificate/acquire/construct phrase at all);
// a CCN "TO OPERATE" an existing, already-built power plant for cost
// recovery (Docket 22-065-U, SWEPCO's John W. Turk Jr. plant — "TO
// OPERATE" carries no construct/acquire verb, so CONSTRUCTION_RE correctly
// never matches it, the same "existing facility, not new construction"
// exclusion wvPscDockets.ts's own cooling-tower-retrofit case documents);
// a gas-utility asset acquisition (Docket 21-060-U, CenterPoint/Summit —
// "ACQUIRE" is present but ELECTRIC_RE never matches, since the caption
// never mentions generation/transmission/MW/solar/wind/battery); a gas
// PIPELINE company's own CECPN+CCN application (Docket 21-046-U, Enable
// Natural State Pipeline — same ELECTRIC_RE non-match, correctly kept out
// of scope per this project's brief, which calls out electric generation/
// transmission specifically for Arkansas); and a nuclear-plant
// decommissioning-trust-fund docket (96-341-U — no certificate/acquire/
// construct phrase at all).
//   Project-type classification order (storage checked first, matching
//   this series' precedent that a narrower/more specific term should win
//   over a broader one): a real, confirmed hybrid caption calibrates
//   this — Docket 25-054-U, "...A SOLAR GENERATING AND BATTERY ENERGY
//   STORAGE SYSTEM FACILITY..." — storage-first classification correctly
//   tags this the same way laPscDockets.ts's own Docket U-37799 precedent
//   does.
//   Capacity: supports both real observed forms, "NNN MW" (Docket
//   26-056-U's own caption, "200 MW BATTERY ENERGY STORAGE SYSTEM") and
//   "NNN-megawatt"/"NNN megawatts" (only ever observed inside real order
//   PDF text, e.g. "754-megawatt natural gas-fired combined cycle
//   combustion turbine" and "446 MW hydrogen-capable" — NOT extracted from
//   PDF text here per the "don't fetch PDFs just for capacity" convention
//   above, so real coverage from the Style caption alone is thin, same
//   documented limitation as wvPscDockets.ts/laPscDockets.ts).
//
// COUNTY / OUT-OF-STATE LOCATION: extracted via a tight
// `IN <name> COUNTY, <STATE NAME>` anchor (see SCOPING's OUT-OF-STATE
// PROJECT LOCATIONS) rather than a free-form "capitalized words before
// COUNTY" regex — the exact greedy-regex hazard this series' Maryland
// module documented. An ARKANSAS-state match is additionally validated
// against a hardcoded whitelist of Arkansas's real 75 counties (defense in
// depth); a TEXAS/OKLAHOMA-state match is trusted directly from the tight
// capture without a second neighboring-state whitelist — a deliberate,
// documented scope decision (building and maintaining full TX/OK county
// lists inside an Arkansas-sourced module was judged not worth it for the
// small, real out-of-state-facility population found — see SCOPING).
//
// VANISHED-CANDIDATE FIX (superseded 2026-08-25): this module's own
// candidate discovery is scoped to docket_search.asp's "open dockets"
// dropdown — and while that list is confirmed live to be heavily
// OVER-inclusive (real resolved dockets from decades ago never drop off
// it, see FETCHING), it is not GUARANTEED never to shrink: if APSC ever
// does administratively close a docket this module previously tracked as
// still-pending, for a reason its own order-log scan (see STATUS) never
// catches as a grant/deny/dismissal, that docket would vanish from a
// future run's candidate list. Originally fixed by pushing a resolved
// stub (guessing currentStage="cancelled") for any previously-tracked
// "ar-psc:" matchKey no longer in that run's still-pending set, so
// common.ts would delete it. That fix is now itself superseded:
// common.ts no longer deletes resolved-stage projects (they're kept and
// surfaced through the frontend's Status filter), so guessing "cancelled"
// for a docket that dropped off the list would mean permanently
// mislabeling it — it's at least as likely to have been granted — in a
// bucket real users can now see. A docket that vanishes from the open
// list is therefore left untouched, not guessed into a resolved stage. A
// docket that resolves (grant/deny/dismiss) via this run's own order scan
// is unaffected by this change at all — it's still pushed through
// directly from the main loop with its real resolved stage.
//
// Real per-run timing measured 2026-08-25 against the live shared DB: see
// dry-run report alongside this module.
//
// Wired to Vercel Cron weekly (see vercel.json and
// src/app/api/cron/ingest-ar-psc/route.ts).

import zlib from "node:zlib";
import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://apps.apsc.arkansas.gov/olsv2";
const OPEN_DOCKETS_URL = `${BASE_URL}/docket_search.asp`;
const DOCKET_DETAIL_URL = `${BASE_URL}/docket_search_results.asp`;
const DOC_INTERMEDIATE_URL = (docket: string, docNumVal: string) =>
  `${BASE_URL}/Docket_Search_Documents.asp?Docket=${encodeURIComponent(docket)}&DocNumVal=${encodeURIComponent(docNumVal)}`;
const DOCKET_SHARE_URL = (docket: string) => `${BASE_URL}/docket_search_results.asp?CaseNumber=${encodeURIComponent(docket)}`;

// Real live "-U" open-docket population is 236 as of 2026-08-24, and —
// per module header FETCHING — this list only ever grows (Arkansas
// dockets rarely if ever fully close). Set generously above that for
// years of headroom.
export const MAX_CANDIDATES = 600;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
// See module header STATUS point 3 — a safety valve, not tuned tightly to
// the busiest real docket found (25-047-U, 11 real order entries).
const MAX_ORDER_PDF_FETCHES_PER_DOCKET = 20;
// See module header FETCHING PDF fallback — matches njBpuDockets.ts's own
// cap, kept for the same reason (protect against an unexpectedly huge
// order PDF).
const MAX_ORDER_PDF_BYTES = 60 * 1024 * 1024;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as every other module in this series, not a full HTML-entity
// library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

// Real observed action-log date format: "7/7/2025" (no zero-padding).
function parseMDY(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// See module header FETCHING — a single embedded <select> in the docket
// search page's own HTML, confirmed live 2026-08-24. Scoped to "-U"
// (Utility) dockets only — see module header SCOPING for the empirical
// confirmation across every other real suffix.
const OPEN_U_DOCKET_RE = /<option value="(\d{2}-\d{3}-U)">\d{2}-\d{3}-U<\/option>/g;

async function fetchOpenUDockets(): Promise<string[]> {
  const res = await fetch(OPEN_DOCKETS_URL);
  if (!res.ok) throw new Error(`AR PSC open-dockets page request failed (${res.status})`);
  const html = await res.text();
  const dockets: string[] = [];
  for (const m of html.matchAll(OPEN_U_DOCKET_RE)) dockets.push(m[1]);
  if (dockets.length === 0) {
    throw new Error(
      "AR PSC open-dockets page didn't contain any recognizable \"-U\" <option> entries — the page structure likely changed. Check fetchOpenUDockets in src/lib/ingest/arPscDockets.ts against a fresh response.",
    );
  }
  return dockets;
}

interface CompanyRow {
  name: string;
  role: string;
}

interface OrderEntry {
  docNumVal: string;
  date: Date | null;
  summary: string;
}

interface DocketDetail {
  docket: string;
  style: string;
  companies: CompanyRow[];
  firstFiledDate: Date | null;
  orders: OrderEntry[];
}

const STYLE_RE = /<strong>Style:<\/strong>\s*([\s\S]*?)<\/p>/i;
// Confirmed live 2026-08-24/25 — the Company Name/Docket Role table's own
// row markup (see module header FETCHING).
const COMPANY_ROW_RE = /<tr style="background-color:silver; color:Black;">\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/g;
// Confirmed live 2026-08-24/25 against the action-log's own markup — each
// entry is a numbered "N. <description>" span following a DocNumVal link
// and a plain date span. Handles both real observed summary-span colors
// (Black for public entries, Red for confidential/HSPI ones).
const LOG_ENTRY_RE =
  /<a href="Docket_Search_Documents\.asp\?Docket=[^&]+&amp;DocNumVal=(\d+)">[^<]*<br \/><\/a><span style="color:black;">([^<]*)<\/span>\s*<\/div>\s*<div class="fivesixth gutterless">\s*<span style='color:(?:Black|Red);'>([\s\S]*?)<\/span>/g;
// See module header STATUS — "ORDR" is a real, confirmed live source typo
// for "ORDER" (Docket 25-047-U's own log entry #158), matched as a known
// alias, not silently corrected.
const ORDER_ENTRY_RE = /^\d+\.\s*(?:ORDER|ORDR)\.?\s*NO\.?\s*\d/i;

async function fetchDocketDetail(docket: string): Promise<DocketDetail> {
  const res = await fetch(DOCKET_DETAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ CaseNumber2: docket, CaseNumber: "Select Docket" }).toString(),
  });
  if (!res.ok) throw new Error(`AR PSC docket detail request failed (${res.status}) for docket ${docket}`);
  const html = await res.text();

  const styleMatch = STYLE_RE.exec(html);
  if (!styleMatch) {
    throw new Error(
      `AR PSC docket detail response for docket ${docket} didn't contain a recognizable "Style:" field — the page structure likely changed. Check fetchDocketDetail in src/lib/ingest/arPscDockets.ts against a fresh response.`,
    );
  }
  const style = stripTags(styleMatch[1]);

  const companies: CompanyRow[] = [];
  for (const m of html.matchAll(COMPANY_ROW_RE)) {
    companies.push({ name: decodeHtmlEntities(m[1]), role: decodeHtmlEntities(m[2]) });
  }

  let firstFiledDate: Date | null = null;
  const orders: OrderEntry[] = [];
  for (const m of html.matchAll(LOG_ENTRY_RE)) {
    const docNumVal = m[1];
    const date = parseMDY(decodeHtmlEntities(m[2]));
    const summary = stripTags(m[3]);
    if (firstFiledDate === null && date !== null) firstFiledDate = date;
    if (ORDER_ENTRY_RE.test(summary)) orders.push({ docNumVal, date, summary });
  }

  return { docket, style, companies, firstFiledDate, orders };
}

// See module header FETCHING PDF fallback — the intermediate page's own
// link names the real PDF filename (including a version suffix that isn't
// guessable), confirmed live 2026-08-24/25.
const PDF_LINK_RE = /href="\/olsv2\/viewdoc\/pdfview\.asp\?document=([^"]+\.pdf)"/i;

async function fetchOrderPdfUrl(docket: string, docNumVal: string): Promise<string | null> {
  const res = await fetch(DOC_INTERMEDIATE_URL(docket, docNumVal));
  if (!res.ok) return null;
  const html = await res.text();
  const m = PDF_LINK_RE.exec(html);
  return m ? `${BASE_URL}/viewdoc/pdfview.asp?document=${m[1]}` : null;
}

// Minimal, dependency-free PDF text extractor — ported from
// njBpuDockets.ts's own extractPdfText (see that module's header "PDF TEXT
// EXTRACTION" for the original engineering rationale). Confirmed live
// 2026-08-24/25 against a real AR PSC order PDF (Docket 25-047-U's Order
// No. 8): digitally generated (FlateDecode content streams, embedded
// Helvetica), not a scanned image, so this simple TJ/Tj-operator scan over
// each inflated content stream reliably recovers the order's real text.
function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\(\d{3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\([()\\])/g, "$1");
}

const PDF_TEXT_OP_RE = /\[((?:[^[\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
const PDF_TJ_ARRAY_STRING_RE = /\(((?:[^()\\]|\\.)*)\)/g;
const PDF_STREAM_RE = /stream\r?\n([\s\S]*?)endstream/g;

function extractPdfText(buf: Buffer): string {
  const str = buf.toString("latin1");
  let text = "";
  for (const m of str.matchAll(PDF_STREAM_RE)) {
    let inflated: string;
    try {
      inflated = zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      continue; // not a FlateDecode stream (e.g. an embedded font/image) — skip.
    }
    for (const op of inflated.matchAll(PDF_TEXT_OP_RE)) {
      if (op[1] !== undefined) {
        for (const sm of op[1].matchAll(PDF_TJ_ARRAY_STRING_RE)) text += decodePdfLiteralString(sm[1]);
      } else if (op[2] !== undefined) {
        text += decodePdfLiteralString(op[2]);
      }
    }
    text += "\n";
  }
  return text;
}

async function fetchOrderPdfText(docket: string, docNumVal: string): Promise<string | null> {
  const pdfUrl = await fetchOrderPdfUrl(docket, docNumVal);
  if (!pdfUrl) return null;
  const res = await fetch(pdfUrl);
  if (!res.ok) return null;
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_ORDER_PDF_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ORDER_PDF_BYTES) return null;
  return extractPdfText(buf);
}

type Resolution = "granted" | "denied" | "dismissed" | null;

// See module header STATUS for how each pattern was calibrated against
// real, live-confirmed AR PSC orders — including a real confirmed grant
// (Docket 24-072-U's Order No. 9, matched directly from its log summary)
// and a real confirmed false-positive risk (Docket 25-047-U's Orders 1/4/5,
// all saying "granted" about a protective-order motion or party
// intervention, never the certificate/application itself) that GRANT_RE
// requires "certificate"/"CECPN"/"CCN"/"application" nearby specifically
// to avoid. No real denial was found live to calibrate DENY_RE/DISMISS_RE
// against — see module header STATUS.
// CONFIRMED REAL BUG, caught only by this project's mandatory full
// live-DB-verification step (not a hypothetical): an earlier version of
// the "is granted <certificate-word>" branch below only tolerated a single
// optional article ("a"/"an") between "granted" and "cecpn|ccn|certificate"
// — Docket 01-055-U's own real Order No. 12 (a 2024/2025 ALJ order
// granting a capacity-addition amendment to a CECPN originally issued in
// 2001) reads "AECC is granted an Amended CECPN to construct, own,
// operate, and maintain the 95 MW Capacity Addition to the Fitzhugh
// Plant." — the word "Amended" between "granted" and "CECPN" silently
// defeated the old regex, leaving a confirmed-granted 2024 order (and the
// whole decades-old docket) wrongly shown as still pending. Widened to
// tolerate up to 30 characters of intervening words (covers "an Amended
// CECPN", "a Certificate of...", etc.) — confirmed this still correctly
// avoids the false-positive risk documented above (Docket 25-047-U's own
// Orders 1/4/5 never put "certificate"/"cecpn"/"ccn" within 30 characters
// of "granted" at all).
const GRANT_RE =
  /\b(?:certificate|cecpn|ccn|application)\b[\s\S]{0,120}?\bis\s+(?:hereby\s+)?granted\b|\bis\s+(?:hereby\s+)?granted\b[\s\S]{0,30}?\b(?:cecpn|ccn|certificate)\b|\bapproves?\b[\s\S]{0,80}?\bapplication\b|\bapplication\b[\s\S]{0,80}?\bis\s+(?:hereby\s+)?approved\b/i;
// Modeled on the same "verb ... noun" gap GRANT_RE was fixed for above —
// not independently confirmed live (see module header STATUS: no real AR
// denial was found to calibrate against).
const DENY_RE =
  /\b(?:certificate|cecpn|ccn|application)\b[\s\S]{0,120}?\bis\s+(?:hereby\s+)?denied\b|\bis\s+(?:hereby\s+)?denied\b[\s\S]{0,30}?\b(?:cecpn|ccn|certificate)\b|\bdenies\s+(?:the\s+)?(?:application|certificate|petition)\b/i;
const DISMISS_RE = /\bdismisses?\s+(?:the\s+)?(?:application|docket|matter|case)\b|\bapplication\s+is\s+(?:hereby\s+)?dismissed\b/i;

function detectResolutionFromText(text: string): Resolution {
  if (DENY_RE.test(text)) return "denied";
  if (DISMISS_RE.test(text)) return "dismissed";
  if (GRANT_RE.test(text)) return "granted";
  return null;
}

// Scans a docket's own ORDER entries, most-recent first — see module
// header STATUS for why both the cheap summary-text check AND the PDF
// fallback are real, load-bearing steps, not redundant.
async function detectResolution(docket: string, orders: OrderEntry[]): Promise<Resolution> {
  const mostRecentFirst = [...orders].reverse();
  let pdfFetches = 0;
  for (const order of mostRecentFirst) {
    const fromSummary = detectResolutionFromText(order.summary);
    if (fromSummary) return fromSummary;

    if (pdfFetches >= MAX_ORDER_PDF_FETCHES_PER_DOCKET) {
      console.error(
        `AR PSC docket ${docket}: hit MAX_ORDER_PDF_FETCHES_PER_DOCKET (${MAX_ORDER_PDF_FETCHES_PER_DOCKET}) before finding a resolving order — some older orders were not checked. Check MAX_ORDER_PDF_FETCHES_PER_DOCKET in src/lib/ingest/arPscDockets.ts.`,
      );
      break;
    }
    pdfFetches += 1;
    await sleep(REQUEST_DELAY_MS);
    const pdfText = await fetchOrderPdfText(docket, order.docNumVal);
    if (pdfText) {
      const fromPdf = detectResolutionFromText(pdfText);
      if (fromPdf) return fromPdf;
    }
  }
  return null;
}

// See module header FUEL/PROJECT TYPE & CAPACITY — calibrated against a
// full, real, live 235-docket "-U" sample (2001-2026).
const GATE_RE =
  /\bcertificate of environmental compatibility\b|\bcertificate of (?:public )?convenience and necessity\b|\bnotice and (?:for )?authority to proceed\b|\bapproval to acquire\b|\bapproval to construct\b/i;
const CONSTRUCTION_RE = /\bconstruct\w*\b|\bacquir\w*\b|\bbuild\b|\bdeploy\w*\b/i;
const ELECTRIC_RE =
  /\belectric\b|\bgenerat(?:e|ing|ion|or)\b|\bpower plant\b|\bpower station\b|\bcombustion turbine\b|\bcombined cycle\b|\btransmission\b|\bsubstation\b|\bsolar\b|\bwind\b|\bbattery\b|\benergy storage\b|\b\d[\d,]*\s*(?:mw|kv|megawatts?)\b/i;
// Defense-in-depth only — see module header FUEL/PROJECT TYPE & CAPACITY.
// Never observed to actually fire against a real candidate in the
// 235-docket sample (CONSTRUCTION_RE/ELECTRIC_RE already exclude every
// real telecom/water/gas-distribution docket found).
const NON_ELECTRIC_RE =
  /\btelecommunications?\b|\blocal exchange\b|\binterexchange\b|\blong distance\b|\bcompeting local exchange\b|\bwater (?:service|works|utility)\b|\bsewer\b|\bnatural gas facilit(?:y|ies)\b|\bgas distribution\b|\bgas pipeline\b/i;

const STORAGE_RE = /\bbattery\b|\benergy storage\b/i;
const TRANSMISSION_RE = /\btransmission\b|\bsubstation\b/i;
const GENERATING_RE = /\bgenerat(?:e|ing|ion|or)\b|\bpower plant\b|\bpower station\b|\bcombustion turbine\b|\bcombined cycle\b/i;

const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/\bwind\b/i, "wind_onshore"],
  [/\bnatural gas\b|\bgas[- ]fired\b|\bgas[- ]to[- ]gas\b|\bcombustion turbine\b|\bcombined cycle\b|\bcoal[- ]to[- ]gas\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];

// Picks whichever fuel keyword appears FIRST in the text, same rationale
// wvPscDockets.ts/laPscDockets.ts document for their own pickFuelType.
function pickFuelType(text: string): FuelType | null {
  let best: { fuel: FuelType; index: number } | null = null;
  for (const [re, fuel] of FUEL_KEYWORDS) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { fuel, index: m.index };
  }
  return best ? best.fuel : null;
}

// Storage-first classification order — see module header FUEL/PROJECT
// TYPE & CAPACITY for the real Docket 25-054-U (solar + BESS) case this
// was calibrated against.
function inferProjectTypeAndFuel(text: string): { projectType: ProjectType; fuelType: FuelType } {
  if (STORAGE_RE.test(text)) return { projectType: "storage", fuelType: "storage" };
  if (GENERATING_RE.test(text)) return { projectType: "generation", fuelType: pickFuelType(text) ?? "other" };
  if (TRANSMISSION_RE.test(text)) return { projectType: "transmission", fuelType: "transmission" };
  // Real, confirmed gap: some genuine candidates (e.g. bare "approval to
  // acquire new renewable generation facilities" captions naming no
  // specific technology) carry no facility-type-revealing language beyond
  // GATE_RE's own match. Generation is used as the least-wrong bucket,
  // matching this series' "plurality default" convention (see
  // moPscDockets.ts/wvPscDockets.ts).
  return { projectType: "generation", fuelType: "other" };
}

// Supports both real observed forms — see module header FUEL/PROJECT TYPE
// & CAPACITY.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)[\s-]*(?:MW\b|megawatts?\b)/i;

function extractCapacityMw(text: string): number | null {
  const m = CAPACITY_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Arkansas's real 75 counties (standard, stable public list) — used as a
// hardcoded whitelist rather than a free-form "capitalized words before
// COUNTY" regex, the exact greedy-regex hazard this series' Maryland
// module documented for its own county extraction.
const AR_COUNTIES = [
  "Arkansas", "Ashley", "Baxter", "Benton", "Boone", "Bradley", "Calhoun", "Carroll", "Chicot", "Clark",
  "Clay", "Cleburne", "Cleveland", "Columbia", "Conway", "Craighead", "Crawford", "Crittenden", "Cross", "Dallas",
  "Desha", "Drew", "Faulkner", "Franklin", "Fulton", "Garland", "Grant", "Greene", "Hempstead", "Hot Spring",
  "Howard", "Independence", "Izard", "Jackson", "Jefferson", "Johnson", "Lafayette", "Lawrence", "Lee", "Lincoln",
  "Little River", "Logan", "Lonoke", "Madison", "Marion", "Miller", "Mississippi", "Monroe", "Montgomery", "Nevada",
  "Newton", "Ouachita", "Perry", "Phillips", "Pike", "Poinsett", "Polk", "Pope", "Prairie", "Pulaski",
  "Randolph", "Saline", "Scott", "Searcy", "Sebastian", "Sevier", "Sharp", "St. Francis", "Stone", "Union",
  "Van Buren", "Washington", "White", "Woodruff", "Yell",
];
const AR_COUNTY_LOOKUP = new Map(AR_COUNTIES.map((c) => [c.toLowerCase().replace(/[.\s]/g, ""), c]));

const STATE_NAME_TO_CODE: Record<string, string> = {
  ARKANSAS: "AR",
  TEXAS: "TX",
  OKLAHOMA: "OK",
  LOUISIANA: "LA",
  MISSISSIPPI: "MS",
  TENNESSEE: "TN",
  MISSOURI: "MO",
};

// Tight "IN <name> COUNTY, <STATE NAME>" anchor — see module header
// COUNTY / OUT-OF-STATE LOCATION. Confirmed live against real captions
// like "...IN JEFFERSON COUNTY, ARKANSAS" and "...IN RUSK COUNTY, TEXAS".
const COUNTY_STATE_RE =
  /\bIN\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,2})\s+COUNTY,?\s+(ARKANSAS|TEXAS|OKLAHOMA|LOUISIANA|MISSISSIPPI|TENNESSEE|MISSOURI)\b/i;
// Fallback for a real observed form naming no county at all — "...IN THE
// STATE OF OKLAHOMA" (Docket 25-070-U).
const BARE_STATE_RE = /\bSTATE OF\s+(TEXAS|OKLAHOMA|LOUISIANA|MISSISSIPPI|TENNESSEE|MISSOURI|ARKANSAS)\b/i;

function extractLocation(text: string): { state: string; county: string | null } {
  const csMatch = COUNTY_STATE_RE.exec(text);
  if (csMatch) {
    const stateName = csMatch[2].toUpperCase();
    const stateCode = STATE_NAME_TO_CODE[stateName] ?? "AR";
    const rawCounty = csMatch[1].trim();
    if (stateCode === "AR") {
      const canonical = AR_COUNTY_LOOKUP.get(rawCounty.toLowerCase().replace(/[.\s]/g, ""));
      // See module header COUNTY / OUT-OF-STATE LOCATION — an AR-state
      // match that fails the real-county whitelist is dropped (not
      // guessed at), the out-of-state branch is trusted directly.
      return { state: "AR", county: canonical ?? null };
    }
    return { state: stateCode, county: rawCounty };
  }
  const bareMatch = BARE_STATE_RE.exec(text);
  if (bareMatch) {
    const stateCode = STATE_NAME_TO_CODE[bareMatch[1].toUpperCase()] ?? "AR";
    return { state: stateCode, county: null };
  }
  return { state: "AR", county: null };
}

// CONFIRMED REAL GAP: not every real docket tags a row "Initiating
// Party" — Docket 39-275-U (see module header STATUS/VANISHED-CANDIDATE
// FIX re: legacy stub dockets) lists three real company rows, all role
// "Party", with no "Initiating Party" anywhere: "APSC General Staff",
// "Carroll Electric Cooperative Corporation", "Commission" — a naive
// companies[0] fallback would report the applicant as "APSC General
// Staff", which is never the actual project applicant. These three
// generic/standing-party names (plus "Attorney General of Arkansas",
// confirmed live as a real intervenor-party name in Docket 25-047-U) are
// skipped when no "Initiating Party" row exists, preferring the first
// remaining real company name instead.
const NON_APPLICANT_PARTY_NAMES = new Set([
  "apsc general staff",
  "general staff",
  "commission",
  "attorney general of arkansas",
  "office of arkansas attorney general",
]);

function extractApplicant(detail: DocketDetail): string {
  const initiating = detail.companies.find((c) => /initiating party/i.test(c.role));
  if (initiating) return initiating.name;
  const realParty = detail.companies.find((c) => !NON_APPLICANT_PARTY_NAMES.has(c.name.trim().toLowerCase()));
  if (realParty) return realParty.name;
  if (detail.companies.length > 0) return detail.companies[0].name;
  return detail.style.slice(0, 80);
}

function normalizeDocket(detail: DocketDetail, resolution: Resolution): NormalizedProject {
  const matchKey = resolveMatchKey("ar-psc", detail.docket);
  const { projectType, fuelType } = inferProjectTypeAndFuel(detail.style);
  const capacityMw = extractCapacityMw(detail.style);
  const { state, county } = extractLocation(detail.style);
  const applicant = extractApplicant(detail);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "dismissed") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Arkansas Public Service Commission's public \"olsv2\" docket search (Certificate of Environmental Compatibility and Public Need, Ark. Code Ann. §23-18-501 et seq.; Certificate of Convenience and Necessity, Ark. Code Ann. §23-3-201 et seq.; or, for an out-of-state facility, Notice and Authority to Proceed under Ark. Code Ann. §23-18-104).",
    "APSC's own docket-level \"Open\" flag is not used to determine whether this project is still waiting — it was confirmed unreliable by hand: real dockets with a Commission/ALJ order already granting a certificate still show \"Open: True\" (APSC keeps a docket open for post-approval Independent Monitor oversight and quarterly construction-status reporting). \"Still waiting\" here is instead determined by scanning the docket's own numbered Commission/ALJ orders for a dispositive grant/deny/dismissal — see the ingestion module header for how this was calibrated against real orders, including a real confirmed grant and a real confirmed false-positive (routine \"granted\" language about an intervention or protective-order motion, not the certificate itself) that the resolution check is written to avoid. Some real orders state no disposition at all in APSC's own docket-log summary text, in which case that specific order's own PDF is fetched and read directly.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket's own caption text, not a structured field — not independently verified.");
  }
  if (fuelType === "other" && projectType === "generation") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket's own caption text.");
  }
  if (state !== "AR") {
    dataQualityNoteParts.push(`This project's own physical facility is located in ${state}, not Arkansas — Arkansas regulates it because the applicant is an Arkansas-rate-regulated utility whose Arkansas customers will bear part of the cost, not because the facility itself is sited in Arkansas.`);
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, ${state}, per the docket's own caption text — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (AR PSC Docket ${detail.docket})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state,
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: detail.firstFiledDate,
    dateConfidence: "exact",
    currentStatus: `Arkansas PSC Docket ${detail.docket}: ${resolution ?? "pending"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a construction certificate/authority from the Arkansas Public Service Commission — Docket No. ${detail.docket}, "${detail.style}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `AR PSC Docket No. ${detail.docket}`,
        url: DOCKET_SHARE_URL(detail.docket),
      },
    ],
    externalIds: { arPsc: detail.docket },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestArPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const allDockets = await fetchOpenUDockets();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let realApplicationCandidates = 0;

  for (const docket of selectWithRotation(allDockets, maxCandidates, ROTATING_RECENT_SLOTS)) {
    const matchKey = resolveMatchKey("ar-psc", docket);
    try {
      const detail = await fetchDocketDetail(docket);
      await sleep(REQUEST_DELAY_MS);

      if (
        !GATE_RE.test(detail.style) ||
        !CONSTRUCTION_RE.test(detail.style) ||
        !ELECTRIC_RE.test(detail.style) ||
        NON_ELECTRIC_RE.test(detail.style)
      ) {
        // Not a real electric generation/storage/transmission
        // construction-certificate application — see module header
        // FUEL/PROJECT TYPE & CAPACITY.
        continue;
      }
      realApplicationCandidates += 1;

      if (detail.firstFiledDate === null) {
        // See module header STATUS/DISCOVERY — a real, confirmed edge
        // case: some very old dockets still in APSC's "open" list (e.g.
        // Docket 39-275-U, a 1938 rural-electrification CCN) carry a
        // matching Style caption but ZERO parseable action-log entries at
        // all (no dates, no orders — a pure legacy stub, never
        // electronically filed). With no filed date and no order history
        // to scan, this module cannot tell whether such a docket is a
        // real still-pending application or just an ancient artifact —
        // per this project's "confirm before guessing" rule, it's left
        // out entirely rather than guessed at either way. Logged, not
        // silently skipped.
        console.error(
          `AR PSC docket ${docket}: matched content filters but has no parseable filed date/action-log entries at all (likely a pre-electronic-filing legacy stub) — skipped rather than guessed at. Style: "${detail.style}"`,
        );
        continue;
      }

      const resolution = await detectResolution(docket, detail.orders);
      const normalized = normalizeDocket(detail, resolution);
      toUpsert.push(normalized);
    } catch (err) {
      errors.push({ matchKey, message: String(err) });
    }
  }

  // See module header VANISHED-CANDIDATE FIX (superseded): a docket that
  // drops off APSC's own open-dockets list, or that matches content
  // filters but has no parseable filed date, is deliberately left
  // untouched now, not guessed into a resolved stage — see the header
  // for why.

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = allDockets.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allDockets.length,
    realApplicationCandidates,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestArPscDockets()
    .then((summary) => {
      console.log(
        `Arkansas PSC docket ingestion complete: ${summary.candidatesFound} "-U" open dockets checked, ` +
          `${summary.realApplicationCandidates} real generation/storage/transmission construction-certificate applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
