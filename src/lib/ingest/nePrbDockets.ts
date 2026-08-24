// Nebraska Power Review Board (NPRB/PRB) generation, transmission, and
// energy storage resource (ESR) application ingestion — one of several
// states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-24 via real GET requests against the live
// powerreview.nebraska.gov site — no assumption below was taken from
// documentation or training-data memory alone.
//
// SCOPING — Nebraska has no investor-owned electric utilities at all (it is
// the only U.S. state served entirely by consumer-owned public power
// districts, cooperatives, and municipalities), and no Public Service
// Commission jurisdiction over electric-utility CPCNs the way nearly every
// sibling state in this series has. Confirmed by hand: Nebraska's own PSC
// (psc.nebraska.gov) regulates telecom, motor carriers, and — under a
// wholly separate statute, the Major Oil Pipeline Siting Act (2012) — crude
// oil pipelines specifically; that jurisdiction has never applied to
// electric generation/transmission and is out of scope here regardless
// (this site's existing pipeline coverage, eiaPipelineProjects.ts, is
// natural-gas pipelines, not oil). The real electric siting/certificate
// authority, confirmed by hand per this task's own hint, is the Nebraska
// Power Review Board (NPRB/PRB, powerreview.nebraska.gov, created 1963):
// Neb. Rev. Stat. §§70-1010 to 70-1014.01 give the PRB — not any court, not
// any other agency — sole authority to approve or deny construction/
// acquisition of (a) any new electric generation facility, (b) any
// transmission line built outside the applicant's own certified service
// area, and (c), since 2024's LB1010, standalone energy storage resources
// (ESR). Before approval the Board must find the project "will serve the
// public convenience and necessity" and can be supplied "without
// unnecessary duplication of facilities" (§70-1014) — functionally this
// series' usual CPCN standard, though Nebraska's own statute never actually
// uses the words "Certificate of Public Convenience and Necessity" for its
// output the way most sibling states' statutes do. This module therefore
// describes the outcome as "PRB approval," not a "CPCN," to avoid asserting
// a formal term the statute doesn't use. The PRB also decides Service Area
// Amendment ("SAA") petitions (which utility gets to serve annexed
// municipal territory) and Formal Complaints ("C-NN") — both real,
// sometimes multi-year contested proceedings (confirmed live via the
// Board's own curated Orders page: SAA 400-16-A, Neligh & Elkhorn RPPD, has
// six separate orders spanning years of litigation over annexation
// compensation) — but neither is a new-capacity generation/transmission/
// storage siting decision the way this site tracks; both are out of scope
// by construction here, since neither ever produces a "PRB-NNNN[-suffix]"
// case number (see FETCHING) and so is never matched by this module's own
// case-number regex.
//
// FETCHING — powerreview.nebraska.gov is a plain Drupal (Tyler
// Technologies-hosted) site, fully server-rendered, no auth/cookies/
// CAPTCHA/JS required — confirmed by hand with a bare `fetch()`/`curl`.
// Confirmed live: THERE IS NO case-search tool, no docket database, and no
// "pending applications" page anywhere on the site. Its own "Orders Issued
// by the Board" page (/orders-issued-board) is a hand-curated highlights
// list of past orders grouped by category (Generation/Transmission/ESR/
// Microwave/Service Area Amendment/Formal Complaint), not an exhaustive or
// current index — confirmed: it's missing an "Order on Merits" entry for at
// least one real historical generation docket (PRB-3798-G, Prairie Breeze
// III) that almost certainly resolved years ago, the same kind of stale
// hand-maintained page ctCscDockets.ts documents for CT's own Pending
// Matters page. This module therefore never uses that page for STATUS —
// only as background confirmation that PRB's real docket-number space
// (PRB-NNNN, suffixed -G/-ESR/-SG for generation/storage/combined,
// unsuffixed for transmission, -M for telecom-only microwave facilities) is
// real and live.
//   The ONLY real per-meeting record of what the Board actually did is its
// own Minutes (/minutes, /minutes-archive, paginated `?page=N`, 0-indexed,
// confirmed live back through at least 11 archive pages / roughly 90
// meetings, monthly cadence). Each meeting gets its own plain
// server-rendered HTML page (e.g. /minutes-may-15-2026-meeting) — confirmed
// by hand: NOT a PDF, full text directly in the page's own `<p>` tags, one
// paragraph per agenda item (confirmed live: the entire arc of one real
// contested item — introduction, full factual recitation, board discussion,
// motion, roll-call vote — sits inside a SINGLE `<p>...</p>` block; blank
// `<p>&nbsp;</p>` tags separate items). This module fetches the archive
// listing page(s) just far enough back to cover LOOKBACK_MONTHS, then
// fetches every individual meeting page found within that window and scans
// each one's own `<p>` blocks for a PRB-NNNN[-suffix] case-number mention.
//
// STATUS — there is no structured status field anywhere in this source (the
// same root problem as mdPscDockets.ts/ctCscDockets.ts); "still waiting" is
// entirely inferred from Minutes prose, confirmed by hand against six real
// consecutive meetings (Dec 2025-May 2026) plus spot-checks further back:
//   - THE REAL, DOMINANT PATTERN, confirmed on real cases PRB-4074,
//     PRB-4075, and PRB-4078-G: almost every PRB application is filed,
//     considered, and voted on to completion in ONE PARAGRAPH OF ONE
//     MEETING's minutes — e.g. PRB-4074 (City of Auburn, filed May 1, 2026)
//     was approved at the very same May 15, 2026 meeting the filing is
//     first mentioned. This is a real, structural difference from every
//     other CPCN-equivalent process in this series (which typically run
//     weeks to months): Nebraska's small, consent-utility-driven, mostly
//     uncontested caseload usually clears in a single Board meeting.
//   - IT IS NOT ALWAYS ONE MEETING — confirmed live, not hypothetical:
//     PRB-4063-M (an NPPD microwave facility) was filed Sept. 5, 2025, was
//     explicitly "tabled at the November 19 meeting" pending outstanding
//     carrier notices, and was only finally approved at the Dec. 19, 2025
//     meeting — a real ~3.5-month, 3-meeting span. (PRB-4063-M itself is
//     excluded from this module's output as a telecommunications microwave
//     facility, not a tracked energy ProjectType — see FUEL/PROJECT TYPE
//     below — but its real multi-meeting timeline is exactly why this
//     module cannot assume same-meeting resolution and must track a case
//     across its full mention history, not just its most recent one.)
//   - Because of the above, this module scans every meeting within
//     LOOKBACK_MONTHS, groups paragraphs by the first PRB-NNNN[-suffix]
//     match found in each (CASE_NUMBER_RE), and keeps EVERY paragraph that
//     mentions a given case (not just its first or last). A REAL,
//     LIVE-CONFIRMED STRUCTURAL BUG was found and fixed here before
//     shipping (see pickFactsMention/pickResolutionMention below for the
//     full account, verified against a real dry-run against the DB): a
//     contested case's own facts and its own resolution can each live in a
//     DIFFERENT paragraph than the case's chronologically first/last
//     mention — PRB-4039-G's real facts sit in its THIRD paragraph (after
//     two paragraphs about the hearing being scheduled/held), and
//     PRB-4052-ESR's real grant sits in an EARLIER paragraph than its
//     chronologically last mention, which turned out to be an unrelated
//     later agenda item's segue sentence that just name-drops the case
//     number. This module therefore picks the facts paragraph as the
//     earliest one matching APPLICANT_RE, and the resolution as the LATEST
//     paragraph (scanning backwards) that actually contains resolving
//     language — skipping any paragraph that merely mentions the case
//     number without saying anything about its status. A case with no
//     resolving paragraph anywhere in the window is still pending
//     (`local_review`).
//   - REAL, LIVE-CONFIRMED GRANT PHRASING (the dominant, well-calibrated
//     case): "Mr./Ms. X [moved to / made a motion to] [waive the hearing
//     and] approve [the Village's/District's/...] application
//     PRB-NNNN[-suffix]. ... The motion carried [N-0 / N-0 with one
//     absent]." — confirmed on PRB-4074, PRB-4075 ("moved to approve"),
//     PRB-4039-G ("made a motion to approve"), and PRB-4078-G ("made a
//     motion to waive the hearing and approve" — both real verb phrasings
//     and the "waive the hearing and" insert can combine; see VERB_PHRASE
//     below for a real bug this combination caused before it was fixed).
//   - REAL, CONFIRMED SOURCE TYPO, not silently corrected: the May 15, 2026
//     minutes introduce the Auburn docket correctly as "PRB-4074" but the
//     Board's OWN motion sentence later in that same paragraph reads "Mr.
//     Austin moved to approve PRB-4704" (digits transposed) — confirmed
//     live, a real drafting error in the Board's own official minutes, not
//     a scraping artifact. This module never needs to reconcile the two:
//     CASE_NUMBER_RE only ever reads the FIRST case-number mention in a
//     paragraph as that item's canonical identity, and detectResolution
//     scans the paragraph's own prose for grant/deny/etc. language without
//     requiring the case number to be repeated correctly anywhere else in
//     it — so this real typo is harmless here by construction, not because
//     it was specifically detected and special-cased.
//   - DISMISS_RE and WITHDRAW_RE are now real-confirmed against the full
//     24-month scanned window (not just theoretical, and not limited to the
//     six-meeting sample the rest of this header describes): PRB-4043-G
//     (City of Kimball diesel generators) reads "Mr. Austin MOVED TO DISMISS
//     the City of Kimball's application PRB-4043-G ... The motion carried"
//     — the Board determined Kimball actually qualified for a statutory
//     exemption (Neb. Rev. Stat. §70-1012(1)(b), replacing existing
//     generation with equal-or-less capacity) after the application was
//     already filed — and PRB-4069 (City of Auburn distribution line) reads
//     "Mr. Liegl MOVED TO APPROVE THE WITHDRAWAL of PRB-4069 ... The motion
//     carried" — the customer ended up served by a different utility whose
//     own service area covered the site after all, so Auburn no longer
//     needed its own line. Both correctly classified `cancelled` and
//     verified by hand against the live minutes text before shipping.
//   - DENY_RE remains under-confirmed, the same documented gap as
//     mdPscDockets.ts's own DENY_APPLICATION_RE: no real denial exists
//     anywhere in the 24-month scanned window. A real denial IS confirmed to
//     exist in PRB's older history (the curated Orders page cites "PRB-3624
//     ... (Order of Denial)" and "PRB-4031 ... (Dismissed for Lack of
//     Jurisdiction)"), confirming the outcome is real and worth detecting,
//     but DENY_RE below is written from this series' established phrasing
//     conventions (mirroring GRANT_RE's/DISMISS_RE's own confirmed "[verb
//     phrase] X ... motion carried" structure), not from a live-confirmed
//     real denial paragraph's exact text. Flagged here should a future
//     maintainer need to recalibrate against a real one.
//
// FUEL/PROJECT TYPE & CAPACITY — project type is inferred from the case
// number's OWN suffix (the most reliable signal — confirmed by hand that
// PRB uses the suffix, not the prose, as its own internal type marker),
// not from free-text keyword matching:
//   - No suffix (bare "PRB-NNNN"): transmission — confirmed against every
//     real live example, always a kV distribution/transmission line
//     construction application (e.g. "0.92 mile of 7.2/12.47 kV" for
//     PRB-4074, "0.9 mile of 12.5 kilovolt" for PRB-4075).
//   - "-G": generation (e.g. PRB-4078-G, a diesel generator).
//   - "-ESR": storage (Energy Storage Resource, added by 2024's LB1010 —
//     confirmed live via the curated Orders page's PRB-3949-ESR, "OPPD to
//     Construct One MW ESR").
//   - "-SG": generation, kept as this series' usual "primary type"
//     convention for a combined generation-plus-its-own-interconnection
//     docket (confirmed live via the curated Orders page's PRB-3701-SG,
//     "Prairie Breeze Wind to Construct 200 MW Wind Farm and 25 Mile 230 kV
//     Interconnection Line" — no live "-SG" example fell inside this
//     module's own real six-month scanned window, so this mapping is
//     carried over from the historical Orders page, not independently
//     reconfirmed in a recent Minutes paragraph).
//   - "-M": EXCLUDED entirely, never normalized — a telecommunications
//     microwave relay facility (Neb. Rev. Stat. §70-1021), not a tracked
//     energy ProjectType, the same kind of out-of-scope exclusion
//     ctCscDockets.ts applies to CSC's telecom/wireless matters.
//   - Any other/unrecognized suffix: falls back to transmission, this
//     series' usual "plurality default" for an unclassifiable case
//     (matching moPscDockets.ts's own documented convention).
//   Fuel type (for generation/-SG cases only) is parsed from the
//   candidate's own paragraph prose (FUEL_KEYWORDS, leftmost-match-wins,
//   same approach wvPscDockets.ts uses for its own hybrid applications).
//   Two real gotchas, confirmed by hand: (1) "diesel generator" (PRB-4078-G,
//   Stuart) and "coal" (the curated Orders page's PRB-3355, "600 MW Coal
//   Generation Facility") have no matching FuelType enum value (no
//   "diesel"/"coal" value exists — see taxonomies.ts) and fall back to
//   "other", flagged in dataQualityNote, the same fallback
//   ctCscDockets.ts uses for its own fuel-cell/waste-to-energy candidates.
//   (2) Capacity is published inconsistently in kW ("1,880 kilowatts (kW)",
//   Stuart) and MW ("73.5 MW Wind Farm", the curated Orders page's Prairie
//   Breeze II) — CAPACITY_RE matches both and kW figures are converted to
//   MW for consistency with every other module, flagged in dataQualityNote
//   when converted.
//
// COUNTY: matched against a hardcoded whitelist of Nebraska's 93 real
// counties (pulled from the Nebraska Legislature's own county list, not
// assumed from memory) rather than a free-form "capitalized words before
// County" regex — the exact greedy-regex hazard mdPscDockets.ts's own
// county extraction documents. Multiple counties are real and confirmed
// (the curated Orders page's "Antelope and Boone Counties",
// "Custer & Valley Counties", "Stanton, Wayne, Madison, Pierce & Antelope
// Counties"); some real captions also state each county in its own
// separate phrase rather than one joined list (e.g. "675 MW in Cass County
// & 225 MW in Sarpy County") — extractCounties() below scans for every
// independent county-phrase occurrence in the text (not just one), so both
// forms are captured. Four of Nebraska's 93 counties are themselves
// multi-word ("Box Butte", "Keya Paha", "Red Willow", "Scotts Bluff") —
// COUNTY_ALTERNATION is built from the full county-name list as a single
// regex alternation (mirroring mdPscDockets.ts's own MD_COUNTY_PATTERNS
// approach) rather than splitting a matched phrase on whitespace, which
// would have broken these four names apart.
//
// VANISHED-CANDIDATE FIX: applicable and applied. This module's candidate
// pool is scoped to a rolling LOOKBACK_MONTHS window of Minutes (see
// FETCHING) — so a genuinely still-open case (real, confirmed possible: see
// PRB-4063-M's real ~3.5-month span above) that a PREVIOUS run tracked
// could, in principle, age out of a LATER run's window before it's ever
// resolved, silently vanishing from that run's candidate list the same way
// wvPscDockets.ts's own Active-only case search can silently drop a case —
// see that file's header for why upsertNormalizedProject (common.ts) alone
// can't handle this on its own (it only deletes a project it's *passed*
// with a RESOLVED_STAGES stage, never diffing "everything previously
// tracked, minus what showed up this run"). Fixed the same way: after
// building this run's full candidate map (every PRB-NNNN[-suffix] mention
// found within the window, including out-of-scope -M ones, since those
// could never have created a tracked "ne-prb:" row in the first place),
// every "ne-prb:" matchKey previously tracked in the DB that is NOT among
// this run's mentioned case numbers is pushed through as a minimal resolved
// stub (buildVanishedStub) with currentStage="cancelled", so
// upsertNormalizedProjects deletes the stale row. Given LOOKBACK_MONTHS is
// set generously (24 months) against a real confirmed maximum span of ~3.5
// months, this is a defensive/forward-looking fix, not something expected
// to trigger often in practice. Separately, and unlike ctCscDockets.ts's
// pure "vanished" scenario: a case that resolves WHILE STILL inside the
// lookback window is not a vanished-candidate case at all — it's simply
// re-normalized every run, and pickResolutionMention naturally finds its
// resolving paragraph and returns a RESOLVED_STAGES stage for it, so
// common.ts's own ordinary delete path handles it without any extra code.
//
// Real per-run timing measured 2026-08-24 against the live population
// (LOOKBACK_MONTHS=24: ~3 archive-listing page fetches plus ~24 individual
// meeting-page fetches, each politeness-delayed 250ms): 8-13 seconds across
// several real runs — comfortably inside the 300s cron budget. Real
// candidate volume, confirmed via a full live dry run against the shared
// DB: 14 total PRB-NNNN[-suffix] case numbers mentioned in the 24-month
// window, 13 in scope (1 excluded microwave case, PRB-4063-M), and — as of
// 2026-08-24 — ZERO currently still-pending: all 13 real in-scope cases
// have already resolved (11 granted, 1 dismissed [PRB-4043-G, a statutory
// exemption discovered after filing], 1 withdrawn [PRB-4069, the customer
// ended up served by a different utility]), each individually verified by
// hand against its own live minutes text. A genuinely still-open case is
// real and possible here (PRB-4063-M's own ~3.5-month span; the historical
// Prairie Breeze/Cottonwood/Grand Prairie wind-farm intervention fights on
// the curated Orders page) — this run's zero-pending result reflects
// Nebraska's real, unusually fast, mostly-uncontested review cycle at this
// point in time, not a structural inability of this module to find one when
// one exists. Judged worth shipping as a real, thin-population source
// (matching this series' wvPscDockets.ts precedent of a real population
// this small) rather than deferred as zero-yield, since a future run
// catching a genuine multi-meeting contested case is exactly the kind of
// "still waiting" project this site exists to surface.
//
// Wired to Vercel Cron weekly, 08:00 UTC Mondays (see vercel.json and
// src/app/api/cron/ingest-ne-prb/route.ts).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";
import { prisma } from "@/lib/db";

