// Hand-curated "Dirtiest Projects" list for the blog post at
// /blog/dirtiest-projects — see DirtiestProjects.tsx. This project's schema
// has no emissions/CO2 field (see taxonomies.ts's ZERO_CARBON_FUELS
// comment: capacity is already used elsewhere as an honest, stated proxy,
// never a real emissions estimate), so this list is built the same way:
// screened algorithmically by capacity among the only fossil-fuel-adjacent
// FuelTypes this tracker has (gas, lng, pipeline), restricted to projects
// past the earliest "interconnection_study" stage (no real permitting
// docket exists yet at that stage, so there's nothing concrete for a
// visitor to act on), then individually verified by hand — same "confirmed
// live, not guessed" discipline as every ingestion module in
// src/lib/ingest/. A project drops off this list if it's cancelled,
// completed, or turns out to be a stale/duplicate listing; re-verify
// periodically rather than trusting the screen forever.
//
// No LNG terminal currently qualifies: every fuelType="lng" project in the
// live dataset is already cancelled or completed (checked 2026-09-24) and
// none carry a capacityValue, so LNG is absent from this list by real
// data, not by oversight — added back the moment a real pending one
// appears with a capacity figure.
//
// Individually verified 2026-09-24 (real web search per candidate, not just
// the capacity screen) — see each blurb for what was actually confirmed.
// Three algorithmic candidates were dropped after verification, not because
// they weren't large, but because they turned out not to be real pending
// projects: Venture Global's Delta Express Pipeline was withdrawn from FERC
// pre-filing in June 2025; DeLa Express was suspended and reconfigured as a
// Texas-only intrastate project after landowner opposition; and Targa's
// Apex pipeline has no final investment decision yet and may be intrastate
// (Texas Railroad Commission, not FERC) rather than the interstate pipeline
// it was screened as. Two co-located gas plants (Sandow Lakes, Lincoln
// Land) are each built as two separate generating units with their own
// docket rows in this tracker — listed once here, at one representative
// unit's slug, with the real combined capacity noted in the blurb, rather
// than shown twice for what's one physical project.

export type DirtiestCategory = "gas_generation" | "pipeline";

export interface DirtiestProjectEntry {
  slug: string;
  category: DirtiestCategory;
  // One or two sentences of real, cited context — what it is and, when
  // documented, why it's opposed. Never invented; a project with nothing
  // beyond "large gas plant/pipeline" says so plainly instead.
  blurb: string;
}

