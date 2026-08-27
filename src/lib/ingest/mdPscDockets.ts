// Maryland Public Service Commission (PSC) Certificate of Public Convenience
// and Necessity (CPCN) docket ingestion — one of several states built in
// parallel in the per-state series started with vaSccDockets.ts (see that
// file's header for the overall rationale). Confirmed by hand 2026-08-23 via
// real requests against the live site — no assumption below was taken from
// documentation or training-data memory alone.
//
// SCOPING: Maryland requires a CPCN (Md. Code, Pub. Util. Cos. § 7-207) for
// most new generating stations, storage, and transmission line construction.
// A second body, the Department of Natural Resources' Power Plant Research
// Program (PPRP), is a mandatory PARTY to every CPCN case (reviewing/
// recommending siting conditions) but has no independent decision authority
// of its own — the Commission (frequently acting through a delegated Public
// Utility Law Judge, "PULJ") is the sole decision-maker, so this module only
// needs the one system below, not a separate PPRP source.
//
// FETCHING: webpscxb.pscmaryland.com/DMS is MD PSC's public "Document and
// Matter Management" ASP.NET WebForms site (psc.maryland.gov's own "Case/
// Maillog Search" nav link resolves here). It has a dedicated, pre-scoped
// "CPCN Applications" page (GET /DMS/cpcnapplication) that a plain
// unauthenticated GET returns fully server-rendered: as of 2026-08-23 it
// lists all 175 CPCN application cases ever filed (back to December 2016),
// most-recent-first, each with its case number, filed date, and full
// caption text — confirmed by hand that every single one of the 175 real
// captions contains both "Application" and "Certificate of Public
// Convenience" (no rate cases, no water/sewer, no gas-utility dockets slip
// in — this page is already scoped to exactly what this site tracks). No
// separate search/filter step is needed.
// Each case's own document ("mail log") list — needed for STATUS below — is
// NOT on that list page; it requires a real ASP.NET WebForms postback
// (__EVENTTARGET=ctl00$ContentPlaceHolder1$RptCPCNApplicationList$ctlNN$
// lnkbtnCaseNum, NN = the row's 0-based index, zero-padded to 2 digits below
// 10) back to the SAME /DMS/cpcnapplication URL, reusing the __VIEWSTATE/
// __VIEWSTATEGENERATOR captured from the initial GET. Confirmed by hand:
// this page has NO __EVENTVALIDATION field at all (EnableEventValidation is
// off) and needs no session cookie whatsoever — a single captured viewstate
// was successfully reused for 175 sequential, cookie-less POSTs in testing
// with zero failures, so this module does no cookie-jar bookkeeping.
// Confirmed gotcha: a plain GET to the per-case URL the site's own search
// redirects to (/DMS/case/{caseNum}) returns HTTP 403 with a Cloudflare
// "Just a moment..." bot challenge — Cloudflare fronts this whole site
// (visible via the `server: cloudflare` response header even on the
// requests that DO succeed) but apparently only challenges that specific
// URL pattern, not GET/POST /DMS/cpcnapplication. This module never
// requests /DMS/case/{caseNum} itself; it's used only as the human-facing
// `sources` URL, where a real browser's Cloudflare challenge resolves
// automatically.
//
// STATUS — same lesson as every prior state in this series, independently
// reconfirmed here the hard way (see the extended trial-and-error below,
// preserved because every wrong turn is a real, hand-confirmed gotcha, not
// a hypothetical): MD PSC's mail log has no "Status" field at all. The
// obvious-looking heuristic ("does any filed document's title contain
// GRANTED/DENIED") was tried FOUR different ways against real data before
// landing on the actual rule, calibrated against a full scan of all 175
// real cases (not a sample) and cross-checked against each case's own
// later compliance filings:
//   1. FIRST ATTEMPT — look for the Commission's own Order document to say
//      something like "Order Granting/Denying the Application": WRONG. Real
//      Commission/PULJ "Order" mail-log entries are very often filed with
//      NO descriptive subject at all beyond the order number itself (e.g.
//      real Case 9439's actual grant order is logged as literally "Order
//      No. 88644." — confirmed via TWO independent views, the case's own
//      mail log AND the separate Commission Orders search tool, both show
//      the same blank subject) or, worse, one case (9495) has a truly BLANK
//      subject ("Case No. 9495" and nothing else) for its dispositive PULJ
//      order. No keyword search on the order's own subject text is
//      sufficient on its own.
//   2. SECOND ATTEMPT — infer "granted" from downstream compliance-looking
//      language ("Licensing/PPRP/CPCN/Staff Condition N", "Decommissioning
//      Plan", "Recommended Conditions"): WRONG, and a real bug caught only
//      by full-dataset testing, not spot-checking: DNR-PPRP routinely files
//      "Recommended Conditions"/"Revised Condition 9"-type testimony, and
//      applicants are REQUIRED to submit their decommissioning plan as part
//      of their own PRE-decision direct testimony package — both confirmed
//      live in cases that were still mid-hearing with zero Orders of any
//      kind (e.g. Case 9860: "Direct Testimony, Decommissioning Plan and
//      Final Conceptual Site Plan" filed while still at the pre-hearing
//      stage; Case 9464: "DNR-PPRP | Revised Condition 9" filed BEFORE that
//      case's own Proposed/Final Order). A first pass using this signal
//      produced dozens of false "granted" positives across genuinely still-
//      pending cases (9860, 9826, 9815, 9799, and others) before this was
//      caught and the signal was dropped entirely.
//   3. WHAT ACTUALLY WORKS: any "Order"/"Final Order"-titled document filed
//      by "The Commission" or "Public Utility Law Judge Division" counts as
//      case-ending UNLESS its own subject matches a short, hand-built list
//      of confirmed-procedural phrasings (procedural schedule, special
//      admission, intervention/intervenor status, stay of proceedings, show
//      cause, motion-to-dismiss denial — Case 9773, the large, contested,
//      still-pending "Maryland Piedmont Reliability Project" transmission
//      case, was the real source for several of these, e.g. its own real
//      "Order No. 92178 Denying Motion to Dismiss" is procedural, not
//      dispositive, and correctly must NOT count as a grant). This
//      allow-vs-exclude-list approach was necessary because real dispositive
//      orders use surprisingly varied phrasing, ALL independently confirmed
//      live: "Order No. 88644." (bare), "Order No. 91166 Final Order",
//      "Final Order No. 88646" (reversed word order — a distinct real
//      pattern, not a typo), "Order No. 90200 Affirming and Adopting
//      Proposed Order", "Order No. 90950 on Final Order", "Order No. 91167
//      on Appeal ... Granting Certificate of Public Convenience and
//      Necessity", and "Order No. 92278 Denying [County]'s Appeal of the
//      Public Utility Law Judge's Proposed Order" (confirmed live in Case
//      9483/9736: when a Proposed Order is appealed and the Commission
//      denies that appeal, the Proposed Order simply stands as final and NO
//      separate "Final Order" document is ever filed — the denial-of-appeal
//      order IS the final word. Every real instance of this pattern in the
//      full 175-case dataset denies an appeal of a GRANT, since no Proposed
//      Order in this dataset ever recommended denial — DENY_APPLICATION_RE
//      and this appeal-denial signal are therefore both under-confirmed for
//      an actual denial, same documented gap as azAccLineSiting.ts/
//      nvPucnDockets.ts: no real CPCN denial exists anywhere in Maryland's
//      current docket population to calibrate against).
//   4. Two narrow corroborating signals, added after full-dataset testing
//      surfaced two further real edge cases and independently confirmed
//      safe against all 175 cases: (a) a request/grant of a "construction
//      [and operational] deadline" extension only makes sense once a CPCN
//      already exists (the deadlines are the certificate's own license
//      conditions) — added specifically to catch Case 9495's blank-subject
//      order, and verified that all 13 real cases using this phrase
//      independently also have a real Order document, so it never fires on
//      its own; (b) "The Commission" (only) "approving"/"accepting" a
//      decommissioning plan — narrower than the dropped bare-"decommission"
//      signal from attempt #2 above (that one matched pre-decision
//      testimony too; this one requires the Commission itself to be the
//      filer using "approving"/"accepting", an administrative act that is
//      definitionally post-grant).
//   Real "withdrawn" applications are separately, reliably detected —
//   "Withdrawal and Entry of Appearance" (an attorney's own appearance,
//   extremely common, confirmed to NOT mean the application itself was
//   withdrawn) had to be explicitly excluded from a first-pass regex that
//   was catching it as a false positive on ~60 cases; the real signal is
//   "withdraw[s/al/ing] ... application" (also matches the one real case
//   that phrases it slightly irregularly, "Withdrawal its Pending
//   Application").
//   Final calibration result across all 175 real cases: 78 granted, 16
//   withdrawn, 81 still pending, 0 denied (see #3 above for why) — zero
//   unexplained "pending" cases remained older than 18 months after this
//   calibration (every one still open that long is independently confirmed
//   still genuinely active: e.g. Case 9773, MPRP, has real ongoing
//   dismissal-motion litigation; Case 9694 is a same-project refiling after
//   an earlier withdrawal, itself still in active hearings).
//
// FUEL/PROJECT TYPE & CAPACITY: not structured fields, extracted from the
// caption text (same approach/caveats as every keyword-based source in this
// series). Confirmed by hand: 151/175 real captions are solar ("SOLAR" or
// "PHOTOVOLTAIC"), 1 is a solar+storage+transmission hybrid (kept as solar
// generation, matching this series' established "don't misclassify a
// paired-battery generation project as pure storage" rule from
// nyDpsDockets.ts), and the 23 non-solar captions are a mix of explicit
// transmission-line projects (rebuild/construct a numbered "kV"/"Kilovolt"
// line) and existing "Generating Station" modification filings (fuel type
// not determinable from the caption text alone, kept as "other"). One real
// false-positive found and fixed: naively matching bare "wind" would have
// misfired on BGE's "Five Forks to Windy Edge Transmission Line Reliability
// Project" (Case 9658, a real place name, not wind generation) — fixed with
// a `\bwind\b` word boundary, which correctly does not match "Windy".
// "Gas" is NOT used as a fuel keyword at all: every one of the 8 real
// captions containing that substring is just "Baltimore Gas and Electric
// Company" (the utility's own name), not gas-fired generation.
//
// Wired to Vercel Cron weekly (see vercel.json and
// src/app/api/cron/ingest-md-psc/route.ts). Real full-dataset timing
// measured 2026-08-23: fetching the list once plus a detail postback for
// all 175 real cases (the entire current population) at this series'
// standard 250ms politeness delay took 105.6s — comfortably inside the
// 300s cron budget, with no need to trim MAX_CANDIDATES for time-budget
// reasons the way nyDpsDockets.ts had to.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, selectWithRotation, type NormalizedProject } from "@/lib/ingest/common";

