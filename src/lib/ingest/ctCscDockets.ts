// Connecticut Siting Council (CSC) docket/petition ingestion — one of
// several states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-23.
//
// WHY CSC, NOT PURA: the task brief started from the hint that Connecticut's
// Public Utilities Regulatory Authority (PURA) runs the public docket
// search, matching every other state in this series (a PUC/PSC that itself
// issues CPCN/siting certificates) — the same hint that turned out wrong for
// Washington (WUTC vs EFSEC), Oregon (PUC vs EFSC), and Massachusetts (DPU
// vs EFSB). Checked here too, per this project's "confirm before guessing"
// rule. Connecticut works the same way as those three: PURA regulates
// utility rates/service, but the actual siting/CPCN-equivalent authority for
// generating facilities, transmission lines, and other large energy
// facilities is vested by Connecticut General Statutes §16-50k in a
// separate body, the Connecticut Siting Council (portal.ct.gov/csc), which
// issues a "Certificate of Environmental Compatibility and Public Need."
// PURA is even listed as one of CSC's own "State Agencies Solicited for
// Comment" on CSC's Pending Matters page (i.e. PURA is a commenter *into*
// CSC's process, not the decision-maker) — confirmed by hand. This module
// therefore ingests CSC, not PURA — hence "ctCscDockets.ts" rather than a
// literal "ctPuraDockets.ts".
//
// FETCHING: portal.ct.gov/csc is the state's generic Sitecore/CT.gov CMS —
// plain server-rendered HTML, no auth, no JS execution required, confirmed
// by hand against several pages with a plain `fetch()`. There is no JSON API
// and no queryable docket-search form anywhere on the site (confirmed by
// hand — CSC's own site search just proxies to Google Site Search). Instead
// CSC hand-maintains a small set of CMS pages:
//   - /csc/1_applications-and-other-pending-matters/pending-matters — a
//     single hand-edited page listing every matter CSC currently considers
//     open, grouped under `<h2>` headers: APPLICATIONS (full Certificate
//     applications, i.e. "Dockets"), PETITIONS (requests for a declaratory
//     ruling under §4-176/§16-50k — Connecticut's lighter-weight siting
//     review track, used heavily for smaller solar/storage/fuel-cell
//     facilities but functionally the same "is CSC approval needed, and is
//     it granted" review this project tracks), TOWER SHARE REQUESTS,
//     PETITION NO. 1133 (wireless-facility "Eligible Facility Request"
//     sub-filings), PETITION NO. 1293 (Eversource's standing petition for a
//     ruling that routine transmission maintenance needs no new
//     Certificate), OTHER CSC MATTERS (the Ten-Year Forecast report, not a
//     project), and ENFORCEMENT ACTIONS. Confirmed by hand 2026-08-23: this
//     page is genuinely hand-typed prose, not a rendered database view (its
//     own text says "the Council is not required to maintain an online data
//     base of Pending Matters... the Council may not be able to keep the
//     information found on these sites up to date" — taken seriously here,
//     see STATUS below for a real case where that disclaimer was proven
//     true). Only the APPLICATIONS, PETITIONS, and ENFORCEMENT ACTIONS
//     sections are scanned for candidates — TOWER SHARE REQUESTS (cell-tower
//     collocation, not energy), PETITION NO. 1133 (same, wireless), PETITION
//     NO. 1293 (a standing "no Certificate needed for routine maintenance"
//     ruling request, not a new-capacity siting application — same kind of
//     jurisdictional/maintenance carve-out maEfsbDockets.ts's EXCLUDE_RE
//     filters out), and OTHER CSC MATTERS (not a project at all) are
//     deliberately skipped by only ever looking inside the three named
//     `<h2>` sections.
//   - Each docket/petition also gets its own hand-maintained detail page
//     (e.g. /csc/.../docket-no-550, /csc/3_petitions/.../pe1710) with a
//     labeled "APPLICATION (recd. MM/DD/YY)" or "PETITION (recd. MM/DD/YY)"
//     heading giving the filing date, plus free-text section headers for
//     filed documents (PROCEDURAL CORRESPONDENCE, STATE AGENCY COMMENTS,
//     etc.) — no structured fields at all, same fully-prose-authored
//     situation as mdPscDockets.ts's caption-only records, just worse (no
//     table of any kind, one page per docket, entirely hand-written HTML).
//   - CSC also separately hand-maintains historical "Decision and Order
//     List" pages, one per docket/petition number range (docket ranges:
//     1-499, 500-999; petition ranges: 1-499, 500-999, 1000-1499, 1500-1999
//     — confirmed by hand against the site's own range-index pages; a
//     number outside every known range throws rather than silently being
//     treated as still-pending, since CSC opening a new numbering block is
//     exactly the kind of change that should surface loudly — see
//     rangeForNumber). These are the single most useful page type this
//     source has for STATUS (next section).
//
// STATUS: CSC's Pending Matters page has no structured status field at all
// (same root problem as mdPscDockets.ts) and its own disclaimer warns it can
// go stale — confirmed true by hand, not just theoretical: as of this
// writing (2026-08-23), CSC's own ENFORCEMENT ACTIONS section on the live
// Pending Matters page still lists "PETITION NO. 1056 – GRE 314 East Lyme,
// LLC petition for a declaratory ruling that no Certificate ... is required
// for the proposed construction and operation of a 5.0 MW Solar
// Photovoltaic Renewable Energy Generating Project ... East Lyme,
// Connecticut" as an open matter — but Petition 1056 has a Findings of Fact,
// Opinion, and Decision and Order all on file, and CSC's own decisions
// archive (petition-list-1000-1499) records it "Approved 05/16/13" —
// thirteen years before this module was written. So this module never
// trusts the Pending Matters page's mere presence of an entry as proof it's
// still open. Instead, for every APPLICATIONS/PETITIONS/ENFORCEMENT ACTIONS
// candidate, its docket/petition number is checked against CSC's own
// Decision and Order List page for the range that number falls in
// (buildDecidedNumberSet) — every one of the ~200+ real decided
// dockets/petitions checked by hand in that list carries *some* disposition
// text next to it (mostly "Approved MM/DD/YY" / "Denied MM/DD/YY", but real
// observed variants include "Withdrawn MM/DD/YY", "Voted on MM/DD/YY",
// "Declined [Without Prejudice] to Issue a Declaratory Ruling MM/DD/YY", and
// "Rejected as Incomplete MM/DD/YY" — this module does not attempt to parse
// which of these it is, since for this project's purposes any of them means
// "no longer waiting," so simple presence on the decisions list is enough;
// see buildDecidedNumberSet). A number simply absent from every known decisions-list
// range is treated as still genuinely open. As a second, independent check,
// a candidate not already caught by the decisions-list cross-check still has
// its own detail page fetched (needed anyway for its filed date, see
// FUEL/PROJECT TYPE & CAPACITY below) and scanned for "Findings of
// Fact"/"Decision and Order"/"Opinion for" link text, in case a very recent
// decision hasn't yet been folded into the summary decisions-list page; not
// currently exercised by any live candidate but kept as defense in depth,
// same rationale as EFSB's dual ClosedDate-or-Final-Decision check. One red
// herring investigated and *not* acted on: a handful of decided entries
// render their disposition word split across adjacent `<strong>` tags with
// no space between them (e.g. Petition 1668 literally serializes as
// `<strong>Denie</strong><strong>d 10/30/25</strong>`), which would break a
// naive tag-strip-to-space approach. Turned out irrelevant here — this
// module never parses decided entries' disposition text, only their
// presence, so stripHtml below strips tags to nothing (not a space)
// precisely so a split like that re-joins correctly if any future logic
// ever does need to read it.
//
// A candidate determined resolved either way is NOT simply excluded from
// this run's output — a real bug caught before shipping (this project's
// standard verification step): common.ts's upsertNormalizedProject only
// ever deletes a project when it's *passed in* with a RESOLVED_STAGES
// stage (see its own RESOLVED_STAGES ENFORCEMENT doc comment); it never
// diffs "everything previously tracked for this source, minus what showed
// up this run." A first version of this module simply dropped resolved
// candidates from its output, which would have meant a project already in
// the DB from a prior run (still local_review) that later resolves would
// never be revisited or deleted — exactly the "stale row frozen in its
// last-known waiting state" scenario common.ts's own design is meant to
// prevent. Fixed: every resolved candidate is still normalized and pushed
// through with currentStage="cancelled" (a RESOLVED_STAGES member — picked
// over "approved_awaiting_construction" since, per above, this module
// deliberately never determines *which* disposition a decided entry
// carries, so "cancelled" is used generically the same way
// moPscDockets.ts's "closed-unclear" resolution does), so
// upsertNormalizedProjects correctly deletes any existing row for it.
//
// SCOPING to real energy candidates: both APPLICATIONS and PETITIONS
// sections mix energy-facility matters (solar, battery storage, fuel cell,
// transmission lines, a waste-to-energy plant) with wireless/cell-tower
// matters (CSC also has telecommunications-tower siting jurisdiction under
// the same statute, confirmed by hand reading Dockets 551/552 and Petition
// 1715/1702's live descriptions) — telecommunications isn't one of this
// site's tracked ProjectTypes, so TELECOM_RE excludes any candidate whose
// description mentions a "telecommunications facility" or "wireless
// facility" before it's even normalized (and before its detail page is
// fetched, saving a request).
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields — parsed from each
// candidate's own free-text description on the Pending Matters page (the
// richest prose available without an extra request), same regex-over-prose
// approach as nyDpsDockets.ts/maEfsbDockets.ts. Real gotchas found by hand:
// (1) Connecticut's Petitions track is used heavily for "fuel cell"
// facilities (confirmed live: Petition 1719 is a 45-megawatt "trash-to-
// energy" plant; other decided petitions include natural-gas/biogas-fed
// fuel cells) — neither "fuel cell" nor "trash-to-energy"/"waste-to-energy"
// generation maps cleanly onto this site's FuelType enum, so both fall back
// to "other" with a dataQualityNote explaining why, rather than being
// mis-tagged as "gas" without confirmation of the actual feedstock. (2)
// Capacity is published inconsistently in megawatts ("50-megawatt-AC",
// "3.4-megawatt AC") and kilowatts ("300-kilowatt AC", "920-kilowatt") —
// CAPACITY_RE captures both and kilowatt figures are converted to MW
// (divided by 1000) so this source's capacityValue is always comparable in
// the same unit as every other module, flagged in dataQualityNote whenever
// the conversion is applied.
//
// LOCATION: no structured field; Connecticut abolished county government in
// 1960 and CSC's own filings identify projects by town/municipality, not
// county (per this project brief's own note) — confirmed by hand: every
// live candidate description bolds the town name immediately before ",
// Connecticut" (e.g. "<strong>Sterling</strong>, Connecticut"), extracted by
// TOWN_RE directly off the raw (pre-strip) HTML for that reason. Recorded in
// the `county` field despite being a town name, not a county, same
// field-reuse WA's and MA's modules documented; flagged in dataQualityNote.
// A project can bold more than one town (e.g. Docket 550 spans Sterling and
// Plainfield); all are kept, semicolon-joined.
//
// Wired to Vercel Cron weekly (see vercel.json and
// src/app/api/cron/ingest-ct-csc/route.ts). Real full-population timing
// measured 2026-08-24: fetching Pending Matters, both needed decisions-list
// range pages, and a detail-page for every not-already-decided candidate
// (11 real candidates) took ~14.5s — comfortably inside the 300s cron
// budget. Also politeness-delayed between per-candidate detail-page
// requests (only fetched for candidates not already resolved by the
// decisions-list cross-check).

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://portal.ct.gov";
const PENDING_MATTERS_URL = `${BASE_URL}/csc/1_applications-and-other-pending-matters/pending-matters`;

