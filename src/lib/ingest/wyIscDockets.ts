// Wyoming Industrial Siting Council (ISC) permit dockets — one of several
// states built in parallel in the per-state series started with
// vaSccDockets.ts (see that file's header for the overall rationale).
// Confirmed by hand 2026-08-25 — every claim below was independently
// verified via real requests before writing this module.
//
// FETCHING: WY DEQ's own "Applications and Permits" page
// (deq.wyoming.gov/industrial-siting-2/permitting/) embeds its real docket
// archive via a third-party WordPress plugin ("Use Your Drive") pointed at
// a public Google Drive folder. Confirmed live in a real browser: the
// embedded widget itself is broken site-wide — its AJAX call returns
// `{"...":"Folder is not received"}` for both the "Active Permits" and
// "Applications and Permits" tabs, stuck on "Loading..." forever — but the
// page's own "If the download box is not working below, please click
// here" fallback link exposes the real public folder directly:
// https://drive.google.com/drive/folders/1qTJr8dLMvaG0XDMWAZnorAvugnT4ztrR
//
// Google Drive's modern web UI is a WASM-driven SPA with no stable public
// JSON listing reachable without an OAuth token or a Cloud API key — but
// Drive still serves a legacy, unauthenticated, plain server-rendered-HTML
// listing of any "anyone with the link" folder via
// `https://drive.google.com/embeddedfolderview?id=<folderId>#list` (the
// same endpoint many "embed a Drive folder in my website" WordPress
// plugins rely on internally). Confirmed working and complete: the root
// folder's real 87 entries all came back in one response, no pagination
// observed at this size.
//
// STRUCTURE: one subfolder per docket under the root folder id above,
// named roughly "<docket year>-<sequence> <Project Name>", with real,
// messy historical inconsistency — a handful of entries carry a *second*,
// unrelated leading year (e.g. "2024     22-11 Dutchman Renewable Power
// Project"), apparently added when the folder was reorganized in
// 2024-2026 while its real original docket number ("22-11") stayed in the
// name. Confirmed this doesn't collide with real docket-number parsing:
// the stray leading year is never dash-joined to the real docket digits
// the way a real docket number is, so DOCKET_RE below (matching only a
// dash-joined `\d{2,4}-\d{1,2}` pair) correctly extracts "22-11" and
// ignores the leading "2024" every time it was checked by hand. Two loose
// top-level PDFs (non-folder entries, e.g. "Dry Creek Amend Approval.pdf")
// exist alongside the 85 real project subfolders — skipped, not modeled
// as their own projects (their content duplicates a document that already
// lives inside the matching project's own subfolder).
//
// IDENTITY: matchKey is built from each subfolder's own real, stable
// Google Drive folder ID (via resolveMatchKey), not the parsed docket
// number — DOCKET_RE has a known real gap (see SCOPING below) and isn't
// reliable enough on its own to be an identity key, while the Drive folder
// ID always is.
//
// STATUS (confirmed against real cases spanning both eras of this
// source): each project subfolder holds its own real filed documents;
// there is no separate structured status field anywhere in this source.
// A subfolder with no grant-document filename is still pending —
// confirmed on "2026 25-05 Cheyenne Prairie Generating Station Expansion
// Project" (filed Jul 2026), which contains only its original application
// PDF. A subfolder whose filenames include a grant document is resolved —
// confirmed on "2023-03 Cowboy Solar" ("23-03 Findings of Fact,
// Conclusions of Law, and Order.pdf" plus later "Order Amending..."
// post-grant construction-schedule/capacity documents) and, in a real,
// confirmed SECOND naming convention this source uses for older dockets,
// "1980-04 Wyodak Unit 2" ("...Wyodak Unit 2...Permit-80-04.pdf") and
// "2018-01 TB Flats Wind Energy Project" ("...Permit_TB Flats Wind Energy
// LLC_18-01.pdf") — an initial version of this module that only matched
// "Order" wrongly left every pre-2020s-era grant (including obviously
// long-since-built plants like "Jim Bridger Unit 4" from 1975) showing as
// still pending; caught and fixed via a live DB check comparing this
// module's output against real known-operating projects before shipping.
// One further real spelling quirk confirmed in the source itself:
// "1992-01 Neil Simpson Unit 2"'s own grant document is titled "...Pemit
// Conditions-92-01.pdf" (source's own typo, missing the first "r") —
// GRANT_RE's `per?mit` deliberately tolerates this exact real misspelling
// rather than requiring "permit" spelled correctly. A real THIRD grant
// signal was also confirmed: "2023-04 Settler Wind" has no "Order" or
// "Permit" document at all, only "23-04 Amendment Approval.pdf" — an
// amendment can only be approved against an already-granted permit, so
// GRANT_RE also matches "Approv(al/ed/ing)" as its own independent grant
// signal. No real denial document was found among the candidates sampled
// by hand in either era, so DENY_RE below is calibrated from the
// grant/deny wording pattern alone, not confirmed against a real in-scope
// denial — the same caveat this series already carries for AZ/NC.
//
// SCOPING — real, principled gap, documented rather than hand-patched:
// WY's Industrial Siting Council permits any sufficiently large industrial
// facility, not just energy — soda ash/trona mining, cement, gold mining,
// phosphate fertilizer, ammonia, and gas-processing wellfields/plants all
// show up in the same folder alongside real generation/transmission/
// storage projects. This module includes only titles matching an energy
// generation/transmission/storage keyword (wind, solar, battery/BESS,
// transmission, "generating station"/"generating facility", "power
// station"/"power plant", "electricity generating", or a named "Unit N").
// Confirmed real gap: a handful of older (pre-2010), already long-resolved
// named coal plants (Laramie River Station, Dave Johnston Plant, Dry Fork
// Coal Plant, WyGen-II/III) use none of these patterns in their docket
// folder name and are missed by this module — acceptable since they're
// decades-old and already resolved either way (not a source of missed
// "still waiting" projects), but flagged here rather than silently
// claimed complete.
//
// FUEL/PROJECT TYPE, CAPACITY: not structured fields anywhere in this
// source — capacity in particular is never stated in a folder or document
// title (only inside the application PDFs themselves, which this module
// does not fetch/parse), so capacityValue is always null here, flagged in
// dataQualityNote like every other real gap in this series.
//
// COUNTY/COORDINATES: not published anywhere in this source either — every
// project here carries the same "not geocoded" dataQualityNote as several
// other modules in this series.
//
// NOT WIRED TO CRON YET, same as every other new per-state module before
// its first live-verified run. Politeness-delayed between per-candidate
// subfolder requests.