const BASE_URL = "https://webpscxb.pscmaryland.com/DMS";

// The full current population (175 real cases as of 2026-08-23) comfortably
// fits within the cron time budget (see header) with room to grow for years
// of future filings at Maryland's observed CPCN filing pace (~1-2/week)
// before this would need lowering.
export const MAX_CANDIDATES = 220;
// See selectWithRotation in common.ts: the newest ROTATING_RECENT_SLOTS
// candidates are checked every run; the rest of the budget rotates
// through anything beyond that so a source whose real population exceeds
// MAX_CANDIDATES eventually revisits everything instead of permanently
// freezing whatever falls outside a plain top-N-by-recency window.
const ROTATING_RECENT_SLOTS = Math.round(MAX_CANDIDATES * (2 / 3));
const REQUEST_DELAY_MS = 250;
// The oldest real still-open case found live is Case 9773 (filed December
// 2024); every case older than that is either granted or withdrawn (see
// header STATUS calibration). A generous multi-year lookback is kept anyway
// as a safety margin against a genuinely long-stalled outlier, matching
// this series' convention (see nvPucnDockets.ts) — not because Maryland
// needs it today.
const LOOKBACK_YEARS = 10;

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
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractHidden(html: string, id: string): string {
  const re = new RegExp(`name="${id}"[^>]*value="([^"]*)"`);
  const m = re.exec(html);
  return m ? m[1] : "";
}