// Comfortably above the current real candidate count (~9-13 total pending
// matters across APPLICATIONS/PETITIONS/ENFORCEMENT ACTIONS before the
// telecom/decided filters below run) — see module header. CSC's whole
// currently-open docket load is tiny (a handful of applications plus a
// dozen or so petitions), nothing like the hundreds seen in higher-volume
// docket-search states, so there's no realistic scenario of this cap
// silently dropping a genuinely-still-open matter.
export const MAX_CANDIDATES = 50;
const REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`CT CSC request failed (${res.status}): ${url}`);
  return res.text();
}

// Tags stripped to nothing, not a space — see module header STATUS for why
// (a real decided entry's disposition word is split across two adjacent
// `<strong>` tags with no source whitespace between them; every other word
// boundary in this CMS's hand-authored prose relies on an explicit literal
// space or `&nbsp;`, not on tag adjacency, so this is safe).
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&sect;/g, "§")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();
}

type CandidateKind = "docket" | "petition";

interface PendingCandidate {
  kind: CandidateKind;
  number: string;
  url: string;
  descriptionHtml: string;
}

// Matches CSC's `<h2>` section headers loosely enough to tolerate the
// inconsistent trailing `&nbsp;`/whitespace seen across the three sections
// this module scans (confirmed by hand: "APPLICATIONS" has none, "PETITIONS"
// has a trailing `&nbsp;`, "ENFORCEMENT ACTIONS" has none).
function extractSection(html: string, headerText: string): string | null {
  const headerRe = new RegExp(`<h2[^>]*>\\s*${headerText}\\s*(?:&nbsp;)?\\s*</h2>`, "i");
  const m = headerRe.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const nextH2 = html.indexOf("<h2", start);
  return html.slice(start, nextH2 === -1 ? undefined : nextH2);
}

