// Illinois Commerce Commission (ICC) docket ingestion — one of several
// states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23. (The one true cross-source overlap this
// module found, Grain Belt Express, is handled via manualOverrides.csv —
// see the CROSS-SOURCE DUPLICATE note below, not a candidate-level skip.)
//
// STATUS (2026-09-24): a reCAPTCHA gate was added to every per-docket page
// on icc.illinois.gov after this module was built, which broke the original
// CaseStatus lookup (see STATUS below). Fixed without touching the gated
// pages: the case-search results endpoint this module already used for
// candidates has its own `o` ("only opened") filter, and that endpoint is
// still ungated. Open/closed now comes from which dockets appear in the
// `o=True` result set (see OPEN-ONLY SEARCH below).
//
// FETCHING: icc.illinois.gov's public eDocket case-search is a plain
// server-rendered ASP.NET MVC site. There IS a CAPTCHA ("I'm not a robot")
// in front of the single-docket-number lookup form at /Docket/Search — but
// that's not the path used here. The *case* search at
// /docket/search/cases (filter by case type + authority/service type,
// enctype=multipart/form-data, POST) has no CAPTCHA and, critically,
// redirects (302) to a plain GET URL encoding the chosen filters as query
// params: /docket/search/cases/results?ct=<caseType>&st=<serviceType>&o=
// <onlyOpened>. That GET URL is directly fetchable with no form submission,
// no cookies, no antiforgery token at all — confirmed by requesting it cold
// with a fresh curl process (no prior POST, no cookie jar) and getting an
// identical result. Both `ct` and `st` accept comma-separated lists ANDed
// as OR-filters in one request (confirmed: ct=5|4,5|5&st=7,18 returned
// exactly 64 = the sum of four separate single-filter requests: 39+18+3+4)
// — so the whole candidate set is one request, no pagination encountered
// even on an unfiltered ~2,591-row search.
//   - Case type "5|4" = "Certificate of Public Convenience & Necessity/Good
//     Standing/Service Authority (8-406,...) - New", "5|5" = same but
//     "- Amended" (confirmed against the search form's own <option> list,
//     not guessed — this ICC case-type bucket is administratively shared
//     across several different certificate types authorized by different
//     PUA sections, not just CPCN, hence the SCOPING filtering below).
//   - Service/authority type "7" = Electric, "18" = Transmission Utility.
//     "Electric Cooperative" (6) returned zero results for this case-type
//     combination. "Distributed Generation" (24) and "Utility-Scale Solar
//     Installers" (29) exist as options but are confirmed NOT what they
//     sound like for this purpose: the one live "Distributed Generation"
//     CPCN candidate (P2024-0702) turned out to be "Application for
//     Certification as an Installer of Distributed Generation Facilities"
//     — a business-licensing certificate for a solar installer *company*,
//     unrelated to any specific generation project siting. Excluded.
//   - Detail: GET /docket/{P-prefixed docket id, e.g. P2026-0156} (the id
//     in each search result's own href) is a case-details page with a
//     `id="CaseStatus"` field — but now reCAPTCHA-gated, so no longer
//     fetched (see OPEN-ONLY SEARCH). The docket's 5 sub-pages are Case
//     Details, Docket Sheet, Staff Assigned, Service List, Schedule.
//   - `o` query param: `o=False` returns every matching case, `o=True`
//     only the still-open ones — see OPEN-ONLY SEARCH.
// No HTML-parsing dependency added, same discipline as this series' other
// regex-based sources — each extractor throws if the expected structure
// isn't found.
//
// SCOPING: unlike Texas/Colorado/South Carolina, Illinois's CPCN case-type
// bucket also catches petitions that mention "Certificate of Public
// Convenience and Necessity" without actually being a facility-siting
// application for one:
//   - Follow-on petitions referencing an *already-granted* certificate
//     (e.g. P2016-0595, P2015-0269: route modifications to the line
//     approved in Docket 12-0598) — these don't restate the CPCN phrase at
//     all and are naturally excluded by CPCN_RE.
//   - A declaratory-ruling petition arguing a certificate ISN'T required
//     (P2005-0642: "Petition for Declaratory Ruling determining that an
//     additional Certificate of Public Convenience and Necessity ... is
//     not necessary...") — this DOES contain the CPCN phrase, so CPCN_RE
//     alone doesn't catch it. Confirmed only one such case in the full
//     26-year, 64-docket history, and it's the only description containing
//     the word "declaratory" anywhere in that set — DECLARATORY_RE excludes
//     it. Same lesson as South Carolina's "Petition for Declaratory Order
//     Finding a Certificate is/isn't required" false positive.
//   - A pure eminent-domain-authority petition under PUA Section 8-509
//     (P2025-0923: "Petition for an Order Pursuant to Section 8-509 ...
//     Authorizing Use of Eminent Domain Power") filed under the same
//     case-type code even though it never mentions a certificate at all —
//     naturally excluded by CPCN_RE.
//   - A pure Section 16-115 "Certificate of Service Authority" (retail
//     electric supplier registration, P2001-0634) — also naturally
//     excluded, it never says "Public Convenience and Necessity".
// Confirmed against the real, full history of this case-type/service-type
// combination since 2000 (64 candidates): 60 mention the CPCN phrase, 59
// are genuine facility-siting applications after DECLARATORY_RE.
//
// A striking, hand-confirmed domain fact worth documenting explicitly:
// across all 59 genuine candidates spanning 2000-2026, exactly ONE
// (P2001-0516, filed 2001) is a generation project ("construct, own,
// operate and maintain an electric combustion turbine generator") — every
// other candidate is a transmission line/facility CPCN. Zero mention solar,
// wind, or battery storage anywhere in the full candidate set. This lines
// up with Illinois's 1997 deregulation of electric generation (Electric
// Service Customer Choice Law) — competitive/merchant generators generally
// don't need a state CPCN, so ICC's CPCN docket is overwhelmingly a
// transmission-siting instrument in practice, not a generation one. This
// module still checks for generation/storage keywords (in case that ever
// changes), but expect this source to read almost entirely as transmission.
//
// STATUS: same lesson as South Carolina/Arizona, independently
// re-confirmed here — but with an unusually reassuring result. (This
// paragraph documents the original per-docket CaseStatus check, which is
// now reCAPTCHA-gated; see OPEN-ONLY SEARCH below for what replaced it.) ICC's own
// `CaseStatus` field on the detail page (e.g. "Initial - Heard & Taken" vs.
// "Initial - Closed") turned out, after deliberately trying to catch it
// lying, to be reliable: cross-checked CaseStatus against each docket's own
// Docket Sheet filing history for 30+ real dockets spanning 2000-2026 —
// every "*Closed" status docket had a corresponding "Order Entered - Final"
// entry in its filing history, and the one still-active docket checked
// (P2026-0156, GRIT project, CaseStatus="Initial - Heard & Taken") had no
// such entry. isResolved() below just checks CaseStatus for "closed"
// (case-insensitively) — deliberately NOT more specific than that. An
// early design tried to also classify granted-vs-denied by keyword-matching
// the Docket Sheet's filing-history entry descriptions (mirroring SC's
// GRANT_RE/DENY_RE), but a real counterexample killed that: docket
// P2023-0658's history contains a "Commission Action - Dismissal w/o
// Order" entry whose text is "the Commission ... DENIED ... Application
// for Rehearing of Sheila Vaughn ... and ... Eddie Vaughn, Jr. and Alex
// Junkins" — a procedural denial of two intervenors' rehearing requests,
// not a denial of the underlying certificate (which this docket's CPCN was
// in fact granted). Exactly the SC "Order Granting Motion to Withdraw as
// Counsel" false-positive lesson, independently rediscovered. Since
// RESOLVED_STAGES excludes approved/denied/withdrawn/cancelled dockets from
// the site identically either way, this module doesn't attempt to
// distinguish them — every resolved (CaseStatus contains "closed") docket
// maps to the same currentStage, and dataQualityNote says so honestly.
//
// RESOLUTION DATE — investigated 2026-09-13, could NOT be resolved either
// way: a prior audit found docket P2023-0658's own Docket Sheet filing
// history shows an "Order Entered - Final" entry (see STATUS above) but
// hadn't confirmed whether that entry, or a linked order document, carries a
// real date. Checking this live requires fetching a per-docket page
// (`/docket/{id}`, `/docket/{id}/schedule`, and presumably the Docket Sheet
// sub-page itself) — and every one of those now returns a real Google
// reCAPTCHA gate ("Please, no robots or crawlers beyond this point.",
// confirmed live against P2023-0658, P2026-0156, and P2015-0277 alike) that
// did NOT exist when this module was built (2026-08-23 header date; this
// module's own FETCHING note above says the CAPTCHA lives only on
// /Docket/Search, which is still true — but ICC has since ALSO put one on
// every per-docket page, not just that form). This project's own standing
// rules prohibit solving or bypassing CAPTCHAs, so the Docket Sheet (and any
// linked order document) could not be inspected this session — resolution
// left genuinely undetermined, not implemented, and not worked around.
//
// ALTERNATE CHANNEL TRIED AND REJECTED (2026-09-24): ICC's public Open
// Meeting Minutes (icc.illinois.gov/home/open-minutes, a real, ungated,
// static index of verbatim court-reporter transcripts of every Commission
// meeting since 2008) looked like a real fix for both grant/deny/dismiss
// disposition and resolution date — the Commission votes on every CPCN at
// one of these meetings. Built and live-tested a full prototype
// (fetch the index, download+parse the relevant PDFs via `pdf-parse`,
// match a docket to its own vote) before concluding it isn't safe to ship,
// for three independently confirmed reasons, not just one:
//   1. The transcript NEVER cites a docket number anywhere — matching has
//      to go by the applicant's own name instead, but the same handful of
//      utilities (ComEd, Ameren Illinois, Ameren Transmission) file most of
//      this docket type's real history, so applicant-name matching alone
//      produced SIXTEEN real dockets spanning 2012-2026 all matching the
//      same one or two recent grants — obvious nonsense confirmed by a live
//      test run against all 59 real candidates.
//   2. Adding a required distinctive-term match (the docket's own county
//      name(s) or a named project's acronym, both real per-docket details —
//      see candidate descriptions) cut that from 16 false matches to 3, but
//      didn't fix it: Illinois county names recur across entirely unrelated
//      dockets of different utility types voted at the SAME meeting (a real
//      confirmed collision: an Ameren electric CPCN and an unrelated
//      Illinois American Water wastewater CPCN, both naming Madison County,
//      at the same Nov 7, 2024 meeting).
//   3. Even after also requiring the item text to say "electric" and reject
//      "water"/"gas" (which happens to reject that specific collision), a
//      deeper, structural problem surfaced: real items are NOT reliably
//      newline-delimited in the extracted transcript text — e.g. a real
//      "Item G-1" was found starting mid-line right after the PRECEDING,
//      unrelated item's own closing sentence ("...the orders are approved.
//      Now we will turn to gas items. Item G-1 concerns..."), with no
//      newline before "Item G-1" at all. A plain-text item splitter (the
//      only kind available without positional/layout-aware PDF parsing, a
//      much larger undertaking) silently merges that case into the
//      PRECEDING item's chunk, so a real Ameren gas-certificate WITHDRAWAL
//      got misclassified as "granted" purely because the merged-in prior
//      item's own unrelated sentence happened to contain "the orders grant
//      the certificates."
// Each fix uncovered a new, independent failure mode rather than narrowing
// toward zero — the opposite of what this project's "confirmed one real
// example, iterate if wrong" convention expects. Concluded this channel
// cannot meet this project's bar against guessing, and was not wired in.
// Resolution stays genuinely undetermined for reCAPTCHA-blocked dockets,
// same as before this investigation — not implemented, not worked around.
//
// OPEN-ONLY SEARCH (2026-09-24): the same reCAPTCHA gate also broke the
// original CaseStatus lookup, which fetched `/docket/{id}` (every real
// candidate errored, 0 upserted). Replacement: the ungated case-search
// results endpoint takes an `o` param, and `o=True` returns only open
// cases. Confirmed live 2026-09-24 from a fresh runner (no cookies, no
// prior request): with this module's own ct/st filters, `o=False` returned
// 64 cases and `o=True` returned 2 (P2025-0923 and P2026-0156). That matches
// what the CaseStatus check had found before the gate: P2026-0156 (GRIT) is
// the one open candidate (see HEARING SCHEDULE below). P2023-0658, a known
// closed docket, was absent from the `o=True` set. P2025-0923, the Section
// 8-509 eminent-domain petition, is excluded by CPCN_RE anyway (see
// SCOPING). So "resolved" is now just "in the full set but not in the open
// set" — the same closed-or-not granularity the CaseStatus check gave,
// from a different field of ICC's own data. searchCandidates cross-checks
// that every `o=True` id is also in the `o=False` set, and throws rather
// than guessing if the filter's meaning ever appears to change.
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields. Captions are
// consistent enough to regex (same style as TX/SC/AZ): county names appear
// as "...in <County[, County...]> Count(y|ies), Illinois." (single, "X
// County and Y County," and "W, X, Y, and Z Counties," forms all
// confirmed against real captions — a 13-county joint Ameren petition,
// P2024-0088, was the widest real example). Voltage — NOT MW, see above —
// appears as either "NNN,000 volt(s)" (kV = the digits before the literal
// ",000") or "NNN kV"/"NNN KV" directly; multi-voltage lines ("69 KV and
// 138 KV dual constructed...") are handled by taking the max of all
// matches found, not just the first. capacityUnit is "kV" (not "MW") for
// every candidate that has one — matches this codebase's existing
// eiaPipelineProjects.ts precedent of using a source-appropriate unit and
// relying on the site's MW-aggregate stat already only summing
// capacityValue when capacityUnit === "MW", so this doesn't corrupt that
// total.
//
// CROSS-SOURCE DUPLICATE: docket 22-0499 (Grain Belt Express) is the same
// physical interstate transmission line already tracked via the federal
// Permitting Dashboard (permittingDashboard.ts, project_id 109441) —
// confirmed by hand 2026-08-23. Declared as one project via
// src/lib/ingest/manualOverrides.csv (shared matchKey
// "grain-belt-express-phase-1") rather than excluded here, so the site
// shows one merged row carrying both sources' links.
//
// HEARING SCHEDULE: unlike VT/CT (a site-wide hearings calendar) or OH (a
// hearing-date paragraph on the case's own detail page), ICC publishes each
// docket's own scheduled events on a dedicated per-docket "Schedule"
// sub-page — e.g. /docket/P2026-0156/schedule — confirmed live 2026-09-05,
// plain server-rendered HTML, no CAPTCHA (same eDocket navigation sidebar as
// Case Details/Docket Sheet/Staff Assigned/Service List, already referenced
// in the module header FETCHING). Each scheduled event renders as its own
// card: an `<h3>` event type ("Evidentiary for ", "Status for ", "Prehearing
// for ", "Oral Argument for ", or "Deadline") and an `<h4>` date/time (e.g.
// "October 9, 2026 5:00 PM"), sorted newest-first, with no pagination
// encountered even on a 24-result docket (P2015-0277) — confirmed live
// against several real dockets. Confirmed live against the one real
// currently-open candidate as of 2026-09-05 (docket 26-0156, ComEd's GRIT
// transmission project — every other real candidate's own CaseStatus reads
// "Initial - Closed", see STATUS above): 9 real scheduled events, including
// a genuinely upcoming "Deadline" entry (October 9, 2026) and two already-
// past Evidentiary hearings (June 24/25, 2026). "Deadline" entries are the
// Commission's own internal decision deadline, not a hearing or conference
// the public attends, so they're excluded here; every other entry type
// (Evidentiary/Status/Prehearing/Oral Argument, and any future type ICC
// adds) is a real ALJ hearing/conference open to the public and counts.
// Only the earliest still-future, non-"Cancelled" entry is kept (a real
// live example of a cancelled entry was confirmed on this same docket: "Jun
// - 2026 25 ... Cancelled"). Fetched only for candidates not already known
// resolved via the open-only search (see OPEN-ONLY SEARCH) — a closed
// docket's schedule is all in the past by construction and isn't worth
// the extra request. NOTE: the Schedule sub-page sits behind the same
// reCAPTCHA as every other per-docket page since 2026-09, so today this
// yields no hearings (the gate page has no event cards and parses to []
// rather than erroring); kept so it resumes working if the gate lifts. Every event type past the Deadline exclusion is
// kept as a public hearing/conference (Evidentiary, Status, Prehearing,
// Oral Argument, and any other real type confirmed on other dockets —
// Briefs/Testimony/Rebuttal/Motion/Proposed Order/Exceptions to Proposed
// Order deadlines — are already excluded, none of them share the ALJ-
// presided-hearing shape of the ones kept); this is deliberately not
// narrowed to only Evidentiary hearings, matching this task's "any genuine
// open proceeding the public can attend" goal.
//
// LOCATION (added 2026-09-05): each event card's own third `<span
// class="d-block mt-3">` line — confirmed live to hold the presiding ALJ
// name(s) (e.g. "Administrative Law Judge Cardoni<br/>Administrative Law
// Judge Groh") and, on docket P2015-0277's real May 5, 2015 Prehearing
// card, an appended room note ("Administrative Law Judge Von
// Qualen<br/><br/>(rooms B & C for overflow)") — is the only per-event
// venue/attendance-adjacent text this page publishes; there is no separate
// address/room field. The page's own sitewide "Office Locations" footer
// (160 North LaSalle St., Chicago / 527 East Capitol Ave., Springfield) was
// checked and confirmed to be generic ICC office addresses repeated on
// every page, not a per-hearing venue, so it is deliberately NOT used here
// — using it would misrepresent a generic footer as this specific
// hearing's location. Captured as-is (ALJ name plus any room note,
// exactly as published) rather than guessed at further.
//
// Wired to Vercel Cron daily, 22:00 UTC (see vercel.json and
// src/app/api/cron/ingest-il-icc/route.ts) — a real run's timing was
// measured (64 candidates, 59 real applications) before scheduling this.
// Also politeness-delayed between requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://icc.illinois.gov";
// "5|4" = CPCN/Good Standing/Service Authority - New, "5|5" = - Amended.
const CASE_TYPES = "5|4,5|5";
// "7" = Electric, "18" = Transmission Utility. See module header SCOPING
// for why Electric Cooperative/Distributed Generation/Utility-Scale Solar
// Installers are deliberately not included.
const SERVICE_TYPES = "7,18";