import type { CauseSlug } from "@/lib/data/causeCategories";
import type { FuelType, ProjectStage, ProjectType } from "@/lib/data/taxonomies";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";
import { upsertNormalizedProjects, type NormalizedProject } from "@/lib/ingest/common";

const ROOT_FOLDER_ID = "1qTJr8dLMvaG0XDMWAZnorAvugnT4ztrR"; // "Applications and Permits" — see FETCHING above
const REQUEST_DELAY_MS = 250;

function embedUrl(folderId: string): string {
  return `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFolderHtml(folderId: string): Promise<string> {
  const res = await fetch(embedUrl(folderId), {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`WY ISC Drive folder fetch failed (${res.status}): ${folderId}`);
  return res.text();
}

interface DriveEntry {
  id: string;
  title: string;
  isFolder: boolean;
}

// Splits on each entry's own opening div rather than one big regex over
// the whole document — confirmed more robust against the real HTML's
// irregular whitespace/attribute ordering than a single multi-group regex
// (an earlier attempt at one big regex matched zero real entries; see
// scPscDockets.ts for the same "split first" lesson learned on a
// different source).
export function parseFolderEntries(html: string): DriveEntry[] {
  const blocks = html.split('<div class="flip-entry" id="entry-').slice(1);
  const out: DriveEntry[] = [];
  for (const b of blocks) {
    const id = b.slice(0, b.indexOf('"'));
    const titleMatch = /flip-entry-title">([^<]*)</.exec(b);
    if (!id || !titleMatch) continue;
    const isFolder = /folder-grid-shared-icon|folder-list-shared-icon/.test(b);
    out.push({ id, title: titleMatch[1].trim(), isFolder });
  }
  if (out.length === 0) {
    throw new Error(
      "WY ISC Drive folder listing returned zero entries — the embeddedfolderview page structure likely changed. Check parseFolderEntries in src/lib/ingest/wyIscDockets.ts against a fresh response.",
    );
  }
  return out;
}

// Real docket number, dash-joined only — see module header STRUCTURE for
// why this correctly ignores a stray leading reorganization-year some
// entries carry.
const DOCKET_RE = /\b(\d{2,4})-(\d{1,2})\b/;

function parseDocket(title: string): { docketNumber: string | null; name: string } {
  const m = DOCKET_RE.exec(title);
  if (!m) return { docketNumber: null, name: title.trim() };
  return { docketNumber: m[0], name: title.slice(m.index + m[0].length).trim() || title.trim() };
}

// See module header SCOPING for the real, documented gap this leaves.
const ENERGY_KEYWORDS_RE =
  /\bwind\b|\bsolar\b|\bwindfarm\b|\bwindpower\b|\b(battery|bess)\b|\btransmission\b|\b(generating station|generating facility|power station|power plant|electricity generating)\b|\bunit\s*[ivxlc\d]+\b/i;

function isEnergyRelevant(title: string): boolean {
  return ENERGY_KEYWORDS_RE.test(title);
}

function inferProjectType(title: string): ProjectType {
  if (/\btransmission\b/i.test(title)) return "transmission";
  if (/\b(battery|bess)\b/i.test(title)) return "storage";
  return "generation";
}

function inferFuelType(title: string, projectType: ProjectType): FuelType {
  if (projectType === "transmission") return "transmission";
  if (projectType === "storage") return "storage";
  if (/\bwind\b|\bwindfarm\b|\bwindpower\b/i.test(title)) return "wind_onshore";
  if (/\bsolar\b/i.test(title)) return "solar";
  return "other";
}

// See module header STATUS — two real, confirmed grant-document naming
// eras: "Order" (2020s-era dockets) and "Permit" / the source's own real
// "Pemit" typo (older dockets, `per?mit` tolerates both spellings).
// Deliberately no `\b` word boundary around order/permit: real filenames
// commonly sandwich the word between underscores on one or both sides
// (e.g. "ISD_Permit_PacifiCorp...pdf") — underscore counts as a `\w`
// character, so `\bpermit\b` silently fails to match "_Permit_" at all
// (no boundary exists between two word characters). Confirmed as a real
// bug via the same live-DB check noted above: it left "Seven Mile Hill
// Wind Farm" and "TB Flats Wind Energy Project" — both real, obviously
// already-built operating wind farms with real "..._Permit_..." documents
// on file — still showing as pending. A real denial's own wording isn't
// confirmed against any in-scope candidate — see the module header
// caveat.
const DENY_RE = /(order|per?mit|approv)[\s\S]{0,40}\bdeny(?:ing|ied)?\b/i;
const GRANT_RE = /order|per?mit|approv/i;

function resolveStage(docNames: string[]): ProjectStage {
  const joined = docNames.join(" | ");
  if (DENY_RE.test(joined)) return "cancelled";
  if (GRANT_RE.test(joined)) return "approved_awaiting_construction";
  return "local_review";
}

async function normalizeCandidate(entry: DriveEntry): Promise<NormalizedProject | null> {
  if (!isEnergyRelevant(entry.title)) return null;

  const subfolderHtml = await fetchFolderHtml(entry.id);
  const docs = parseFolderEntries(subfolderHtml);
  const currentStage = resolveStage(docs.map((d) => d.title));
  const { docketNumber, name } = parseDocket(entry.title);
  const projectType = inferProjectType(entry.title);
  const fuelType = inferFuelType(entry.title, projectType);
  const matchKey = resolveMatchKey("wy-isc", entry.id);

  const dataQualityNoteParts: string[] = [
    "Sourced from the Wyoming DEQ Industrial Siting Council's public docket archive (a Google Drive folder the agency's own website links to).",
    "No structured status field exists in this source; \"still waiting\" is inferred from whether the docket's own folder contains a document with \"Order\" in its filename — see the ingestion module header for how this was calibrated.",
    "Capacity is not stated anywhere in this source's folder or document titles and was not independently parsed from the underlying application PDFs, so no capacity figure is available for this project.",
    "No structured location field is published; this project will not appear on the map until geocoded another way.",
  ];
  if (fuelType === "other") {
    dataQualityNoteParts.push("Fuel/technology type could not be confidently determined from the docket folder name.");
  }

  return {
    matchKey,
    name: `${name || entry.title} (WY ISC Docket ${docketNumber ?? entry.title})`,
    projectType,
    fuelType,
    lat: null,
    lon: null,
    state: "WY",
    county: null,
    capacityValue: null,
    capacityUnit: null,
    applicationFiledDate: null,
    dateConfidence: "approximate",
    currentStatus: `Wyoming ISC docket ${docketNumber ?? entry.title}: ${currentStage === "local_review" ? "pending" : currentStage}`,
    currentStage,
    causeSlugs: ["local_state_opposition"] as CauseSlug[],
    causeDetail: `Waiting on a permit from the Wyoming Industrial Siting Council — Docket ${docketNumber ?? entry.title}, "${name || entry.title}"`,
    dataQualityNote: dataQualityNoteParts.join(" "),
    sources: [
      {
        label: `WY ISC Docket ${docketNumber ?? entry.title}`,
        url: `https://drive.google.com/drive/folders/${entry.id}`,
      },
    ],
    externalIds: { wyIsc: entry.id },
  };
}