// Finds every "DOCKET NO. ###" / "PETITION NO. ###" anchor in a section's
// HTML, then grabs the enclosing `<p>...</p>` as that entry's full
// description. Matches the anchor generically first (`<a href="...">...
// </a>`) and strips tags from *inside* the anchor before testing its text
// against the label — confirmed by hand this is necessary, not just
// defensive: real entries wrap the label three different ways depending on
// which one was typed, e.g. `<a href="...">DOCKET NO. 550</a>` (Docket 550,
// label directly inside the anchor) vs. `<a href="..."><strong>PETITION NO.
// 1711</strong></a>` (Petitions 1711/1713/1714/1718/1056, label wrapped in
// its own nested `<strong>` *inside* the anchor) — an anchor-innerHTML regex
// that only tolerated whitespace between the anchor tags and the label text
// silently dropped every one of the second form when first tried here.
function extractSectionEntries(sectionHtml: string, kind: CandidateKind): PendingCandidate[] {
  const label = kind === "docket" ? "DOCKET" : "PETITION";
  const labelRe = new RegExp(`^${label}\\s+NO\\.\\s*(\\d+[A-Za-z]?)$`, "i");
  const anchorRe = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const entries: PendingCandidate[] = [];
  for (const m of sectionHtml.matchAll(anchorRe)) {
    const href = m[1];
    const innerText = stripHtml(m[2]);
    const labelMatch = labelRe.exec(innerText);
    if (!labelMatch) continue;
    const number = labelMatch[1].toUpperCase();
    const matchIndex = m.index ?? sectionHtml.indexOf(m[0]);
    const pStart = sectionHtml.lastIndexOf("<p", matchIndex);
    const pEndContentIndex = sectionHtml.indexOf("</p>", matchIndex);
    if (pStart === -1 || pEndContentIndex === -1) continue;
    const descriptionHtml = sectionHtml.slice(pStart, pEndContentIndex + 4);
    entries.push({
      kind,
      number,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      descriptionHtml,
    });
  }
  return entries;
}