const BASE_URL = "https://powerreview.nebraska.gov";
const ARCHIVE_URL = `${BASE_URL}/minutes-archive`;

// See module header for why this population is real but thin. Set
// generously above the real observed rate (roughly one in-scope
// application every 6-7 weeks, virtually all resolved same-meeting) for
// headroom; real timing (see header) leaves enormous margin under the 300s
// cron budget at this population size.
export const MAX_CANDIDATES = 100;
const REQUEST_DELAY_MS = 250;
// See module header STATUS: the one real confirmed multi-meeting case
// (PRB-4063-M) spanned ~3.5 months. 24 months is a generous multi-year-ish
// safety margin above that, matching this series' convention (e.g.
// mdPscDockets.ts's own 10-year LOOKBACK_YEARS against a real ~1-year
// need) of erring generous rather than trimming to the exact observed
// maximum.
const LOOKBACK_MONTHS = 24;
// Safety valve on the archive-listing pagination loop — real archive is
// confirmed at least 11 pages (~90 meetings) deep; this module only ever
// needs enough pages to cover LOOKBACK_MONTHS and stops as soon as it sees
// a page whose oldest meeting is already past the cutoff (see
// collectRecentMeetings), so this cap is never expected to bind in
// practice.
const MAX_ARCHIVE_PAGES = 12;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NE PRB request failed (${res.status}): ${url}`);
  return res.text();
}

// Small, hand-confirmed set actually observed in real responses (see module
// header FETCHING for the real entity inventory checked against a live
// minutes page) — same approach as every other module in this series, not
// a full HTML-entity library.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&copy;/g, "©")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Handles both real observed forms: "May 1, 2026" (year present) and
// "September 5" (year omitted — confirmed live in the Dec. 19, 2025 minutes
// describing PRB-4063-M's original September filing date, which never
// restates the year since it's the same year as the surrounding narrative).
// When the year is omitted, `fallbackYear` (the meeting's own year) is used
// and the result flagged approximate by the caller; if that would place the
// filing AFTER the meeting date itself (impossible — an application can't
// be filed after the meeting that discusses it), the previous year is used
// instead, since a year-less date is only ever used to describe something
// that already happened before the current meeting.
function parseLongDate(raw: string, fallbackYear: number, notAfter: Date): Date | null {
  const trimmed = raw.trim();
  const withYear = /^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/.exec(trimmed);
  if (withYear) {
    const month = MONTHS[withYear[1].toLowerCase()];
    if (month === undefined) return null;
    const d = new Date(Number(withYear[3]), month, Number(withYear[2]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const noYear = /^([A-Za-z]+)\s+(\d{1,2})$/.exec(trimmed);
  if (noYear) {
    const month = MONTHS[noYear[1].toLowerCase()];
    if (month === undefined) return null;
    let year = fallbackYear;
    let d = new Date(year, month, Number(noYear[2]));
    if (!Number.isNaN(d.getTime()) && d.getTime() > notAfter.getTime()) {
      year -= 1;
      d = new Date(year, month, Number(noYear[2]));
    }
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

interface MeetingRef {
  url: string;
  date: Date;
}

// Confirmed live 2026-08-24 against the real Drupal Views markup on
// /minutes-archive: `<a href="/minutes-...-meeting" hreflang="en">Minutes
// of the MONTH DAY, YEAR[,] Meeting</a>` — the trailing comma before
// "Meeting" is present on some real rows ("April 17, 2026, Meeting") and
// absent on others ("May 15, 2026 Meeting"); both are stripped here before
// date parsing.
const ARCHIVE_ROW_RE = /<a href="(\/minutes-[a-z0-9-]+)"[^>]*hreflang="en">Minutes of the ([^<]+?)<\/a>/gi;