export const MAX_CANDIDATES = 100;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IL ICC request failed (${res.status}): ${url}`);
  return res.text();
}

interface UpcomingHearing {
  date: Date;
  link: string;
  label: string | null;
  location: string | null;
}

// See module header HEARING SCHEDULE. Each card is a `<li
// class="soi-icc-card-list-item ...">` block containing an `<h3>` event
// type and an `<h4>` date/time — matched as a block first (not a single
// combined regex) so a "Cancelled" marker or an unrelated page footer `<h3>`
// (this page's own "Office Locations"/"Stay Connected"/"Useful Links"
// sidebar headers, confirmed live to also be plain `<h3>` tags, just outside
// any `soi-icc-card-list-item` li) can't be mistaken for a real entry.
const SCHEDULE_ITEM_RE = /<li class="soi-icc-card-list-item[^"]*">([\s\S]*?)<\/li>/g;
const SCHEDULE_TYPE_RE = /<h3>([^<]*)<\/h3>/;
const SCHEDULE_DATE_RE = /<h4>([\s\S]*?)<\/h4>/;
// The Commission's own internal decision deadline, not a hearing/conference
// the public attends — see module header HEARING SCHEDULE.
const SCHEDULE_DEADLINE_RE = /^deadline/i;
// See module header LOCATION — the card's own third `<span class="d-block
// mt-3">` line, holding the presiding ALJ name(s) and, when published, a
// room note.
const SCHEDULE_PRESIDING_RE = /<span class="d-block mt-3">([\s\S]*?)<\/span>/;