export function parsePendingMatters(html: string): PendingCandidate[] {
  const applications = extractSection(html, "APPLICATIONS");
  const petitions = extractSection(html, "PETITIONS");
  const enforcement = extractSection(html, "ENFORCEMENT ACTIONS");

  const entries: PendingCandidate[] = [];
  if (applications) entries.push(...extractSectionEntries(applications, "docket"));
  if (petitions) entries.push(...extractSectionEntries(petitions, "petition"));
  // Enforcement Actions filings CSC has issued that use the same Petition
  // numbering/process as the PETITIONS section (confirmed live: Petition
  // 1056, see module header STATUS) — scanned the same way. Not itself a
  // sign this section is reliable (1056 is the very case proving it isn't),
  // just scanned so a genuinely-open enforcement petition isn't missed;
  // the decisions-list cross-check is what actually protects against
  // staleness here.
  if (enforcement) entries.push(...extractSectionEntries(enforcement, "petition"));

  if (entries.length === 0) {
    throw new Error(
      "CT CSC Pending Matters page matched zero candidates — the page structure likely changed. Check parsePendingMatters in src/lib/ingest/ctCscDockets.ts against a fresh response.",
    );
  }
  return entries;
}

// Wireless/cell-tower siting matters share CSC's jurisdiction and numbering
// series with real energy facilities but aren't a tracked ProjectType on
// this site — confirmed by hand against every live telecom candidate's own
// description text using one of these two phrasings.
const TELECOM_RE = /\btelecommunications facility\b|\bwireless facility\b/i;