export interface IngestSummary {
  candidatesFound: number;
  energyRelevant: number;
  upserted: number;
  removedResolved: number;
  errors: { matchKey: string; message: string }[];
}

export async function ingestWyIscDockets(): Promise<IngestSummary> {
  const rootHtml = await fetchFolderHtml(ROOT_FOLDER_ID);
  const allEntries = parseFolderEntries(rootHtml).filter((e) => e.isFolder);

  const toUpsert: NormalizedProject[] = [];
  const errors: { matchKey: string; message: string }[] = [];
  let energyRelevant = 0;

  for (const entry of allEntries) {
    if (!isEnergyRelevant(entry.title)) continue;
    energyRelevant += 1;
    try {
      const normalized = await normalizeCandidate(entry);
      if (normalized) toUpsert.push(normalized);
    } catch (err) {
      errors.push({ matchKey: entry.id, message: String(err) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const { upserted, removedResolved } = await upsertNormalizedProjects(toUpsert, { sourcePrefix: "wy-isc" });

  return {
    candidatesFound: allEntries.length,
    energyRelevant,
    upserted,
    removedResolved,
    errors,
  };
}

if (require.main === module) {
  ingestWyIscDockets()
    .then((summary) => {
      console.log(
        `Wyoming ISC docket ingestion complete: ${summary.candidatesFound} total folders, ` +
          `${summary.energyRelevant} energy-relevant, upserted ${summary.upserted}, ` +
          `removed ${summary.removedResolved} resolved, ${summary.errors.length} errors.`,
      );
      if (summary.errors.length > 0) console.error(summary.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