// Every real future, non-"Deadline", non-cancelled event on the docket's
// Schedule sub-page is kept (not just the earliest) — a docket can
// genuinely have more than one on the books at once (e.g. a Prehearing
// Conference and a later Evidentiary hearing). Deduped by exact timestamp
// in case the same card could ever be matched twice.
async function fetchScheduledEvents(docketId: string): Promise<UpcomingHearing[]> {
  const url = `${BASE_URL}/docket/${docketId}/schedule`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const html = await res.text();
  const now = Date.now();
  const hearings: UpcomingHearing[] = [];
  for (const m of html.matchAll(SCHEDULE_ITEM_RE)) {
    const block = m[1];
    const type = SCHEDULE_TYPE_RE.exec(block)?.[1]?.trim();
    if (!type || SCHEDULE_DEADLINE_RE.test(type)) continue;
    const rawDate = SCHEDULE_DATE_RE.exec(block)?.[1];
    if (!rawDate || /cancell?ed/i.test(rawDate)) continue;
    const dateText = decodeHtmlEntities(rawDate.replace(/<[^>]+>/g, " "));
    const d = new Date(dateText);
    if (Number.isNaN(d.getTime()) || d.getTime() <= now) continue;
    // See LOCATION above — the presiding-ALJ/room-note span, exactly as
    // published, or null when a card doesn't carry one (e.g. the plain
    // "Hearing"/"Deadline"-adjacent card variants confirmed live to lack
    // this span entirely).
    const rawLocation = SCHEDULE_PRESIDING_RE.exec(block)?.[1];
    const location = rawLocation
      ? decodeHtmlEntities(rawLocation.replace(/(?:<br\s*\/?>\s*)+/gi, ", ").replace(/<[^>]+>/g, " ")).replace(/^,\s*|,\s*$/g, "")
      : null;
    if (!hearings.some((h) => h.date.getTime() === d.getTime())) hearings.push({ date: d, link: url, label: type, location: location || null });
  }
  return hearings;
}