interface NumberRange {
  min: number;
  max: number;
  path: string;
}

// See module header FETCHING/STATUS — confirmed by hand against CSC's own
// range-index pages (docket-list-page, petition-list-page) 2026-08-23.
const DOCKET_DECISION_RANGES: NumberRange[] = [
  { min: 1, max: 499, path: "/csc/decisions/docketlists/docket-list-nos1-499?archived=true" },
  { min: 500, max: 999, path: "/csc/decisions/docketlists/docket-list-nos500-999" },
];

const PETITION_DECISION_RANGES: NumberRange[] = [
  { min: 1, max: 499, path: "/csc/decisions/petition-lists/petition-list-1-499?archived=true" },
  { min: 500, max: 999, path: "/csc/decisions/petition-lists/petition-list-500-999?archived=true" },
  { min: 1000, max: 1499, path: "/csc/decisions/petition-lists/petition-list-1000-1499?archived=true" },
  { min: 1500, max: 1999, path: "/csc/decisions/petition-lists/petition-list-1500-1999" },
];

// Throws on a number outside every known range rather than silently
// guessing "still pending" — see module header FETCHING. A new numbering
// block (e.g. dockets reaching 1000, petitions reaching 2000) is exactly
// the kind of change that should surface as an error for a maintainer to
// add a new range, not a silent gap in the resolution check.
function rangeForNumber(ranges: NumberRange[], kind: CandidateKind, n: number): NumberRange {
  const r = ranges.find((r) => n >= r.min && n <= r.max);
  if (!r) {
    throw new Error(
      `CT CSC ${kind} number ${n} isn't covered by any known decisions-list range — add a new entry to ${
        kind === "docket" ? "DOCKET_DECISION_RANGES" : "PETITION_DECISION_RANGES"
      } in src/lib/ingest/ctCscDockets.ts (CSC likely opened a new numbering block).`,
    );
  }
  return r;
}

function leadingNumber(number: string): number {
  const m = /^\d+/.exec(number);
  if (!m) throw new Error(`CT CSC: candidate number "${number}" has no leading digits.`);
  return Number(m[0]);
}

// Presence-only check — see module header STATUS for why this module never
// parses *which* disposition a decided entry carries.
const DECIDED_NUMBER_RE = /(?:DOCKET|PETITION)\s+NO\.\s*(\d+[A-Za-z]?)/gi;

function parseDecidedNumbers(html: string): Set<string> {
  const set = new Set<string>();
  for (const m of html.matchAll(DECIDED_NUMBER_RE)) set.add(m[1].toUpperCase());
  return set;
}