function parseArchivePage(html: string): MeetingRef[] {
  const refs: MeetingRef[] = [];
  const now = new Date();
  for (const m of html.matchAll(ARCHIVE_ROW_RE)) {
    const url = `${BASE_URL}${m[1]}`;
    const rawLabel = decodeHtmlEntities(m[2]).replace(/,?\s*Meeting$/i, "").trim();
    const date = parseLongDate(rawLabel, now.getFullYear(), now);
    if (date) refs.push({ url, date });
  }
  return refs;
}

// Fetches just enough archive-listing pages (newest first) to cover
// LOOKBACK_MONTHS, stopping as soon as a page's own oldest meeting is
// already past the cutoff — see module header FETCHING for pagination
// confirmation and MAX_ARCHIVE_PAGES for the safety cap.
async function collectRecentMeetings(cutoff: Date): Promise<MeetingRef[]> {
  const meetings: MeetingRef[] = [];
  for (let page = 0; page < MAX_ARCHIVE_PAGES; page++) {
    const url = page === 0 ? ARCHIVE_URL : `${ARCHIVE_URL}?page=${page}`;
    const html = await fetchText(url);
    const pageMeetings = parseArchivePage(html);
    if (pageMeetings.length === 0) break;
    meetings.push(...pageMeetings);
    const oldestOnPage = pageMeetings[pageMeetings.length - 1].date;
    if (oldestOnPage < cutoff) break;
    await sleep(REQUEST_DELAY_MS);
  }
  return meetings.filter((m) => m.date >= cutoff);
}