// Small, hand-confirmed set actually observed in real responses — same
// approach as the other regex-based sources in this series, not a full
// HTML-entity library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// Search-result cards render applicant names and descriptions with <br>
// line-wraps mid-phrase (e.g. "Kishwaukee Area Reliability<br>Expansion") —
// stripping tags alone isn't enough, the <br> has to become a space first
// or words fuse together and later regexes (e.g. CPCN_RE) silently miss.
function cleanText(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

interface DocketSearchResult {
  docketId: string; // e.g. "P2026-0156"
  docketNumber: string; // e.g. "26-0156"
  applicant: string;
  description: string;
  filedDate: Date | null;
}

const SEARCH_CARD_RE =
  /<h3><a href="\/docket\/(P\d{4}-\d{4})">([^<]+)<\/a><\/h3>\s*<h4>([\s\S]*?)<\/h4>\s*<span class="d-block mt-3">([\s\S]*?)<\/span>\s*<span class="d-block mt-3">Case Type:\s*<\/span>\s*<span class="d-block">Case Status:\s*<\/span>\s*<span class="d-block mt-3">Filed:\s*([^<]+)<\/span>/g;

export function parseSearchResults(html: string): DocketSearchResult[] {
  const results: DocketSearchResult[] = [];
  for (const m of html.matchAll(SEARCH_CARD_RE)) {
    results.push({
      docketId: m[1],
      docketNumber: decodeHtmlEntities(m[2]),
      applicant: cleanText(m[3]),
      description: cleanText(m[4]),
      filedDate: parseLongDate(cleanText(m[5])),
    });
  }
  const reportedCountM = /(\d+)\s+results/i.exec(html);
  const reportedCount = reportedCountM ? Number(reportedCountM[1]) : null;
  if (results.length === 0 && reportedCount != null && reportedCount > 0) {
    throw new Error(
      "IL ICC case search reported results but parseSearchResults matched zero rows — the card structure likely changed. Check SEARCH_CARD_RE in src/lib/ingest/ilIccDockets.ts against a fresh response.",
    );
  }
  return results;
}

function parseLongDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface DocketDetail {
  resolved: boolean;
}

function searchUrl(onlyOpen: boolean): string {
  return `${BASE_URL}/docket/search/cases/results?ct=${CASE_TYPES}&st=${SERVICE_TYPES}&o=${onlyOpen ? "True" : "False"}`;
}

// See module header OPEN-ONLY SEARCH: two requests to the same ungated
// endpoint — every matching case, then only the open ones. Deliberately
// just "closed or not" (see STATUS): finer-grained granted/denied
// classification from filing-history keywords proved unreliable.
async function searchCandidates(): Promise<{ all: DocketSearchResult[]; openIds: Set<string> }> {
  const all = parseSearchResults(await fetchText(searchUrl(false)));
  await sleep(REQUEST_DELAY_MS);
  const open = parseSearchResults(await fetchText(searchUrl(true)));
  const allIds = new Set(all.map((r) => r.docketId));
  const stray = open.filter((r) => !allIds.has(r.docketId));
  if (stray.length > 0) {
    throw new Error(
      `IL ICC open-only search (o=True) returned dockets missing from the full search (o=False): ${stray.map((r) => r.docketId).join(", ")} — the "o" filter's meaning may have changed. Check searchCandidates in src/lib/ingest/ilIccDockets.ts against fresh responses.`,
    );
  }
  return { all, openIds: new Set(open.map((r) => r.docketId)) };
}

// Requires the actual CPCN phrase (handles Illinois's case-type bucket
// also containing non-CPCN petitions — see module header SCOPING).
const CPCN_RE = /certificate\s+of\s+public\s+convenience\s+and\s+necessity/i;
// Excludes the one real "is a certificate even required" petition found in
// the full candidate history — see module header SCOPING.
const DECLARATORY_RE = /declaratory/i;

const GENERATION_RE = /\b(generat(?:or|ion|ing)|combustion turbine|power plant|combined cycle)\b/i;
const STORAGE_RE = /\b(battery|energy storage|bess)\b/i;
const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/offshore wind/i, "wind_offshore"],
  [/\bwind\b/i, "wind_onshore"],
  [/\b(combined cycle|combustion turbine|natural gas|gas[- ]fired)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
];

