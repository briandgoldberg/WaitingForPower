// Hand-researched docket data for states whose own docket systems can't be
// read automatically: North Carolina (every starw1.ncuc.gov page, including
// order PDFs, serves Cloudflare's JS challenge) and Iowa (efs.iowa.gov
// requires a signed-in session). See ingest/README.md, "Hand-researched
// states".
//
// Unlike every other source module, nothing here is fetched at run time.
// A weekly research pass (a scheduled Claude Code routine) re-checks each
// entry against the sources named below, updates this file, and bumps the
// VERIFIED_ON dates. Rules for that pass, so the site never guesses a stage:
//   - Only public pages the state itself publishes (or its official press
//     releases) count as a source. News coverage can point you at a docket
//     but can't establish its status.
//   - An entry is added only once a source shows it pending. When a source
//     later shows it granted, denied, withdrawn or dismissed, set its
//     `resolved` field (with the order title and where it was seen) rather
//     than deleting it — the cron then reports it resolved, which takes it
//     off the site the same way the live module would. An entry that's
//     been resolved for a while can be deleted.
//   - When two sources disagree (see NC_EXCLUDED below), leave the docket out
//     and record why, instead of picking one.

import type { FuelType, ProjectType } from "@/lib/data/taxonomies";
import type { NormalizedProject } from "@/lib/ingest/common";
import { resolveMatchKey } from "@/lib/ingest/manualOverrides";

// ---------------------------------------------------------------------------
// North Carolina
// ---------------------------------------------------------------------------
//
// SOURCE: www.ncuc.gov/Hearings/hearings.html — the Commission's own public
// hearings page, which is NOT behind Cloudflare (unlike starw1.ncuc.gov). It
// has three tables: "Select Proceedings with Hearings Scheduled", "Proceedings
// Awaiting Decision", and year-by-year "Major Proceedings With Final Orders
// Issued" archives. A generating-facility or transmission-line certificate
// docket listed in either of the first two tables, and absent from the final
// orders archives, is taken as pending.

export const NC_VERIFIED_ON = "2026-09-24";
export const NC_HEARINGS_URL = "https://www.ncuc.gov/Hearings/hearings.html";

interface NcHandResearchedDocket {
  docketNumber: string; // same format the live module keys on, e.g. "E-2 Sub 1369"
  applicant: string;
  caption: string; // exactly as the hearings page lists it
  projectType: ProjectType;
  fuelType: FuelType;
  capacityMw: number | null;
  county: string | null;
  reviewStep: "Hearing scheduled" | "Awaiting commission order";
  note?: string;
  // Set when a source shows a final outcome — see the rules at the top.
  resolved?: { outcome: "granted" | "denied" | "withdrawn"; evidence: string };
}