interface CaseMention {
  caseNumber: string;
  suffix: string | null; // includes leading "-", e.g. "-G", or null for bare "PRB-NNNN"
  text: string;
  meeting: MeetingRef;
}

// Confirmed live 2026-08-24: one `<p>...</p>` per agenda item, including
// the introducing sentence, full discussion, and final vote all inside the
// SAME paragraph — see module header FETCHING.
const PARAGRAPH_RE = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
// See module header STATUS for the confirmed real "PRB-4074" vs.
// "PRB-4704" transcription typo this deliberately never needs to reconcile
// — only the FIRST match per paragraph is used as that item's identity.
const CASE_NUMBER_RE = /PRB-(\d{3,6})(-[A-Za-z]{1,4})?/;

function extractCaseMentions(html: string, meeting: MeetingRef): CaseMention[] {
  const mentions: CaseMention[] = [];
  for (const m of html.matchAll(PARAGRAPH_RE)) {
    const text = stripTags(m[1]);
    if (!text) continue;
    const caseMatch = CASE_NUMBER_RE.exec(text);
    if (!caseMatch) continue;
    mentions.push({
      caseNumber: caseMatch[1],
      suffix: caseMatch[2] ? caseMatch[2].toUpperCase() : null,
      text,
      meeting,
    });
  }
  return mentions;
}