export const DIRTIEST_PROJECTS: DirtiestProjectEntry[] = [
  {
    slug: "indiana-michigan-power-company-in-iurc-cause-no-46443-46443",
    category: "gas_generation",
    blurb:
      "A 1,520 MW gas plant proposed for I&M's Rockport site to replace retiring coal units. Citizens Action Coalition has formally objected, arguing it's part of a data-center-driven gas buildout that would emit more climate pollution than five Indiana coal plants combined.",
  },
  {
    slug: "monongahela-power-company-and-the-potomac-edison-company-wv-psc-case-26-0108-e-cn-8ECN",
    category: "gas_generation",
    blurb:
      "A ~$2.48B, 1,200 MW gas plant proposed for the existing Fort Martin coal site, paired with 70 MW of solar. At a July 2026 PSC hearing, all 32 public commenters — including coal miners — spoke against it, arguing it doesn't serve ratepayers.",
  },
  {
    slug: "sycamore-riverside-energy-llc-unit-syrvs-SYRVS",
    category: "gas_generation",
    blurb:
      "Invenergy's third gas plant proposed for Sullivan County, Indiana, sited next to a retired coal plant AEP is separately seeking approval to acquire. No documented community controversy beyond routine public hearings — included here for scale, not for a distinctive fight.",
  },
  {
    slug: "duke-energy-indiana-llc-in-iurc-cause-no-46193-46193",
    category: "gas_generation",
    blurb:
      "The Cayuga Generating Station expansion — two combined-cycle units at roughly 738 MW each (~1,476 MW combined), approved by the IURC in October 2025 and now contested. Citizens Action Coalition projects bills could rise $29/month by 2031 while Duke earns an estimated $550M in profit from the units.",
  },
  {
    slug: "jea-fl-siting-case-pa81-13a2-113A2",
    category: "gas_generation",
    blurb:
      "A ~$1.6B, 706 MW gas unit approved in August 2026 for JEA's old St. Johns River Power Park site. St. Johns Riverkeeper and the Sierra Club opposed it, citing JEA's continued coal reliance and the site's river and climate impacts.",
  },
  {
    slug: "sandow-lakes-energy-station-unit-sles1-SLES1",
    category: "gas_generation",
    blurb:
      "Two combined-cycle units (SLES1 + SLES2) totaling roughly 1,200 MW near Blue, Texas; site clearing was reportedly underway as of this check. A local group, \"Move the Gas Plant,\" challenged the state air permit over ammonia and soot emissions; Texas regulators denied the challenge and issued the permit in 2024.",
  },
  {
    slug: "lincoln-land-energy-center-unit-gen1-2GEN1",
    category: "gas_generation",
    blurb:
      "Two hydrogen-capable gas units (GEN1 + GEN2) near Pawnee in Sangamon County, Illinois, with a state construction permit already issued and combined capacity estimated at roughly 1,100–1,200 MW depending on the source. No documented community-controversy campaign found beyond routine public review.",
  },
  {
    slug: "nexus-fulcrum-llc-nv-pucn-docket-26-06016-06016",
    category: "gas_generation",
    blurb:
      "A 510 MW gas plant proposed at the former Sierra BioFuels site in the Tahoe-Reno Industrial Center. It's one of several private, \"behind-the-meter\" gas plants proposed at the same industrial park that drew two hours of public opposition in September 2026 over concerns they sidestep Nevada's renewable energy law.",
  },
  {
    slug: "ccpl-expansion-project-corpus-christi-stage-iv-cheniere-corpus-christi-pipeline-P2687",
    category: "pipeline",
    blurb:
      "Part of Cheniere's Corpus Christi Stage IV LNG expansion, still under FERC environmental review. The Sierra Club and South Texas Environmental Justice Network have long criticized the broader Corpus Christi LNG complex for air pollution affecting the Coastal Bend community.",
  },
  {
    slug: "sabine-crossing-pipeline-cheniere-energy-sabine-crossing-pipeline-llc-25505",
    category: "pipeline",
    blurb:
      "A roughly 56-mile pipeline from Texas into Louisiana supplying Cheniere's Sabine Pass Stage 5 LNG expansion, included in FERC's April 2026 draft environmental review. No documented controversy specific to this pipeline segment beyond the broader LNG buildout it feeds.",
  },
  {
    slug: "desert-southwest-expansion-project-transwestern-PF269",
    category: "pipeline",
    blurb:
      "A roughly 520-mile expansion recently upsized by Energy Transfer, crossing 234 miles of tribal land including the Navajo Nation. The Sierra Club's Grand Canyon Chapter and Chispa Arizona publicly criticized Arizona Gov. Katie Hobbs for supporting it, citing fossil-fuel lock-in and New Mexico's weak spill/emissions enforcement record.",
  },
  {
    slug: "south-mississippi-project-energy-transfer-roject",
    category: "pipeline",
    blurb:
      "An Energy Transfer pipeline targeted for a 2028 in-service date; the company's own open-season materials describe initial capacity of 1 Bcf/d, \"scalable to more than 2 Bcf/d,\" so the larger figure isn't yet a firm commitment. Tracked by the Southern Environmental Law Center as one of several Southeast pipeline projects to watch.",
  },
  {
    slug: "texas-gateway-project-gulf-south-pipeline-co-llc-26547",
    category: "pipeline",
    blurb:
      "A roughly 155-mile pipeline from Carthage, Texas to the Gillis Hub in Louisiana, recently granted expedited federal review under the FAST-41 process. No distinct grassroots opposition campaign found beyond routine landowner and easement concerns.",
  },
];