export const NC_HAND_RESEARCHED_DOCKETS: NcHandResearchedDocket[] = [
  {
    docketNumber: "EMP-127 Sub 0",
    applicant: "Merry Hill PV I, LLC",
    caption: "Application of Merry Hill PV I, LLC, for a Certificate of Public Convenience and Necessity to Construct a 110 MW Solar Facility in Bertie",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: 110,
    county: "Bertie",
    reviewStep: "Hearing scheduled",
    note: "The 9/24/2026 public witness hearing (Webex) was canceled; an expert witness hearing is scheduled for 10/12/2026 in the Dobbs Building, Raleigh.",
  },
  {
    docketNumber: "EMP-123 Sub 0",
    applicant: "Bethel NC Hwy 11 Solar, LLC",
    caption: "Application of Bethel NC Hwy 11 Solar, LLC, for a Certificate of Public Convenience and Necessity to Construct a 70 MW Solar Facility in Pitt County, North Carolina",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: 70,
    county: "Pitt",
    reviewStep: "Awaiting commission order",
  },
  {
    docketNumber: "E-2 Sub 1369",
    applicant: "Duke Energy Progress, LLC",
    caption: "Application of Duke Energy Progress, LLC, for a Certificate of Public Convenience and Necessity to Construct a 67 MW Solar Photovoltaic Electric Generating Facility in Wayne County, North Carolina",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: 67,
    county: "Wayne",
    reviewStep: "Awaiting commission order",
  },
  {
    docketNumber: "E-2 Sub 1395",
    applicant: "Duke Energy Progress, LLC",
    caption: "Application of Duke Energy Progress, LLC for a Certificate of Public Convenience and Necessity to Construct a 240 MW Natural Gas-Fueled Simple Cycle Combustion Turbine in Richmond County, North Carolina",
    projectType: "generation",
    fuelType: "gas",
    capacityMw: 240,
    county: "Richmond",
    reviewStep: "Awaiting commission order",
  },
  {
    docketNumber: "E-2 Sub 1366",
    applicant: "Duke Energy Progress, LLC",
    caption: "Application of Duke Energy Progress, LLC, for a Certificate of Public Convenience and Necessity to Construct a 44 MW Solar Photovoltaic Electric Generating Facility in Randolph County, North Carolina",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: 44,
    county: "Randolph",
    reviewStep: "Awaiting commission order",
  },
  // The hearings page lists E-2 Sub 1367, E-2 Sub 1368 and E-7 Sub 1324 in
  // one row covering three facilities. Only E-7 Sub 1324 maps unambiguously
  // (the only Duke Energy Carolinas docket, and the only DEC facility named).
  // Which of 1367/1368 is Wake and which is Duplin isn't stated, so those
  // two are listed without a county or capacity rather than guessed.
  {
    docketNumber: "E-7 Sub 1324",
    applicant: "Duke Energy Carolinas, LLC",
    caption: "Application of Duke Energy Carolinas, LLC, for a Certificate of Public Convenience and Necessity to Construct a 40 MW Solar Photovoltaic Electric Generating Facility in Lincoln County",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: 40,
    county: "Lincoln",
    reviewStep: "Awaiting commission order",
  },
  {
    docketNumber: "E-2 Sub 1367",
    applicant: "Duke Energy Progress, LLC",
    caption: "Applications of Duke Energy Progress, LLC, for a Certificate of Public Convenience and Necessity to Construct a 100 MW Solar Photovoltaic Electric Generating Facility in Wake County, and an 80 MW Solar Photovoltaic Electric Generating Facility in Duplin County",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: null,
    county: null,
    reviewStep: "Awaiting commission order",
    note: "Listed jointly with E-2 Sub 1368 (a 100 MW Wake County and an 80 MW Duplin County facility); the source doesn't say which docket is which facility.",
  },
  {
    docketNumber: "E-2 Sub 1368",
    applicant: "Duke Energy Progress, LLC",
    caption: "Applications of Duke Energy Progress, LLC, for a Certificate of Public Convenience and Necessity to Construct a 100 MW Solar Photovoltaic Electric Generating Facility in Wake County, and an 80 MW Solar Photovoltaic Electric Generating Facility in Duplin County",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: null,
    county: null,
    reviewStep: "Awaiting commission order",
    note: "Listed jointly with E-2 Sub 1367 (a 100 MW Wake County and an 80 MW Duplin County facility); the source doesn't say which docket is which facility.",
  },
  {
    docketNumber: "SP-63147 Sub 0",
    applicant: "Kerr Lake Solar, LLC",
    caption: "Application of Kerr Lake Solar, LLC, for a Certificate of Public Convenience and Necessity to Construct a 60-MW Solar Photovoltaic Generating Facility in Vance County, North Carolina",
    projectType: "generation",
    fuelType: "solar",
    capacityMw: 60,
    county: "Vance",
    reviewStep: "Awaiting commission order",
  },
  {
    docketNumber: "EC-32 Sub 96",
    applicant: "Piedmont Membership Corporation",
    caption: "Application of Piedmont Membership Corporation to Obtain a Certificate of Environmental Compatibility and Public Convenience and Necessity Under §§ 62-101 and 62-102 and Commission Rule R8-62",
    projectType: "transmission",
    fuelType: "transmission",
    capacityMw: null,
    county: null,
    reviewStep: "Awaiting commission order",
    note: "A transmission line certificate (G.S. 62-101/62-102, Rule R8-62); the hearings page gives no route, voltage or county.",
  },
  // Filed jointly by DEP (E-2 Sub 1349) and NCEMC (EC-67 Sub 57); keyed on
  // the DEP docket. A separate, earlier 1,360 MW Person County certificate
  // (E-2 Sub 1318 / EC-67 Sub 55) was granted in 2024 per the same page's
  // archive — this is a different docket.
  {
    docketNumber: "E-2 Sub 1349",
    applicant: "Duke Energy Progress, LLC and North Carolina Electric Membership Corporation",
    caption: "Joint Application of Duke Energy Progress, LLC, and North Carolina Electric Membership Corporation for a Certificate of Public Convenience and Necessity to Construct a 1,360 MW Natural Gas-Fueled Combined Cycle Electric Generating Facility in Person County, North Carolina",
    projectType: "generation",
    fuelType: "gas",
    capacityMw: 1360,
    county: "Person",
    reviewStep: "Awaiting commission order",
    note: "Joint application, also filed as Docket EC-67 Sub 57.",
  },
];

// Listed as awaiting decision on the hearings page, but that same page's
// final-orders archive shows the certificate already granted. Left out
// rather than guessed at (possibly a later proceeding in the same docket,
// such as an amendment or transfer, but the page doesn't say).
//   - EMP-117 Sub 0, Shawboro East Ridge Solar (150 MW, Currituck): archive
//     2024, "Order Granting Certificate of Public Convenience and Necessity
//     With Conditions".
//   - EMP-119 Sub 0/Sub 1, Macadamia Solar (484 MW, Washington): archive
//     2023, "Order Granting Certificates of Public Convenience and Necessity".
//   - EMP-110 Sub 0, Sumac Solar (Bertie; 80 MW in the awaiting table, 120
//     MW in the archive): archive 2023, "Order Granting Certificate of Public
//     Convenience and Necessity with Conditions".