// See module header FUEL/PROJECT TYPE & CAPACITY. Returns null for "-M"
// (out of scope — telecom microwave, see header).
function classifyBySuffix(suffix: string | null): ProjectType | null {
  if (suffix === null) return "transmission";
  const s = suffix.replace(/^-/, "").toUpperCase();
  if (s === "G" || s === "SG") return "generation";
  if (s === "ESR") return "storage";
  if (s === "M") return null;
  return "transmission"; // unrecognized suffix — see header "plurality default"
}

type Resolution = "granted" | "denied" | "dismissed" | "withdrawn" | null;

// See module header STATUS for how these were calibrated against real live
// text, including a real bug found and fixed: an early version of GRANT_RE
// only matched "moved to approve" with a 400-char cap to "motion carried",
// which MISSED a real contested case (PRB-4039-G, City of Sidney diesel
// generators) whose real motion reads "Mr. Liegl MADE A MOTION TO approve
// application PRB-4039-G ON THE CONDITION THAT [a lengthy certification
// condition] ... Mr. Austin seconded the motion. Voting on the motion: ...
// The motion carried" — a different verb phrase ("made a motion to",
// confirmed real and distinct from "moved to") separated from "motion
// carried" by well over 400 characters of real conditional-approval text.
// GRANT_RE/DENY_RE/DISMISS_RE below accept both verb phrasings and no
// longer cap the distance to "motion carried" — safe because each of these
// is only ever tested against ONE paragraph's own text (see
// extractCaseMentions), and this source's real paragraph structure keeps
// one vote's motion+outcome together within its own paragraph even for
// long conditional approvals (confirmed against PRB-4039-G). DISMISS_RE and
// WITHDRAW_RE were later confirmed real against the fuller 24-month window
// (see module header STATUS) — DENY_RE alone remains under-confirmed, no
// real denial exists anywhere in that window; the curated Orders page
// confirms denial is a real historical outcome (PRB-3624 "Order of Denial")
// without providing the underlying minutes' exact vote-motion phrasing.
// "moved to"/"made a motion to" are BOTH real, confirmed verb phrasings
// (see above), and the "waive the hearing and" insert (also real,
// confirmed on PRB-4078-G) can follow EITHER — a version of GRANT_RE that
// only allowed the insert after "moved to" was caught live: the Village of
// Stuart's real diesel-generator motion reads "Vice Chairwoman Gottschalk
// MADE A MOTION TO waive the hearing and approve PRB-4078-G", which that
// narrower pattern missed, wrongly leaving a genuinely-resolved case
// classified as still pending in a real DB check. VERB_PHRASE below is
// shared by all three outcome patterns for the same reason.
const VERB_PHRASE = "(?:moved to|made a motion to)";
const WITHDRAW_RE = /\bwithdr(?:aws?|ew|awn|awing)\b[\s\S]{0,150}?\bapplication\b|\bapplication\b[\s\S]{0,50}?\b(?:is|was)\s+withdrawn\b/i;
const DENY_RE = new RegExp(`\\b${VERB_PHRASE}\\s+deny\\b[\\s\\S]*?\\bmotion carried\\b|\\bapplication is denied\\b|\\border of denial\\b`, "i");
const DISMISS_RE = new RegExp(`\\b${VERB_PHRASE}\\s+dismiss\\b[\\s\\S]*?\\bmotion carried\\b|\\bdismissed for lack of jurisdiction\\b`, "i");
const GRANT_RE = new RegExp(`\\b${VERB_PHRASE}\\s+(?:waive the hearing and\\s+)?approve\\b[\\s\\S]*?\\bmotion carried\\b`, "i");

function detectResolution(text: string): Resolution {
  if (WITHDRAW_RE.test(text)) return "withdrawn";
  if (DENY_RE.test(text)) return "denied";
  if (DISMISS_RE.test(text)) return "dismissed";
  if (GRANT_RE.test(text)) return "granted";
  return null;
}

// See module header FUEL/PROJECT TYPE & CAPACITY.
const FUEL_KEYWORDS: [RegExp, FuelType][] = [
  [/\bsolar\b/i, "solar"],
  [/\bwind\b/i, "wind_onshore"],
  [/\bnatural gas\b|\bgas[- ]fired\b|\bgas\s+(?:plant|generation)\b/i, "gas"],
  [/\bnuclear\b/i, "nuclear"],
  [/\bhydro/i, "hydro"],
  [/\bgeothermal\b/i, "geothermal"],
];
const NON_ENUM_FUEL_RE = /\bdiesel\b|\bcoal\b|\bdual[- ]fuel\b/i;

function pickFuelType(text: string): FuelType {
  let best: { fuel: FuelType; index: number } | null = null;
  for (const [re, fuel] of FUEL_KEYWORDS) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { fuel, index: m.index };
  }
  return best ? best.fuel : "other";
}