function inferProjectType(description: string): ProjectType {
  if (STORAGE_RE.test(description)) return "storage";
  if (GENERATION_RE.test(description)) return "generation";
  // See module header — 58 of 59 real candidates are transmission-line
  // CPCNs; treat that as the default rather than falling to "other" (not
  // even a valid ProjectType) when neither generation nor storage keywords
  // are present.
  return "transmission";
}

function inferFuelType(description: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  for (const [re, fuel] of FUEL_KEYWORDS) {
    if (re.test(description)) return fuel;
  }
  return "other";
}

// "345,000 volt"/"345,000-volt" -> the digits before the literal ",000"
// suffix ARE the kV value (no /1000 needed — that was a real bug caught
// while testing against real captions: "34,000 volt" was coming out as
// 0.034 instead of 34). "NNN kV"/"NNN KV" is matched directly. Multi-
// voltage descriptions ("69 KV and 138 KV dual constructed...") take the
// max of everything found, not just the first match.
function extractVoltageKv(description: string): number | null {
  const values: number[] = [];
  const voltBlockRe = /((?:[\d,]+\s*,?000\s*(?:,|and|&)?\s*)+)-?\s*volts?\b/gi;
  for (const block of description.matchAll(voltBlockRe)) {
    for (const numM of block[1].matchAll(/([\d,]+)\s*,?000/g)) {
      const v = Number(numM[1].replace(/,/g, ""));
      if (Number.isFinite(v)) values.push(v);
    }
  }
  for (const m of description.matchAll(/([\d,]+)\s*kv\b/gi)) {
    const v = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(v)) values.push(v);
  }
  return values.length > 0 ? Math.max(...values) : null;
}