export function ncHandResearchedProjects(): NormalizedProject[] {
  return NC_HAND_RESEARCHED_DOCKETS.map((d) => {
    if (d.resolved) {
      return {
        matchKey: resolveMatchKey("nc-ncuc", d.docketNumber),
        name: `${d.applicant} (NC NCUC Docket ${d.docketNumber})`,
        projectType: d.projectType,
        fuelType: d.fuelType,
        state: "NC",
        currentStatus: `North Carolina NCUC docket ${d.docketNumber}: ${d.resolved.outcome} (hand-checked ${NC_VERIFIED_ON})`,
        currentStage: d.resolved.outcome === "granted" ? "approved_awaiting_construction" : "cancelled",
        causeSlugs: ["local_state_opposition"],
        causeDetail: `Waiting on a certificate from the North Carolina Utilities Commission — Docket No. ${d.docketNumber}, "${d.caption}"`,
        dataQualityNote: `Hand-researched, not auto-updating. Resolved per ${d.resolved.evidence} (checked ${NC_VERIFIED_ON}).`,
        reviewStep: null,
        reviewStepAt: null,
        sources: [{ label: "NCUC hearings and pending proceedings", url: NC_HEARINGS_URL }],
        externalIds: { ncNcuc: d.docketNumber },
      };
    }
    const noteParts = [
      `Hand-researched, not auto-updating: North Carolina's docket portal (starw1.ncuc.gov) is behind a Cloudflare challenge this site doesn't bypass, so this docket's status comes from the Commission's own public hearings page, last checked ${NC_VERIFIED_ON}. It is listed there as ${d.reviewStep === "Hearing scheduled" ? "having a hearing scheduled" : "awaiting a Commission decision"}, and it does not appear in that page's final-orders archive.`,
    ];
    if (d.note) noteParts.push(d.note);
    if (d.capacityMw != null) noteParts.push("Capacity is taken from the proceeding's own title, not a structured field.");
    noteParts.push(
      d.county
        ? `Located in ${d.county} County, North Carolina, per the proceeding's title — no coordinates are published, so this project will not appear on the map until geocoded another way.`
        : "No location is published; this project will not appear on the map until geocoded another way.",
    );
    return {
      matchKey: resolveMatchKey("nc-ncuc", d.docketNumber),
      name: `${d.applicant} (NC NCUC Docket ${d.docketNumber})`,
      projectType: d.projectType,
      fuelType: d.fuelType,
      lat: null,
      lon: null,
      state: "NC",
      county: d.county,
      capacityValue: d.capacityMw,
      capacityUnit: d.capacityMw != null ? "MW" : null,
      applicant: d.applicant,
      currentStatus: `North Carolina NCUC docket ${d.docketNumber}: ${d.reviewStep === "Hearing scheduled" ? "hearing scheduled" : "awaiting decision"} (hand-checked ${NC_VERIFIED_ON})`,
      currentStage: "local_review",
      causeSlugs: ["local_state_opposition"],
      causeDetail: `Waiting on a certificate from the North Carolina Utilities Commission — Docket No. ${d.docketNumber}, "${d.caption}"`,
      dataQualityNote: noteParts.join(" "),
      reviewStep: d.reviewStep,
      reviewStepAt: null,
      sources: [{ label: "NCUC hearings and pending proceedings", url: NC_HEARINGS_URL }],
      externalIds: { ncNcuc: d.docketNumber },
    };
  });
}

// ---------------------------------------------------------------------------
// Iowa
// ---------------------------------------------------------------------------
//
// SOURCE: iuc.iowa.gov/hazardous-liquid-pipeline-requests — the Iowa
// Utilities Commission's public page on Summit Carbon's dockets. It sits
// outside the signed-in EFS and carries its own "Updated <date>" stamp.
// Cited on the ND PSC-sourced SCS Carbon Transport project (see
// ndPscDockets.ts, case PU-22-391).

export const IA_SUMMIT_SOURCE_URL = "https://iuc.iowa.gov/hazardous-liquid-pipeline-requests";
export const IA_SUMMIT_VERIFIED_ON = "2026-09-24"; // the page itself read "Updated September 15, 2026"

export const IA_SUMMIT_NOTE =
  "This same physical CO2 pipeline also has an Iowa Hazardous Liquid Pipeline permit, Iowa Utilities Commission Docket HLP-2021-0001. " +
  "Per the Commission's public status page (" +
  IA_SUMMIT_SOURCE_URL +
  `, hand-checked ${IA_SUMMIT_VERIFIED_ON}): the permit was issued August 28, 2024 but construction can't start until its conditions are met; ` +
  "a June 30, 2026 order on remand modified the out-of-state approval condition; the case is back in Polk County District Court, where parties have asked for a stay (no ruling yet); " +
  "and a June 2026 petition to amend the permit, dropping eight counties from the route, is pending. " +
  "Hand-researched weekly, not auto-updating: Iowa's own docket system requires a signed-in session (see README.md).";