// Matches both MW and kW figures; kW values are converted by the caller —
// see module header. Real gotcha, confirmed live in three separate real
// candidates: PRB minutes sometimes spell capacity out as a WORD rather
// than digits — "a three-megawatt energy storage resource" (PRB-4052-ESR,
// Bridge Solar/LES) and "requesting authorization to install four diesel
// generators with an aggregate capacity of ten megawatts" (PRB-4039-G, City
// of Sidney) — as well as the curated Orders page's own "OPPD to Construct
// One MW ESR" caption. CAPACITY_WORD_RE covers one-twenty (NUMBER_WORDS)
// as a modest, deliberately not-exhaustive fix for this — good enough for
// this source's real small-scale municipal/cooperative filings, not
// intended as a general English-number parser.
const CAPACITY_NUMERIC_RE = /([\d,]+(?:\.\d+)?)\s*(kilowatts?|kw|megawatts?|mw)\b/i;
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};
const CAPACITY_WORD_RE = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})[- ](kilowatts?|kw|megawatts?|mw)\\b`, "i");

// Picks whichever of the numeric-digit or spelled-out-word forms occurs
// FIRST in the text (not numeric-always-wins), same leftmost-match
// convention pickFuelType uses, in case a caption states more than one
// capacity figure.
function extractCapacityMw(text: string): { value: number; convertedFromKw: boolean } | null {
  const candidates: { index: number; value: number; convertedFromKw: boolean }[] = [];

  const numMatch = CAPACITY_NUMERIC_RE.exec(text);
  if (numMatch) {
    const raw = Number(numMatch[1].replace(/,/g, ""));
    if (Number.isFinite(raw)) {
      const isKw = /^k/i.test(numMatch[2]);
      candidates.push({ index: numMatch.index, value: isKw ? raw / 1000 : raw, convertedFromKw: isKw });
    }
  }
  const wordMatch = CAPACITY_WORD_RE.exec(text);
  if (wordMatch) {
    const raw = NUMBER_WORDS[wordMatch[1].toLowerCase()];
    const isKw = /^k/i.test(wordMatch[2]);
    candidates.push({ index: wordMatch.index, value: isKw ? raw / 1000 : raw, convertedFromKw: isKw });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.index - b.index);
  return candidates[0];
}

// Nebraska's 93 real counties, per the Nebraska Legislature's own county
// list (not assumed from memory) — see module header COUNTY. Four are
// themselves multi-word ("Box Butte", "Keya Paha", "Red Willow", "Scotts
// Bluff"), which is why this is a whole-name alternation rather than a
// single-word-token whitelist lookup.
const NE_COUNTIES = [
  "Adams", "Antelope", "Arthur", "Banner", "Blaine", "Boone", "Box Butte", "Boyd", "Brown", "Buffalo",
  "Burt", "Butler", "Cass", "Cedar", "Chase", "Cherry", "Cheyenne", "Clay", "Colfax", "Cuming",
  "Custer", "Dakota", "Dawes", "Dawson", "Deuel", "Dixon", "Dodge", "Douglas", "Dundy", "Fillmore",
  "Franklin", "Frontier", "Furnas", "Gage", "Garden", "Garfield", "Gosper", "Grant", "Greeley", "Hall",
  "Hamilton", "Harlan", "Hayes", "Hitchcock", "Holt", "Hooker", "Howard", "Jefferson", "Johnson", "Kearney",
  "Keith", "Keya Paha", "Kimball", "Knox", "Lancaster", "Lincoln", "Logan", "Loup", "Madison", "McPherson",
  "Merrick", "Morrill", "Nance", "Nemaha", "Nuckolls", "Otoe", "Pawnee", "Perkins", "Phelps", "Pierce",
  "Platte", "Polk", "Red Willow", "Richardson", "Rock", "Saline", "Sarpy", "Saunders", "Scotts Bluff", "Seward",
  "Sheridan", "Sherman", "Sioux", "Stanton", "Thayer", "Thomas", "Thurston", "Valley", "Washington", "Wayne",
  "Webster", "Wheeler", "York",
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COUNTY_ALTERNATION = NE_COUNTIES.map((c) => escapeRe(c).replace(/ /g, "\\s+")).join("|");
// Matches one or more whitelisted county names joined by ","/"and"/"&"
// immediately before "County"/"Counties" — confirmed necessary against real
// multi-county captions on the curated Orders page (see module header).
const COUNTY_GROUP_RE = new RegExp(
  `(?:${COUNTY_ALTERNATION})(?:\\s*(?:,|and|&)\\s*(?:${COUNTY_ALTERNATION}))*\\s+Count(?:y|ies)\\b`,
  "gi",
);

// Scans for every INDEPENDENT county-phrase occurrence (not just one) since
// real captions sometimes state each county in its own separate phrase
// rather than one joined list (e.g. "675 MW in Cass County & 225 MW in
// Sarpy County") — see module header COUNTY.
function extractCounties(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(COUNTY_GROUP_RE)) {
    const phrase = m[0];
    for (const county of NE_COUNTIES) {
      const re = new RegExp(`\\b${escapeRe(county).replace(/ /g, "\\s+")}\\b`, "i");
      if (re.test(phrase) && !found.includes(county)) found.push(county);
    }
  }
  return found;
}

// Real observed phrasings: "This is an application submitted by the City of
// Auburn Board of Public Works." (stops at the sentence period), "This is
// an application filed by the Loup River Public Power District." (same),
// "This is an application by the Village of Stuart (Stuart) to install..."
// (stops before "to install" instead, since there's no sentence break), and
// "This is a JOINT application filed by Bridge Solar Energy Development I,
// LLC (Bridge Solar) and the Lincoln Electric System (LES)." (PRB-4052-ESR
// — "a joint application", not "an[ amended] application"; the optional
// "joint"/"amended" group below covers both real adjective forms) —
// confirmed by hand against all real candidates in the scanned window.
const APPLICANT_RE = /This is an?(?: joint| amended)? application (?:submitted |filed )?by (?:the )?(.+?)(?=\.\s|\s+to\s+[a-z])/i;

function extractApplicant(text: string): string {
  const m = APPLICANT_RE.exec(text);
  if (m) return m[1].trim();
  return text.slice(0, 80);
}

// Real observed phrasings: "The application was filed on May 1, 2026."
// (year present) and "The initial application was filed on September 5."
// (year omitted — see parseLongDate). Takes the first match in the given
// text.
const FILED_DATE_RE = /(?:initial application|application) was filed on\s+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i;

function extractFiledDateFromText(text: string, meeting: MeetingRef): { date: Date | null; approximate: boolean } {
  const m = FILED_DATE_RE.exec(text);
  if (!m) return { date: null, approximate: false };
  const raw = m[1];
  const hasYear = /\d{4}/.test(raw);
  const date = parseLongDate(raw, meeting.date.getFullYear(), meeting.date);
  return { date, approximate: !hasYear };
}

// Tries the "facts" mention first (see pickFactsMention) — the fullest
// factual recitation — and falls back to trying every OTHER mention in
// chronological order only if the facts mention doesn't state a filed date
// at all (real, confirmed gap: PRB-4052-ESR's own facts paragraph never
// states a specific filed date anywhere).
function extractFiledDate(mentions: CaseMention[], factsMention: CaseMention): { date: Date | null; approximate: boolean } {
  const fromFacts = extractFiledDateFromText(factsMention.text, factsMention.meeting);
  if (fromFacts.date) return fromFacts;
  for (const m of mentions) {
    if (m === factsMention) continue;
    const r = extractFiledDateFromText(m.text, m.meeting);
    if (r.date) return r;
  }
  return { date: null, approximate: false };
}

// REAL STRUCTURAL BUG FOUND AND FIXED before shipping (this project's
// standard verification step): a first version of this module picked the
// FIRST mention of a case (across the whole scanned window) as its "facts"
// source and the LAST mention as its "current status" source — correct for
// the common single-paragraph case, but wrong for a real contested one.
// PRB-4039-G (City of Sidney diesel generators, Oct. 2024) is split across
// FOUR separate paragraphs in one meeting's own minutes, with unrelated
// director's-report business interleaved between them: (1) "tabled ...
// scheduled for an evidentiary hearing", (2) "recessed ... to conduct an
// evidentiary hearing", (3) "The Board considered application PRB-4039-G.
// This is an application filed by the City of Sidney..." — the actual
// facts — and (4) the vote itself. Taking paragraph (1) as "the facts"
// produced a garbled name and null filed date/county in a live DB check.
// Worse, PRB-4052-ESR (Bridge Solar/LES battery storage, May 2025) showed
// the "last mention wins" half of that same design is ALSO wrong: its real
// grant is in paragraph (2) of that meeting ("Mr. Austin moved to approve
// PRB-4052-ESR ... motion carried"), but a LATER, unrelated paragraph about
// a completely different agenda item (Guidance Document 14 amendments)
// merely name-drops the case in a segue sentence — "The Board then went
// back to where it left off on its agenda prior to PRB-4052-ESR" — which
// was, wrongly, being treated as the authoritative "current status"
// mention, with no resolving language in it at all, so the case was
// LIVE-CONFIRMED to have been misclassified as still-pending in a real
// dry-run against the DB even though the Board actually granted it that
// same meeting.
//   Fixed: "facts" now comes from the EARLIEST mention (across the whole
// window, in chronological order) whose own text matches APPLICANT_RE — the
// real fact-bearing paragraph, wherever it falls, rather than assuming it's
// always the first paragraph a case appears in. "Resolution" now comes from
// the LATEST mention (scanning backwards from the newest) whose own text
// actually contains a resolving grant/deny/dismiss/withdraw pattern — a
// paragraph that merely mentions the case number in passing, with no
// resolving language, is skipped rather than treated as "the current status
// says nothing new." Both fixes were verified against a live re-run: this
// module's own dry-run JSON summary is reported to the repo owner alongside
// spot-checked DB rows for both of these exact cases.
function pickFactsMention(sorted: CaseMention[]): CaseMention {
  return sorted.find((m) => APPLICANT_RE.test(m.text)) ?? sorted[0];
}

function pickResolutionMention(sorted: CaseMention[]): { mention: CaseMention; resolution: Resolution } {
  for (let i = sorted.length - 1; i >= 0; i--) {
    const resolution = detectResolution(sorted[i].text);
    if (resolution) return { mention: sorted[i], resolution };
  }
  return { mention: sorted[sorted.length - 1], resolution: null };
}

function normalizeCase(
  caseNumber: string,
  suffix: string | null,
  sortedMentions: CaseMention[],
  projectType: ProjectType,
): NormalizedProject {
  const sourceId = `${caseNumber}${suffix ?? ""}`;
  const matchKey = resolveMatchKey("ne-prb", sourceId);
  const caseDisplay = `PRB-${sourceId}`;

  const facts = pickFactsMention(sortedMentions);
  const { mention: resolutionMention, resolution } = pickResolutionMention(sortedMentions);
  const applicant = extractApplicant(facts.text);
  const fuelType: FuelType =
    projectType === "transmission" ? "transmission" : projectType === "storage" ? "storage" : pickFuelType(facts.text);
  const capacity = extractCapacityMw(facts.text);
  const counties = extractCounties(facts.text);
  const county = counties.length > 0 ? counties.join(", ") : null;
  const filedInfo = extractFiledDate(sortedMentions, facts);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "dismissed" || resolution === "withdrawn") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  // Stable labels regardless of which meeting dates end up filling them —
  // common.ts upserts sources by (projectId, label), never deletes a label
  // that's absent from a later run, so a per-meeting-date label would leak
  // a stale source row every time a case's "most recent" meeting changes
  // across runs. Caught before shipping (this project's standard
  // verification step), same class of issue as this series' other
  // upsert-by-label gotchas.
  const sameMeeting = facts.meeting.url === resolutionMention.meeting.url;
  const sources = sameMeeting
    ? [{ label: "NE PRB Minutes", url: facts.meeting.url }]
    : [
        { label: "NE PRB Minutes (as filed)", url: facts.meeting.url },
        { label: "NE PRB Minutes (most recent status)", url: resolutionMention.meeting.url },
      ];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Nebraska Power Review Board (NPRB/PRB) — the state agency with sole statutory authority (Neb. Rev. Stat. §§70-1010 to 70-1014.01) to approve new electric generation facilities, out-of-service-area transmission lines, and (since 2024) standalone energy storage resources, since Nebraska has no investor-owned electric utilities and no Public Service Commission jurisdiction over electric-utility certificates the way most states in this series have.",
    "The PRB publishes no case-search tool or pending-docket database; \"still waiting\" here is inferred entirely from the Board's own public meeting minutes, which record each application's filing, discussion, and vote — often, but confirmed not always, within the same monthly meeting. See the ingestion module header for how this was calibrated, including a confirmed real multi-month case and a confirmed real transcription typo in the Board's own minutes.",
  ];
  if (capacity?.convertedFromKw) {
    dataQualityNoteParts.push("Capacity was published in kilowatts and converted to megawatts here for consistency with this site's other sources.");
  }
  if (fuelType === "other" && projectType === "generation") {
    dataQualityNoteParts.push(
      NON_ENUM_FUEL_RE.test(facts.text)
        ? "Fuel/technology type \"other\" reflects a diesel, dual-fuel, or coal generating unit, which doesn't map onto this site's fuel-type categories."
        : "Fuel/technology type could not be confidently determined from this candidate's meeting-minutes description.",
    );
  }
  if (county) {
    const countyWord = counties.length > 1 ? "Counties" : "County";
    dataQualityNoteParts.push(
      `Located in ${county} ${countyWord}, Nebraska, per the PRB's own meeting minutes — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`,
    );
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (NE PRB ${caseDisplay})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "NE",
    county,
    capacityValue: capacity?.value ?? null,
    capacityUnit: capacity ? "MW" : null,
    applicationFiledDate: filedInfo.date,
    dateConfidence: filedInfo.approximate ? "approximate" : "exact",
    currentStatus: `Nebraska PRB ${caseDisplay}: ${resolution ?? "pending before the Board"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on approval from the Nebraska Power Review Board under Neb. Rev. Stat. §§70-1013 to 70-1014.01 — ${caseDisplay}, "${facts.text.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources,
    externalIds: { nePrb: sourceId },
  };
}

// See module header VANISHED-CANDIDATE FIX. Minimal stub: since matchKey
// resolves directly to an existing DB row here (this matchKey was created
// by an earlier run of this same source), upsertNormalizedProject deletes
// it via the RESOLVED_STAGES path before ever reading most of these
// fields, so only matchKey/currentStage need to be meaningful.
function buildVanishedStub(matchKey: string, sourceId: string): NormalizedProject {
  const caseDisplay = `PRB-${sourceId}`;
  return {
    matchKey,
    name: `${caseDisplay} (no longer found in recent NE PRB minutes)`,
    projectType: "transmission",
    fuelType: "other",
    state: "NE",
    currentStatus: `Nebraska PRB ${caseDisplay}: no longer mentioned in the Board's minutes within the last ${LOOKBACK_MONTHS} months`,
    currentStage: "cancelled",
    causeSlugs: ["local_state_opposition"],
    causeDetail: `Nebraska PRB ${caseDisplay} no longer appears in the Board's own meeting minutes within this module's lookback window.`,
    sources: [],
    externalIds: { nePrb: sourceId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestNePrbDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - LOOKBACK_MONTHS);

  const meetings = await collectRecentMeetings(cutoff);

  const byCase = new Map<string, CaseMention[]>();
  const errors: { matchKey: string; message: string }[] = [];

  for (const meeting of meetings) {
    try {
      const html = await fetchText(meeting.url);
      for (const mention of extractCaseMentions(html, meeting)) {
        const key = `${mention.caseNumber}${mention.suffix ?? ""}`;
        const list = byCase.get(key);
        if (list) list.push(mention);
        else byCase.set(key, [mention]);
      }
    } catch (err) {
      errors.push({ matchKey: meeting.url, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const allEntries = [...byCase.entries()];
  const inScopeEntries = allEntries.filter(([, mentions]) => classifyBySuffix(mentions[0].suffix) !== null);

  const toUpsert: NormalizedProject[] = [];

  for (const [key, mentions] of inScopeEntries.slice(0, maxCandidates)) {
    // Chronological order (meeting date, then in-page paragraph order within
    // a meeting via Array.prototype.sort's stability) — see
    // pickFactsMention/pickResolutionMention for why the facts and
    // resolution sources are each independently selected from this list
    // rather than assumed to be the first/last entry.
    const sorted = [...mentions].sort((a, b) => a.meeting.date.getTime() - b.meeting.date.getTime());
    const projectType = classifyBySuffix(sorted[0].suffix);
    if (!projectType) continue; // defensive; already filtered above
    try {
      toUpsert.push(normalizeCase(sorted[0].caseNumber, sorted[0].suffix, sorted, projectType));
    } catch (err) {
      errors.push({ matchKey: key, message: String(err) });
    }
  }

  // See module header VANISHED-CANDIDATE FIX. Uses the FULL mention set
  // (allEntries, including out-of-scope -M ones) as the "not vanished"
  // signal — a -M case could never have created a tracked "ne-prb:" row to
  // begin with, so including it here is harmless, but excluding it would
  // incorrectly treat a case whose suffix classification changed (e.g. a
  // real data-entry correction) as vanished rather than simply
  // out-of-scope.
  const stillPresentMatchKeys = new Set(
    allEntries.map(([, mentions]) => resolveMatchKey("ne-prb", `${mentions[0].caseNumber}${mentions[0].suffix ?? ""}`)),
  );
  const previouslyTracked = await prisma.project.findMany({
    where: { matchKey: { startsWith: "ne-prb:" } },
    select: { matchKey: true },
  });
  for (const { matchKey } of previouslyTracked) {
    if (matchKey && !stillPresentMatchKeys.has(matchKey)) {
      const sourceId = matchKey.slice("ne-prb:".length);
      toUpsert.push(buildVanishedStub(matchKey, sourceId));
    }
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert);

  return {
    candidatesFound: allEntries.length,
    realApplicationCandidates: inScopeEntries.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestNePrbDockets()
    .then((summary) => {
      console.log(
        `Nebraska PRB docket ingestion complete: ${summary.candidatesFound} case numbers found in the lookback window, ` +
          `${summary.realApplicationCandidates} in-scope generation/transmission/storage applications, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