// Handles the four real forms confirmed against this source: a single
// county ("...in Cook County, Illinois."), two counties each restating
// "County" ("...in Jefferson County and Wayne County, Illinois."), exactly
// two counties sharing one plural "Counties" with no repeated word
// ("...in Bureau and LaSalle Counties, Illinois." — found only by running
// a real dry-run insert against docket 26-0081 and noticing county came
// back null despite the caption clearly naming two counties; the earlier
// two patterns both required either a repeated "County" per name or a
// comma-joined list, and this one has neither), and a comma list restating
// "Counties" once at the end ("...in Hancock, Peoria, ..., and Iroquois
// Counties, Illinois." — a real 13-county joint Ameren petition,
// P2024-0088, confirmed this form). Many candidates (company-wide or
// route-unspecified petitions) mention no county at all — returns null
// rather than guessing.
function extractCounties(description: string): string | null {
  let m = /\bin\s+([A-Z][\w.']+)\s+County\s+and\s+([A-Z][\w.']+)\s+County,\s+Illinois/.exec(description);
  if (m) return `${m[1]}, ${m[2]}`;

  m = /\bin\s+([A-Z][\w.']+)\s+and\s+([A-Z][\w.']+)\s+Counties,\s+Illinois/.exec(description);
  if (m) return `${m[1]}, ${m[2]}`;

  m = /\bin\s+((?:[A-Z][\w.']+,\s*)+(?:and\s+)?[A-Z][\w.']+)\s+Counties,\s+Illinois/.exec(description);
  if (m) {
    return m[1]
      .replace(/\band\s+/gi, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }

  m = /\bin\s+([A-Z][\w.']+)\s+County,\s+Illinois/.exec(description);
  return m ? m[1] : null;
}

function normalizeDocket(search: DocketSearchResult, detail: DocketDetail, hearings: UpcomingHearing[]): NormalizedProject {
  const matchKey = resolveMatchKey("il-icc", search.docketId);
  const projectType = inferProjectType(search.description);
  const fuelType = inferFuelType(search.description, projectType);
  const voltageKv = extractVoltageKv(search.description);
  const county = extractCounties(search.description);

  // See module header STATUS — resolved (granted/denied/withdrawn/
  // dismissed, indistinguishably) always maps to the same RESOLVED_STAGES
  // value since upsertNormalizedProject excludes all of them from the site
  // identically either way.
  const currentStage: ProjectStage = detail.resolved ? "approved_awaiting_construction" : "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Illinois Commerce Commission's public eDocket case search.",
    'This docket\'s "still waiting" determination is based on whether it appears in the ICC case search\'s own open-cases-only results — but this source cannot reliably distinguish a granted certificate from a denied, withdrawn, or dismissed one; see the ingestion module header for a real case (docket 23-0658) where keyword-scanning the filing history for "denied" would have produced a false signal.',
  ];
  if (voltageKv != null) {
    dataQualityNoteParts.push("Voltage figure (kV, not MW) is parsed from the docket caption text, not a structured field — not independently verified.");
  } else {
    dataQualityNoteParts.push("No capacity or voltage figure could be parsed from the docket caption text.");
  }
  if (projectType !== "transmission" && fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    dataQualityNoteParts.push(`Located in ${county} County, Illinois, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${search.applicant} (IL ICC Docket ${search.docketNumber})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "IL",
    county,
    capacityValue: voltageKv,
    capacityUnit: voltageKv != null ? "kV" : null,
    applicationFiledDate: search.filedDate,
    dateConfidence: "exact",
    applicant: search.applicant,
    currentStatus: `Illinois ICC docket ${search.docketNumber}: ${detail.resolved ? "closed" : "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Illinois Commerce Commission — Docket No. ${search.docketNumber}, "${search.description}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    hearingDetailsLink: hearings.length > 0 ? hearings[0].link : null,
    hearings: hearings.map((h) => ({ date: h.date, endDate: null, label: h.label, location: h.location })),
    sources: [
      {
        label: `IL ICC Docket No. ${search.docketNumber}`,
        url: `${BASE_URL}/docket/${search.docketId}`,
      },
    ],
    externalIds: { ilIcc: search.docketId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  cpcnCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestIlIccDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const { all: allCandidates, openIds } = await searchCandidates();
  const candidates = selectWithRotation(
    allCandidates.filter((c) => CPCN_RE.test(c.description) && !DECLARATORY_RE.test(c.description)),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );

  const rotatingTier = new Set(candidates.slice(ROTATING_RECENT_SLOTS));
  const rotatingMatchKeys = new Set<string>();

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of candidates) {
    try {
      const detail: DocketDetail = { resolved: !openIds.has(candidate.docketId) };
      // See module header HEARING SCHEDULE — a closed docket's schedule is
      // all in the past by construction, so the extra request is skipped
      // for candidates already known resolved.
      let hearings: UpcomingHearing[] = [];
      if (!detail.resolved) {
        hearings = await fetchScheduledEvents(candidate.docketId).catch(() => []);
        await sleep(REQUEST_DELAY_MS);
      }
      const normalized = normalizeDocket(candidate, detail, hearings);
      toUpsert.push(normalized);
      if (rotatingTier.has(candidate)) rotatingMatchKeys.add(normalized.matchKey);
    } catch (err) {
      errors.push({ matchKey: candidate.docketNumber, message: String(err) });
    }
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped, suppressNewForMatchKeys: rotatingMatchKeys });

  return {
    candidatesFound: allCandidates.length,
    cpcnCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestIlIccDockets()
    .then((summary) => {
      console.log(
        `Illinois ICC docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.cpcnCandidates} real siting-certificate applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