// Fetches (and caches within one ingestion run) every decisions-list page
// actually needed for the candidates at hand, rather than every known range
// — CSC's decisions lists are large (hundreds of entries each) and most
// ranges are irrelevant to any given run's tiny candidate set.
async function buildDecidedNumberSet(candidates: PendingCandidate[]): Promise<Set<string>> {
  const neededPaths = new Set<string>();
  for (const c of candidates) {
    const ranges = c.kind === "docket" ? DOCKET_DECISION_RANGES : PETITION_DECISION_RANGES;
    neededPaths.add(rangeForNumber(ranges, c.kind, leadingNumber(c.number)).path);
  }

  const decided = new Set<string>();
  for (const path of neededPaths) {
    const html = await fetchText(`${BASE_URL}${path}`);
    for (const n of parseDecidedNumbers(html)) decided.add(n);
    await sleep(REQUEST_DELAY_MS);
  }
  return decided;
}

// See module header STATUS second-signal note.
const DETAIL_DECIDED_RE = /Findings of Fact|Decision and Order|Opinion for (?:Docket|Petition)/i;

// Handles both real formats observed on live detail pages: "APPLICATION
// (recd. 02/20/26)" (parenthesized, Docket 550/551) and "PETITION recd.
// 06/10/26" (no parentheses at all, Petition 1712) — confirmed by hand,
// not assumed consistent.
const RECEIVED_DATE_RE = /(?:APPLICATION|PETITION)\s*\(?\s*recd\.?\s*(\d{2})\/(\d{2})\/(\d{2})\)?/i;