interface CpcnListRow {
  index: number;
  caseNum: string;
  filedDate: Date | null;
  caption: string;
}

interface CpcnListPage {
  rows: CpcnListRow[];
  viewState: string;
  viewStateGenerator: string;
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Real observed format: "August 17, 2026".
function parseLongDate(raw: string): Date | null {
  const m = /^(\w+)\s+(\d{1,2}),\s*(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  const d = new Date(Number(m[3]), month, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Matches each case-row block on the list page: the case number link (whose
// id embeds the 0-based row index used for the detail postback below), the
// "Date Filed" <i> text, then the case-caption div. Confirmed live
// 2026-08-23 against all 175 real rows on GET /DMS/cpcnapplication.
const ROW_RE =
  /lnkbtnCaseNum_(\d+)"[^>]*>([^<]+)<\/a>[\s\S]{0,300}?<i>([^<]+)<\/i>[\s\S]{0,600}?class="case-caption"[^>]*>([\s\S]*?)<\/div>/g;

async function fetchCpcnList(): Promise<CpcnListPage> {
  const res = await fetch(`${BASE_URL}/cpcnapplication`);
  if (!res.ok) throw new Error(`MD PSC CPCN list request failed (${res.status})`);
  const html = await res.text();

  const viewState = extractHidden(html, "__VIEWSTATE");
  if (!viewState) {
    throw new Error(
      "MD PSC CPCN list response didn't contain __VIEWSTATE — the page structure likely changed. Check fetchCpcnList in src/lib/ingest/mdPscDockets.ts against a fresh response.",
    );
  }
  const viewStateGenerator = extractHidden(html, "__VIEWSTATEGENERATOR");

  const rows: CpcnListRow[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    rows.push({
      index: Number(m[1]),
      caseNum: stripTags(m[2]),
      filedDate: parseLongDate(stripTags(m[3])),
      caption: stripTags(m[4]),
    });
  }
  if (rows.length === 0) {
    throw new Error(
      "MD PSC CPCN list returned zero parsed rows — the case-row markup likely changed. Check ROW_RE in src/lib/ingest/mdPscDockets.ts against a fresh response.",
    );
  }

  return { rows, viewState, viewStateGenerator };
}

interface MailLogDoc {
  filer: string;
  subject: string;
}

// Matches each mail-log table row on the case-detail postback response:
// filer name (in a <strong>) then the filing's subject/description text.
// Confirmed live 2026-08-23 against a full scan of all 175 real cases.
const DOC_RE = /<strong class=.color\d.>([^<]*)<\/strong>\s*-?\s*([^<]*)<\/td>/g;

async function fetchCaseDetail(list: CpcnListPage, rowIndex: number): Promise<MailLogDoc[]> {
  const ctl = String(rowIndex).padStart(2, "0");
  const target = `ctl00$ContentPlaceHolder1$RptCPCNApplicationList$ctl${ctl}$lnkbtnCaseNum`;
  const params = new URLSearchParams();
  params.set("__EVENTTARGET", target);
  params.set("__EVENTARGUMENT", "");
  params.set("__VIEWSTATE", list.viewState);
  params.set("__VIEWSTATEGENERATOR", list.viewStateGenerator);

  const res = await fetch(`${BASE_URL}/cpcnapplication`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`MD PSC case detail postback failed (${res.status}) for row ${rowIndex}`);
  const html = await res.text();

  const docs: MailLogDoc[] = [];
  for (const m of html.matchAll(DOC_RE)) {
    docs.push({ filer: stripTags(m[1]), subject: stripTags(m[2]) });
  }
  return docs;
}

// --- STATUS detection — see module header for how each of these was
// calibrated against a full scan of all 175 real cases, including the
// signals that were tried and dropped. ---

const FINAL_ORDER_FILER_RE = /^(?:the commission|public utility law judge division)$/i;

function stripCaseTrailer(subject: string): string {
  return subject
    .replace(/\(?(?:public and confidential|confidential)\)?\s*$/i, "")
    .replace(/\(ml\s*\d+\)\s*$/i, "")
    .replace(/case\s+nos?\.?\s*[\d\s,&.and]*$/i, "")
    .trim()
    .replace(/[.,]+$/, "")
    .trim();
}

// Matches ANY "Order"/"Final Order"-titled filing (real dispositive orders
// use too many distinct phrasings to allow-list — see header #3); paired
// with PROCEDURAL_ORDER_EXCLUDE_RE below to filter out the real procedural
// orders that also happen to start with "Order".
const ORDER_PREFIX_RE = /^(?:final\s+)?order\b/i;
const PROCEDURAL_ORDER_EXCLUDE_RE =
  /procedural schedule|special admission|regarding intervention|granting intervenor|interested person status|regarding future schedule|establishing a procedural schedule|denying motion to dismiss|stay of proceedings|to stay proceedings|show cause|protective order|confidentiality/i;

const FINAL_PROPOSED_ORDER_RE = /\bfinal\s+proposed\s+order\b/i;

// See header #3: an appeal of a Proposed Order being denied means the
// Proposed Order stands as final with no separate "Final Order" document
// ever filed. Under-confirmed for an actual denial (see header) — every
// real instance denies an appeal of a grant.
const APPEAL_DENIED_RE = /\bden(?:y|ies|ied|ying|ial)\b.{0,20}\bappeal\b/i;

// Corroborating signals — see header #4.
const DEADLINE_EXTENSION_RE = /\bconstruction\s+(?:and\s+operational\s+)?deadlines?\b|\boperational\s+deadline\b/i;
const COMMISSION_DECOMMISSION_APPROVAL_RE = /\b(?:approv(?:ing|ed|es)|accept(?:ing|ed|s))\b.{0,15}decommissioning/i;

// Real applications open "Withdraw[al/s/ing] ... [of/the/its] [pending]
// Application" — confirmed against every real withdrawal in the dataset,
// including the one irregular real phrasing ("Withdrawal its Pending
// Application"). Deliberately does NOT match the ~60 real "Withdrawal and
// Entry of Appearance" filings (an attorney's own appearance, unrelated to
// the case itself) that a first-pass looser regex incorrectly matched.
const WITHDRAW_APPLICATION_RE = /\bwithdraw\w*\s+(?:of\s+)?(?:the\s+|its\s+)?(?:pending\s+)?application\b/i;

// Under-confirmed (see header #3): no real CPCN denial exists anywhere in
// the current docket population to calibrate against.
const DENY_APPLICATION_RE =
  /\bden(?:y|ies|ied|ying|ial)\b(?:\s+the)?\s+(?:cpcn\s+)?application\b|\bden(?:y|ies|ied|ying|ial)\b.{0,15}\bcertificate\b/i;

type Resolution = "granted" | "denied" | "withdrawn" | null;

function determineResolution(docs: MailLogDoc[]): Resolution {
  for (const d of docs) {
    if (WITHDRAW_APPLICATION_RE.test(d.subject)) return "withdrawn";
  }
  for (const d of docs) {
    if (FINAL_ORDER_FILER_RE.test(d.filer) && DENY_APPLICATION_RE.test(d.subject)) return "denied";
  }
  for (const d of docs) {
    const stripped = stripCaseTrailer(d.subject);
    if (
      FINAL_ORDER_FILER_RE.test(d.filer) &&
      ORDER_PREFIX_RE.test(stripped) &&
      !PROCEDURAL_ORDER_EXCLUDE_RE.test(stripped)
    ) {
      return "granted";
    }
    if (FINAL_PROPOSED_ORDER_RE.test(d.subject)) return "granted";
    if (FINAL_ORDER_FILER_RE.test(d.filer) && APPEAL_DENIED_RE.test(d.subject)) return "granted";
    if (DEADLINE_EXTENSION_RE.test(d.subject)) return "granted";
    if (FINAL_ORDER_FILER_RE.test(d.filer) && COMMISSION_DECOMMISSION_APPROVAL_RE.test(d.subject)) return "granted";
  }
  return null;
}

// --- Fuel/project type, capacity, county, applicant extraction ---

const SOLAR_RE = /\bsolar\b|\bphotovoltaic\b/i;
const WIND_RE = /\bwind\b/i; // word boundary deliberately excludes "Windy" (see header)
const GENERATING_STATION_RE = /\bgenerating station\b/i;
const STORAGE_RE = /\bbattery\b|\bbess\b|\benergy storage\b/i;

function inferProjectTypeAndFuel(caption: string): { projectType: ProjectType; fuelType: FuelType } {
  if (SOLAR_RE.test(caption)) return { projectType: "generation", fuelType: "solar" };
  if (WIND_RE.test(caption)) return { projectType: "generation", fuelType: "wind_onshore" };
  if (GENERATING_STATION_RE.test(caption)) return { projectType: "generation", fuelType: "other" };
  if (STORAGE_RE.test(caption)) return { projectType: "storage", fuelType: "storage" };
  // Residual bucket: every real non-solar, non-"Generating Station" caption
  // in the dataset is an explicit T&D utility (BGE/Pepco/Potomac Edison/
  // Delmarva Power) transmission-line/circuit/substation project — see
  // header FUEL/PROJECT TYPE.
  return { projectType: "transmission", fuelType: "transmission" };
}

function extractCapacityMw(caption: string): number | null {
  const m = /([\d,]+(?:\.\d+)?)\s*MW/i.exec(caption);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Maryland's 23 counties (Baltimore City is an independent city, not a
// county, and never appears in a CPCN caption's "... COUNTY" phrase, so it's
// deliberately excluded here). A free-form "capitalized words before COUNTY"
// regex was tried first and found to be a real bug: since these captions are
// themselves ALL CAPS, it greedily swept in preceding caption text too (e.g.
// captured "SUBSTATION IN MONTGOMERY" instead of "Montgomery" for Case 9883,
// confirmed via a live DB check after the first ingestion run). A whitelist
// of real county names, several of which are themselves multi-word
// ("Queen Anne's", "St. Mary's", "Anne Arundel"), avoids that entirely.
// Case 9782's own real caption misspells its county as "DORCESTER COUNTY"
// (one character short of "Dorchester", confirmed live, not a transcription
// error here) — matched via an optional-"h" pattern rather than silently
// "corrected" in the stored caption text.
const MD_COUNTY_PATTERNS: { canonical: string; pattern: string }[] = [
  { canonical: "Allegany", pattern: "Allegany" },
  { canonical: "Anne Arundel", pattern: "Anne\\s+Arundel" },
  { canonical: "Baltimore", pattern: "Baltimore" },
  { canonical: "Calvert", pattern: "Calvert" },
  { canonical: "Caroline", pattern: "Caroline" },
  { canonical: "Carroll", pattern: "Carroll" },
  { canonical: "Cecil", pattern: "Cecil" },
  { canonical: "Charles", pattern: "Charles" },
  { canonical: "Dorchester", pattern: "Dorch?ester" },
  { canonical: "Frederick", pattern: "Frederick" },
  { canonical: "Garrett", pattern: "Garrett" },
  { canonical: "Harford", pattern: "Harford" },
  { canonical: "Howard", pattern: "Howard" },
  { canonical: "Kent", pattern: "Kent" },
  { canonical: "Montgomery", pattern: "Montgomery" },
  { canonical: "Prince George's", pattern: "Prince\\s+George['’]s" },
  { canonical: "Queen Anne's", pattern: "Queen\\s+Anne['’]s" },
  { canonical: "St. Mary's", pattern: "St\\.?\\s+Mary['’]s" },
  { canonical: "Somerset", pattern: "Somerset" },
  { canonical: "Talbot", pattern: "Talbot" },
  { canonical: "Washington", pattern: "Washington" },
  { canonical: "Wicomico", pattern: "Wicomico" },
  { canonical: "Worcester", pattern: "Worcester" },
];

function normalizeCountyKey(s: string): string {
  return s.toLowerCase().replace(/[.’']/g, "").replace(/\s+/g, " ").trim();
}

const COUNTY_CANONICAL_BY_KEY = new Map<string, string>(
  MD_COUNTY_PATTERNS.map(({ canonical }) => [normalizeCountyKey(canonical), canonical]),
);

function canonicalCounty(raw: string): string {
  return COUNTY_CANONICAL_BY_KEY.get(normalizeCountyKey(raw)) ?? raw;
}

const COUNTY_NAME_ALT = MD_COUNTY_PATTERNS.map((p) => p.pattern).join("|");
// Handles single-county ("... IN CECIL COUNTY, MARYLAND") and the real
// two-county case ("... IN PORTIONS OF ALLEGANY AND GARRETT COUNTIES,
// MARYLAND", Case 9857) without requiring the "IN"/"PORTIONS OF" prefix,
// since two real captions (9869, 9874) omit "IN" entirely before the county
// name.
const COUNTY_RE = new RegExp(
  `\\b(${COUNTY_NAME_ALT})(?:\\s+AND\\s+(${COUNTY_NAME_ALT}))?\\s+COUNT(?:Y|IES)\\b`,
  "i",
);

function extractCounty(caption: string): string | null {
  const m = COUNTY_RE.exec(caption);
  if (!m) return null;
  const first = canonicalCounty(m[1]);
  return m[2] ? `${first} and ${canonicalCounty(m[2])}` : first;
}

// Real captions use two patterns: possessive ("[Name]'s Application for a
// Certificate...") and formal ("APPLICATION OF [Name] FOR A
// CERTIFICATE..."), each seen in both Title Case and ALL CAPS. Confirmed
// against all 175 real captions by hand.
const APPLICANT_POSSESSIVE_RE = /^(.+?)[’']s\s+APPLICATION\s+FOR\s+(?:A|THE)\s+CERTIFICATE/i;
const APPLICANT_OF_RE = /\bAPPLICATION\s+OF\s+(.+?)\s+FOR\s+(?:A|THE)\s+CERTIFICATE/i;

function extractApplicant(caption: string): string {
  const m1 = APPLICANT_POSSESSIVE_RE.exec(caption);
  if (m1) return m1[1].trim().replace(/^(?:IN THE MATTER OF )?(?:THE )?/i, "").trim();
  const m2 = APPLICANT_OF_RE.exec(caption);
  if (m2) return m2[1].trim();
  return caption.slice(0, 80);
}

function normalizeCase(row: CpcnListRow, resolution: Resolution): NormalizedProject {
  const matchKey = resolveMatchKey("md-psc", row.caseNum);
  const { projectType, fuelType } = inferProjectTypeAndFuel(row.caption);
  const capacityMw = extractCapacityMw(row.caption);
  const county = extractCounty(row.caption);
  const applicant = extractApplicant(row.caption);

  let currentStage: ProjectStage;
  if (resolution === "granted") currentStage = "approved_awaiting_construction";
  else if (resolution === "denied" || resolution === "withdrawn") currentStage = "cancelled";
  else currentStage = "local_review";

  const causeSlugs: CauseSlug[] = ["local_state_opposition"];

  const dataQualityNoteParts: string[] = [
    "Sourced from the Maryland Public Service Commission's public Document and Matter Management system (Certificate of Public Convenience and Necessity applications).",
    "This system does not publish a case \"Status\" field at all; \"still waiting\" here is inferred from scanning every publicly filed document in the case for a dispositive Commission/Public Utility Law Judge order — see the ingestion module header for how this was calibrated, including several real phrasing variants and two confirmed-safe corroborating signals.",
  ];
  if (capacityMw != null) {
    dataQualityNoteParts.push("Capacity figure is parsed from the docket caption text, not a structured field — not independently verified.");
  }
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket caption text.");
  }
  if (county) {
    const countyWord = county.includes(" and ") ? "Counties" : "County";
    dataQualityNoteParts.push(`Located in ${county} ${countyWord}, Maryland, per the docket caption — no structured coordinates are published, so this project will not appear on the map until geocoded another way.`);
  } else {
    dataQualityNoteParts.push("No structured location field is published; this project will not appear on the map until geocoded another way.");
  }

  return {
    matchKey,
    name: `${applicant} (MD PSC Case No. ${row.caseNum})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "MD",
    county,
    capacityValue: capacityMw,
    capacityUnit: capacityMw != null ? "MW" : null,
    applicationFiledDate: row.filedDate,
    dateConfidence: "exact",
    currentStatus: `Maryland PSC Case No. ${row.caseNum}: ${resolution ?? "active"}`,
    currentStage,
    causeSlugs,
    causeDetail: `Waiting on a Certificate of Public Convenience and Necessity from the Maryland Public Service Commission — Case No. ${row.caseNum}, "${row.caption}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `MD PSC Case No. ${row.caseNum}`,
        url: `${BASE_URL}/case/${row.caseNum}`,
      },
    ],
    externalIds: { mdPsc: row.caseNum },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  realApplicationCandidates: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestMdPscDockets(maxCandidates = MAX_CANDIDATES): Promise<IngestSummary> {
  const list = await fetchCpcnList();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - LOOKBACK_YEARS);

  const candidates = selectWithRotation(
    list.rows
      .filter((r) => r.filedDate == null || r.filedDate >= cutoff)
      .sort((a, b) => (b.filedDate?.getTime() ?? 0) - (a.filedDate?.getTime() ?? 0)),
    maxCandidates,
    ROTATING_RECENT_SLOTS,
  );

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];

  for (const row of candidates) {
    try {
      const docs = await fetchCaseDetail(list, row.index);
      const resolution = determineResolution(docs);
      toUpsert.push(normalizeCase(row, resolution));
    } catch (err) {
      errors.push({ matchKey: row.caseNum, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // See markVanished's wasCapped doc in common.ts: once this cap actually
  // truncates the candidate list, it's no longer the source's full active
  // list, so vanished-detection must be skipped rather than flooding the
  // feed with false "no longer reported" flags.
  const wasCapped = candidates.length >= maxCandidates;
  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { wasCapped });

  return {
    candidatesFound: list.rows.length,
    realApplicationCandidates: candidates.length,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestMdPscDockets()
    .then((summary) => {
      console.log(
        `Maryland PSC CPCN docket ingestion complete: ${summary.candidatesFound} candidates found, ` +
          `${summary.realApplicationCandidates} within lookback, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