function parseReceivedDate(html: string): Date | null {
  const m = RECEIVED_DATE_RE.exec(html);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  const date = new Date(2000 + Number(yy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

interface CandidateDetail {
  receivedDate: Date | null;
  decidedOnDetailPage: boolean;
}

async function fetchCandidateDetail(url: string): Promise<CandidateDetail> {
  const html = await fetchText(url);
  // Matched against stripped text, not raw HTML — confirmed necessary by
  // hand: Docket 550's heading reads "APPLICATION (recd. 02/20/26)" as
  // plain adjacent text, but Petition 1710's reads `<strong>PETITION</strong>
  // (recd. 05/22/26)` — a tag boundary sits between the label and "(recd.",
  // which a raw-HTML regex (tolerating only whitespace there) silently
  // failed to match, leaving a real candidate's filed date null.
  const text = stripHtml(html);
  return {
    receivedDate: parseReceivedDate(text),
    decidedOnDetailPage: DETAIL_DECIDED_RE.test(text),
  };
}

// See module header LOCATION — bolded town name(s) immediately preceding
// ", Connecticut", matched on the raw (pre-strip) description HTML.
// `\s*` right inside the `<strong>` tags is necessary, not defensive —
// confirmed by hand: Docket 550's first town is literally serialized as
// `<strong> Sterling</strong>` (a stray leading space inside the tag,
// evidently a copy-paste artifact from the source document), which a
// tight `<strong>([A-Za-z]...)` match silently skipped, undercounting a
// real multi-town project down to one town.
const TOWN_RE = /<strong>\s*([A-Za-z][A-Za-z .'-]*?)\s*<\/strong>,\s*(?:&nbsp;)?Connecticut/g;

function extractTowns(descriptionHtml: string): string | null {
  const matches = [...descriptionHtml.matchAll(TOWN_RE)].map((m) => m[1].trim());
  if (matches.length === 0) return null;
  return [...new Set(matches)].join("; ");
}

const STORAGE_RE = /battery energy storage/i;
const TRANSMISSION_RE = /transmission (?:line|facilit)|(?:^|[^0-9])\d[\d,]*[\s-]*kv\b/i;
const FUEL_CELL_RE = /fuel cell/i;
const WASTE_RE = /trash-to-energy|waste-to-energy|municipal solid waste/i;
const SOLAR_RE = /solar photovoltaic|\bsolar\b/i;
const WIND_RE = /\bwind\b/i;

// See module header FUEL/PROJECT TYPE & CAPACITY for the fuel-cell and
// trash-to-energy fallback-to-"other" cases.
function inferProjectType(desc: string): ProjectType {
  if (TRANSMISSION_RE.test(desc)) return "transmission";
  if (STORAGE_RE.test(desc)) return "storage";
  return "generation";
}

function inferFuelType(desc: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  if (SOLAR_RE.test(desc)) return "solar";
  if (WIND_RE.test(desc)) return "wind_onshore";
  if (FUEL_CELL_RE.test(desc)) return "other";
  if (WASTE_RE.test(desc)) return "other";
  return "other";
}

// Matches both megawatt and kilowatt figures as published (e.g.
// "50-megawatt-AC", "3.4-megawatt AC", "300-kilowatt AC", "920-kilowatt") —
// confirmed by hand across live candidates; kilowatt values are converted to
// MW by the caller so this source's capacityValue is always comparable to
// every other module's.
const CAPACITY_RE = /([\d,]+(?:\.\d+)?)[\s-]*(megawatt|kilowatt)s?\b/i;

function extractCapacityMw(desc: string): { value: number; convertedFromKw: boolean } | null {
  const m = CAPACITY_RE.exec(desc);
  if (!m) return null;
  const raw = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(raw)) return null;
  const isKilowatt = m[2].toLowerCase() === "kilowatt";
  return { value: isKilowatt ? raw / 1000 : raw, convertedFromKw: isKilowatt };
}

// Strips the leading "DOCKET NO. 550 –"/"PETITION NO. 1710 –" label (the
// anchor's own text, still present after stripHtml since only tags — not
// their text content — are removed) so the applicant-extraction regexes
// below start matching from the real first word of the sentence. The dash
// can decode to an en dash, em dash, or plain hyphen depending on source
// markup — confirmed by hand both en-dash (`&ndash;`) and plain "-" forms
// exist across live entries.
function stripLeadingLabel(desc: string): string {
  return desc.replace(/^(?:DOCKET|PETITION)\s+NO\.\s*\d+[A-Za-z]?\s*[–—-]\s*/i, "").trim();
}

const APPLICANT_APPLICATION_RE = /^(.*?)\s+application for a Certificate/i;
const APPLICANT_PETITION_RE = /^(.*?)\s+petition for a declaratory ruling/i;

function extractApplicant(desc: string): string {
  let m = APPLICANT_APPLICATION_RE.exec(desc);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  m = APPLICANT_PETITION_RE.exec(desc);
  if (m) return m[1].trim().replace(/[,.]+$/, "");
  return desc.slice(0, 80);
}

// `detail` is null when the decisions-list cross-check alone already
// proved this candidate resolved (see STATUS above) — its own detail page
// is never fetched in that case, so `resolved` here is `true` without a
// `detail.decidedOnDetailPage` to consult; `filedDate` simply comes back
// null for that candidate (irrelevant, since a resolved project is deleted
// rather than displayed — see below).
function normalizeCandidate(candidate: PendingCandidate, detail: CandidateDetail | null): NormalizedProject {
  const sourceId = `${candidate.kind}-${candidate.number}`;
  const matchKey = resolveMatchKey("ct-csc", sourceId);

  const rawDesc = stripHtml(candidate.descriptionHtml);
  const desc = stripLeadingLabel(rawDesc);
  const applicant = extractApplicant(desc);

  const projectType = inferProjectType(desc);
  const fuelType = inferFuelType(desc, projectType);
  const capacity = extractCapacityMw(desc);
  const town = extractTowns(candidate.descriptionHtml);
  const resolved = detail === null || detail.decidedOnDetailPage;

  const label = candidate.kind === "docket" ? "Docket" : "Petition";
  const usesFuelCellOrWaste = FUEL_CELL_RE.test(desc) || WASTE_RE.test(desc);

  const dataQualityNoteParts: string[] = [
    "Sourced from the Connecticut Siting Council (CSC)'s hand-maintained public docket/petition pages, not the Public Utilities Regulatory Authority (PURA) — CSC is the body that actually issues Connecticut's Certificate of Environmental Compatibility and Public Need (the state's real CPCN equivalent for large energy facilities) under Connecticut General Statutes §16-50k; PURA is only a commenter into CSC's process. See the ingestion module header for the full comparison.",
    'CSC\'s own "Pending Matters" page carries a disclaimer that it may not always be kept up to date, and this was confirmed true by hand: as of this writing it still lists Petition No. 1056 (East Lyme solar) as an open enforcement matter even though CSC\'s own decisions archive shows it "Approved 05/16/13." This project cross-checks every candidate against CSC\'s own historical Decision and Order List for its docket/petition-number range before treating it as still open, precisely because of cases like this. See the ingestion module header for details.',
  ];
  if (capacity?.convertedFromKw) {
    dataQualityNoteParts.push("Capacity was published in kilowatts and converted to megawatts here for consistency with this site's other sources.");
  }
  if (usesFuelCellOrWaste) {
    dataQualityNoteParts.push('Fuel/technology type "other" reflects a fuel-cell or waste-to-energy generating facility, which doesn\'t map cleanly onto this site\'s fuel-type categories — not independently verified against the underlying feedstock.');
  } else if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from this candidate's description text.");
  }
  if (town) {
    const word = town.includes(";") ? "Towns" : "Town";
    dataQualityNoteParts.push(`Located in the ${word} of ${town}, Connecticut, per CSC's own filing text — this is a municipality name, not a county (Connecticut abolished county government in 1960); no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  // See module header STATUS: a resolved candidate is still passed through
  // (not silently dropped) with a RESOLVED_STAGES stage so
  // upsertNormalizedProjects deletes any existing row for it. "cancelled" is
  // used generically rather than "approved_awaiting_construction" since this
  // module never determines *which* disposition a decided entry carries.
  const currentStage: ProjectStage = resolved ? "cancelled" : "local_review";
  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  return {
    matchKey,
    name: `${applicant} (CT CSC ${label} No. ${candidate.number})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "CT",
    county: town,
    capacityValue: capacity?.value ?? null,
    capacityUnit: capacity ? "MW" : null,
    applicationFiledDate: detail?.receivedDate ?? null,
    dateConfidence: "exact",
    currentStatus: resolved
      ? `CT CSC ${label} No. ${candidate.number}: resolved (no longer pending before the Connecticut Siting Council)`
      : `CT CSC ${label} No. ${candidate.number}: pending before the Connecticut Siting Council`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Environmental Compatibility and Public Need (or related declaratory ruling) from the Connecticut Siting Council — ${label} No. ${candidate.number}, "${desc.slice(0, 300)}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `CT CSC ${label} No. ${candidate.number}`,
        url: candidate.url,
      },
    ],
    externalIds: { ctCsc: sourceId },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestCtCscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const pendingHtml = await fetchText(PENDING_MATTERS_URL);
  const allCandidates = parsePendingMatters(pendingHtml);

  const realCandidates = allCandidates
    .filter((c) => !TELECOM_RE.test(stripHtml(c.descriptionHtml)))
    .slice(0, maxCandidates);

  const decidedNumbers = await buildDecidedNumberSet(realCandidates);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const candidate of realCandidates) {
    try {
      if (decidedNumbers.has(candidate.number)) {
        // Already known resolved from the decisions-list cross-check — see
        // module header STATUS — so its own detail page is never fetched
        // (saves a request); still pushed through normalizeCandidate(...,
        // null) so upsertNormalizedProjects deletes any existing row.
        toUpsert.push(normalizeCandidate(candidate, null));
        continue;
      }
      const detail = await fetchCandidateDetail(candidate.url);
      toUpsert.push(normalizeCandidate(candidate, detail));
      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      errors.push({ matchKey: `${candidate.kind}-${candidate.number}`, message: String(err) });
    }
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = realCandidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: allCandidates.length,
    realApplicationCandidates: realCandidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestCtCscDockets()
    .then((summary) => {
      console.log(
        `Connecticut CSC ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.realApplicationCandidates} real energy-facility candidates (non-telecom), upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
