// Hand-verified, sourced opposition to tracked projects: parties that formally
// intervened in a docket, local government votes and moratoria, lawsuits,
// and organized groups. Loaded daily by /api/cron/ingest-opposition into
// ProjectOpposition (see schema.prisma), which the project page shows under
// the Opposition section of its Details panel and each state's contested-projects page lists. The
// weekly hand-research routine adds entries; see ingest/README.md
// "Opposition".
//
// Rules for that pass, so the site never calls a project opposed without
// showing why:
//   - Every record needs a public source that says it directly: the docket's
//     own filing or service list for an intervenor, the body's minutes,
//     agenda or press release for a vote or moratorium, the court docket or
//     a named news outlet for a lawsuit, the group's own site or a named news
//     outlet for an organized group, or the Sabin Center's "Opposition to
//     Renewable Energy Facilities in the United States" report (origin
//     "sabin_center"; cite the edition).
//   - Name organizations and government bodies only. Never name a private
//     individual, even one who intervened or sued in their own name; write
//     "Nearby landowners" or "A group of residents" instead.
//   - State what happened, not motives: "Petitioned to intervene", "Voted
//     5-2 to deny the special-use permit", "Sued to overturn the certificate".
//     No adjectives, no characterizing the opposition or the project.
//   - A party that intervened only to support the project, or a neutral
//     party such as commission staff or the state consumer advocate, is not
//     opposition. Leave it out.
//   - `project` is the project's slug from its page URL
//     (waitingforpower.com/project/<slug>), or its matchKey (contains ":")
//     for projects defined in this repo, e.g. "local:<id>" from
//     localHearings.ts. A slug merged into another project resolves to it.
//   - This file owns every ProjectOpposition row: a project dropped from
//     this list loses its records on the next run.

import { prisma } from "@/lib/db";
import type { OppositionKind } from "@/lib/types";

export type OppositionOrigin = "hand_research" | "sabin_center" | "docket";

export interface OppositionRecord {
  kind: OppositionKind;
  party: string;
  action: string;
  date?: string; // YYYY-MM-DD or YYYY-MM, when the source gives one (shown as month and year)
  source: { label: string; url: string };
  origin: OppositionOrigin;
}

export interface OppositionEntry {
  project: string; // slug or matchKey, see the rules above
  verifiedOn: string; // YYYY-MM-DD, the date the sources were last read
  records: OppositionRecord[];
}

// Each record's page on the Sabin Center's Opposition Report site, which
// gives the full account and its underlying citations.
const SABIN = (url: string) => ({ label: "Sabin Center, Opposition to Renewable Energy Facilities (Sept. 2026 ed.)", url });

// Seeded 2026-09-30 from the Sabin Center's contested-projects data (Sept.
// 2026 edition, data updated 2026-09-08), matched to tracked projects by
// scripts/opposition_candidates.py and checked by hand: same name, place and
// technology. Where the data names no organization, the party is described
// ("Local residents"), never a person.
export const OPPOSITION: OppositionEntry[] = [
  // SunZia Transmission Line (Cochise County)
  {
    project: "sunzia-southwest-transmission-project-95971",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Tohono O'odham Nation, San Carlos Apache Tribe, Center for Biological Diversity and Archaeology Southwest", action: "Sued in federal court claiming the federal review violated NEPA and the National Historic Preservation Act; an appeals court revived the case in May 2025.", date: "2024-01", source: SABIN("https://oppositionreport.org/projects/sunzia-transmission-line-cochise-county/"), origin: "sabin_center" },
    ],
  },
  // Boulder Brush Project (San Diego County)
  {
    project: "campo-wind-project-with-boulder-brush-facilities-73756",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Backcountry Against Dumps", action: "Sued San Diego County over its approval of the Boulder Brush substation and transmission line under the California Environmental Quality Act; an appeals court let the case proceed in March 2024.", date: "2021-04", source: SABIN("https://oppositionreport.org/projects/boulder-brush-project-san-diego-county/"), origin: "sabin_center" },
    ],
  },
  // Humidor Battery Energy Storage Project (Los Angeles County)
  {
    project: "los-angeles-department-of-water-and-power-interconnection-request-q82-battery-erQ82",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Save Our Rural Town", action: "Sued to stop the Humidor battery project after its appeal of Los Angeles County's approval was denied.", date: "2023-09", source: SABIN("https://oppositionreport.org/projects/humidor-battery-energy-storage-project-los-angeles-county/"), origin: "sabin_center" },
      { kind: "local_government", party: "Acton Town Council", action: "Asked the California Energy Commission to assess the project's public safety risks.", date: "2024-04", source: SABIN("https://oppositionreport.org/projects/humidor-battery-energy-storage-project-los-angeles-county/"), origin: "sabin_center" },
    ],
  },
  // Grain Belt Express (Christian, Clark, Cumberland, Greene, Macoupin, Montgomery, Pike, Scott, and Shelby Counties)
  {
    project: "grain-belt-express-transmission-phase-1-hase1",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Concerned Citizens and Property Owners, Illinois Agricultural Association and Landowners Alliance of Central Illinois", action: "Challenged the Illinois Commerce Commission's 2015 approval in state court; an appeals court overturned it in 2018.", source: SABIN("https://oppositionreport.org/projects/grain-belt-express-christian-clark-cumberland-greene-macoupin-montgomery-pike-scott-and-shelby-counties/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Project opponents", action: "Appealed the Commission's March 2023 approval; an appeals court reversed it in August 2024 and the Illinois Supreme Court reinstated it in January 2026.", date: "2024-08", source: SABIN("https://oppositionreport.org/projects/grain-belt-express-christian-clark-cumberland-greene-macoupin-montgomery-pike-scott-and-shelby-counties/"), origin: "sabin_center" },
    ],
  },
  // Grain Belt Express (Christian, Clark, Cumberland, Greene, Macoupin, Montgomery, Pike, Scott, and Shelby Counties)
  {
    project: "grain-belt-express-clean-line-llc-il-icc-docket-15-0277-50277",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Concerned Citizens and Property Owners, Illinois Agricultural Association and Landowners Alliance of Central Illinois", action: "Challenged the Illinois Commerce Commission's 2015 approval in state court; an appeals court overturned it in 2018.", source: SABIN("https://oppositionreport.org/projects/grain-belt-express-christian-clark-cumberland-greene-macoupin-montgomery-pike-scott-and-shelby-counties/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Project opponents", action: "Appealed the Commission's March 2023 approval; an appeals court reversed it in August 2024 and the Illinois Supreme Court reinstated it in January 2026.", date: "2024-08", source: SABIN("https://oppositionreport.org/projects/grain-belt-express-christian-clark-cumberland-greene-macoupin-montgomery-pike-scott-and-shelby-counties/"), origin: "sabin_center" },
    ],
  },
  // Stonefield Solar Project (Hardin County)
  {
    project: "stonefield-solar-llc-ky-psc-case-2022-00011-00011",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Hardin County Commission", action: "Denied the rezoning of 1,030 acres for the project (the Fiscal Court later approved it).", date: "2023-05", source: SABIN("https://oppositionreport.org/projects/stonefield-solar-project-hardin-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Hardin County Citizens for Responsible Solar", action: "Sued to rescind the rezoning that allows the project.", date: "2023-07", source: SABIN("https://oppositionreport.org/projects/stonefield-solar-project-hardin-county/"), origin: "sabin_center" },
    ],
  },
  // New England Wind 1 Transmission (Barnstable County)
  {
    project: "new-england-wind-92756",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Save Greater Dowses Beach", action: "Sued the Barnstable Town Council to stop the project's transmission cables under the town's main street; the case was dismissed in August 2024.", date: "2024-07", source: SABIN("https://oppositionreport.org/projects/new-england-wind-1-transmission-barnstable-county/"), origin: "sabin_center" },
    ],
  },
  // New England Wind 2, formerly known as Commonwealth Wind Project and Park City Wind (Barnstable County)
  {
    project: "commonwealth-wind-llc-ma-efsb-efsb22-06-10802",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "ACK for Whales", action: "Sued in federal court claiming the federal approval violated the Marine Mammal Protection Act, the Endangered Species Act and other laws.", date: "2025-05", source: SABIN("https://oppositionreport.org/projects/new-england-wind-2-formerly-known-as-commonwealth-wind-project-and-park-city-wind-barnstable-county/"), origin: "sabin_center" },
      { kind: "organized_group", party: "Save Greater Dowses Beach", action: "Formed to oppose landing the project's cables in Barnstable.", date: "2023-11", source: SABIN("https://oppositionreport.org/projects/new-england-wind-2-formerly-known-as-commonwealth-wind-project-and-park-city-wind-barnstable-county/"), origin: "sabin_center" },
    ],
  },
  // New England Wind 2, formerly known as Commonwealth Wind Project and Park City Wind (Barnstable County)
  {
    project: "new-england-wind-92756",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "ACK for Whales", action: "Sued in federal court claiming the federal approval violated the Marine Mammal Protection Act, the Endangered Species Act and other laws.", date: "2025-05", source: SABIN("https://oppositionreport.org/projects/new-england-wind-2-formerly-known-as-commonwealth-wind-project-and-park-city-wind-barnstable-county/"), origin: "sabin_center" },
      { kind: "organized_group", party: "Save Greater Dowses Beach", action: "Formed to oppose landing the project's cables in Barnstable.", date: "2023-11", source: SABIN("https://oppositionreport.org/projects/new-england-wind-2-formerly-known-as-commonwealth-wind-project-and-park-city-wind-barnstable-county/"), origin: "sabin_center" },
    ],
  },
  // SouthCoast Wind, f/k/a Mayflower Wind, Falmouth Connection (Barnstable County)
  {
    project: "southcoast-wind-energy-llc-southcoast-wind-95051",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Falmouth Select Board", action: "Denied the developer access to town land for soil testing at a proposed cable landing site.", date: "2022-12-19", source: SABIN("https://oppositionreport.org/projects/southcoast-wind-f-k-a-mayflower-wind-falmouth-connection-barnstable-county/"), origin: "sabin_center" },
      { kind: "local_government", party: "Town of Nantucket", action: "Wrote to the Bureau of Ocean Energy Management raising concerns about mitigation and emergency plans for blade failures.", date: "2024-10-30", source: SABIN("https://oppositionreport.org/projects/southcoast-wind-f-k-a-mayflower-wind-falmouth-connection-barnstable-county/"), origin: "sabin_center" },
    ],
  },
  // Vineyard Wind 1 (Nantucket County)
  {
    project: "vineyard-wind-73356",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Nantucket Residents Against Turbines (ACKRATS), Responsible Offshore Development Alliance and Seafreeze Shoreside", action: "Filed federal lawsuits over the project's review of impacts on right whales and other claims; courts ruled for the project and the Supreme Court declined to hear the appeals in 2025.", source: SABIN("https://oppositionreport.org/projects/vineyard-wind-1-nantucket-county/"), origin: "sabin_center" },
    ],
  },
  // Maryland Offshore Wind Project a/k/a MarWin a/k/a US Wind (Worcester County)
  {
    project: "maryland-offshore-wind-project-98711",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Ocean City Mayor and Council", action: "Passed a resolution against any wind project within 30 miles of the city.", date: "2018-02", source: SABIN("https://oppositionreport.org/projects/maryland-offshore-wind-project-a-k-a-marwin-a-k-a-us-wind-worcester-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Ocean City, Worcester County, community associations and the Ocean City Marlin Club", action: "Sued in federal court to overturn the federal approval of the project.", date: "2024-10", source: SABIN("https://oppositionreport.org/projects/maryland-offshore-wind-project-a-k-a-marwin-a-k-a-us-wind-worcester-county/"), origin: "sabin_center" },
    ],
  },
  // Skipjack Wind (Worcester County)
  {
    project: "skipjack-wind-farm-84696",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Ocean City Mayor and Council", action: "Passed a resolution against any wind project within 30 miles of the city.", date: "2018-02", source: SABIN("https://oppositionreport.org/projects/skipjack-wind-worcester-county/"), origin: "sabin_center" },
    ],
  },
  // Atlantic Shores South Project (Ocean County)
  {
    project: "atlantic-shores-south-93191",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Long Beach Township, Beach Haven, Ship Bottom, Surf City, Harvey Cedars, Barnegat Light, Brigantine and Ventnor", action: "Sued the New Jersey Department of Environmental Protection claiming the project violates state coastal rules.", date: "2023-12", source: SABIN("https://oppositionreport.org/projects/atlantic-shores-south-project-ocean-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Save Long Beach Island", action: "Sued the federal government over authorizations for the project and other offshore wind farms; the case was dismissed in February 2024.", date: "2023-04", source: SABIN("https://oppositionreport.org/projects/atlantic-shores-south-project-ocean-county/"), origin: "sabin_center" },
    ],
  },
  // Battle Born Solar (Clark County)
  {
    project: "battle-born-solar-project-90401",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Save Our Mesa", action: "Opposed the project over visual and tourism impacts; the developer withdrew its application in July 2021.", source: SABIN("https://oppositionreport.org/projects/battle-born-solar-clark-county/"), origin: "sabin_center" },
    ],
  },
  // Kulning Wind Energy Project (Clark County)
  {
    project: "kulning-wind-energy-project-96691",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local conservation groups", action: "Opposed the project near the Wee Thump Joshua Tree Wilderness; the area is now within the Avi Kwa Ame National Monument.", source: SABIN("https://oppositionreport.org/projects/kulning-wind-energy-project-clark-county/"), origin: "sabin_center" },
    ],
  },
  // Rough Hat Clark Solar Project (Clark County)
  {
    project: "rough-hat-unit-rh1-82RH1",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Basin and Range Watch", action: "Joined a letter asking the Bureau of Land Management to cancel the project's permitting, citing the desert tortoise.", date: "2024-03", source: SABIN("https://oppositionreport.org/projects/rough-hat-clark-solar-project-clark-county/"), origin: "sabin_center" },
    ],
  },
  // Rough Hat Clark Solar Project (Clark County)
  {
    project: "rough-hat-clark-bess-llc-nv-pucn-docket-24-10007-10007",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Basin and Range Watch", action: "Joined a letter asking the Bureau of Land Management to cancel the project's permitting, citing the desert tortoise.", date: "2024-03", source: SABIN("https://oppositionreport.org/projects/rough-hat-clark-solar-project-clark-county/"), origin: "sabin_center" },
    ],
  },
  // Alle-Catt Wind Farm (Allegany, Cattaraugus, and Wyoming Counties)
  {
    project: "alle-catt-wind-energy-llc-unit-gen1-4GEN1",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Coalition of Concerned Citizens", action: "Challenged the state Siting Board's approval in court; the Appellate Division upheld the approval in November 2021.", source: SABIN("https://oppositionreport.org/projects/alle-catt-wind-farm-allegany-cattaraugus-and-wyoming-counties/"), origin: "sabin_center" },
    ],
  },
  // Alle-Catt Wind Farm (Allegany, Cattaraugus, and Wyoming Counties)
  {
    project: "alle-catt-wind-energy-llc-ny-dps-case-17-f-0282-F0282",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Coalition of Concerned Citizens", action: "Challenged the state Siting Board's approval in court; the Appellate Division upheld the approval in November 2021.", source: SABIN("https://oppositionreport.org/projects/alle-catt-wind-farm-allegany-cattaraugus-and-wyoming-counties/"), origin: "sabin_center" },
    ],
  },
  // Alle-Catt Wind Farm (Allegany, Cattaraugus, and Wyoming Counties)
  {
    project: "alle-catt-wind-energy-llc-ny-dps-case-21-t-0059-T0059",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Coalition of Concerned Citizens", action: "Challenged the state Siting Board's approval in court; the Appellate Division upheld the approval in November 2021.", source: SABIN("https://oppositionreport.org/projects/alle-catt-wind-farm-allegany-cattaraugus-and-wyoming-counties/"), origin: "sabin_center" },
    ],
  },
  // Bear Ridge Solar Project (Niagara County)
  {
    project: "bear-ridge-solar-llc-ny-dps-case-18-f-0338-F0338",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Town of Cambria", action: "Argued before a state judge that part of the site was zoned against solar; the permit excluded 120 contested acres.", date: "2023-02", source: SABIN("https://oppositionreport.org/projects/bear-ridge-solar-project-niagara-county/"), origin: "sabin_center" },
      { kind: "organized_group", party: "Cambria Opposes Industrial Solar", action: "Took part in the state siting hearing in opposition to the project.", date: "2023-02", source: SABIN("https://oppositionreport.org/projects/bear-ridge-solar-project-niagara-county/"), origin: "sabin_center" },
    ],
  },
  // Bear Ridge Solar Project (Niagara County)
  {
    project: "bear-ridge-solar-llc-ny-dps-case-21-02104-02104",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Town of Cambria", action: "Argued before a state judge that part of the site was zoned against solar; the permit excluded 120 contested acres.", date: "2023-02", source: SABIN("https://oppositionreport.org/projects/bear-ridge-solar-project-niagara-county/"), origin: "sabin_center" },
      { kind: "organized_group", party: "Cambria Opposes Industrial Solar", action: "Took part in the state siting hearing in opposition to the project.", date: "2023-02", source: SABIN("https://oppositionreport.org/projects/bear-ridge-solar-project-niagara-county/"), origin: "sabin_center" },
    ],
  },
  // Empire Wind 1 and 2 (Kings and Nassau Counties)
  {
    project: "empire-wind-energy-project-84911",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Save Long Beach Island, Save the East Coast and Protect Our Coast LINY", action: "Sued in federal court to overturn the federal approvals and halt construction; a preliminary injunction was denied in October 2025.", date: "2025-07", source: SABIN("https://oppositionreport.org/projects/empire-wind-1-and-2-kings-and-nassau-counties/"), origin: "sabin_center" },
    ],
  },
  // Flint Mine Solar (Greene County)
  {
    project: "flint-mine-solar-llc-ny-dps-case-18-f-0087-F0087",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Town of Coxsackie", action: "Passed a 2019 ordinance that would have blocked the project; the state Siting Board approved it over the town's objection in August 2021.", source: SABIN("https://oppositionreport.org/projects/flint-mine-solar-greene-county/"), origin: "sabin_center" },
    ],
  },
  // Galloo Island Wind Project (Jefferson County)
  {
    project: "galloo-island-wind-llc-ny-dps-case-18-t-0015-T0015",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed the project over property values and a nearby bald eagle nest; the developer abandoned it in February 2019.", source: SABIN("https://oppositionreport.org/projects/galloo-island-wind-project-jefferson-county/"), origin: "sabin_center" },
    ],
  },
  // Garnet Energy Center (Cayuga County)
  {
    project: "garnet-energy-center-llc-ny-dps-case-20-f-0043-F0043",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Rural Preservation and Net Conservation Benefit Coalition", action: "Asked the state Siting Board to rehear its approval, arguing the bird studies were inadequate; the request was denied in February 2023.", date: "2022-11", source: SABIN("https://oppositionreport.org/projects/garnet-energy-center-cayuga-county/"), origin: "sabin_center" },
    ],
  },
  // Gravel Road Solar (Seneca County)
  {
    project: "gravel-road-solar-llc-ny-dps-case-24-03043-03043",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Tyre United", action: "Formed to oppose the project with signs and meetings with state representatives.", date: "2023-11", source: SABIN("https://oppositionreport.org/projects/gravel-road-solar-seneca-county/"), origin: "sabin_center" },
      { kind: "local_government", party: "Town of Tyre supervisor", action: "Asked the Governor to deny the project's permit.", date: "2023-12", source: SABIN("https://oppositionreport.org/projects/gravel-road-solar-seneca-county/"), origin: "sabin_center" },
    ],
  },
  // Mill Point Solar I (Montgomery County)
  {
    project: "nm-ng-interconnection-request-1031-solar-battery-G1031",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Glen Families Allied for Responsible Management of Land (GlenFARMLand)", action: "Opposed the project over farmland loss and announced plans to take part in the state review, along with the Town of Glen.", date: "2024-02", source: SABIN("https://oppositionreport.org/projects/mill-point-solar-i-montgomery-county/"), origin: "sabin_center" },
    ],
  },
  // North Side Energy Center (St. Lawrence County)
  {
    project: "north-side-energy-center-llc-ny-dps-case-17-f-0598-F0598",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Friends Against Rural Mismanagement (FARM)", action: "Filed comments opposing the project; the state Siting Board denied it in August 2022 over wetland impacts.", date: "2018-05", source: SABIN("https://oppositionreport.org/projects/north-side-energy-center-st-lawrence-county/"), origin: "sabin_center" },
    ],
  },
  // Rich Road Solar Project (St. Lawrence County)
  {
    project: "rich-road-solar-energy-center-llc-ny-dps-case-22-02969-02969",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Town of Canton officials", action: "Raised fire and public safety concerns and considered a court challenge after the state permit was issued.", date: "2024-09", source: SABIN("https://oppositionreport.org/projects/rich-road-solar-project-st-lawrence-county/"), origin: "sabin_center" },
    ],
  },
  // South Fork Wind Project (Suffolk County)
  {
    project: "deepwater-wind-south-fork-llc-ny-dps-case-18-t-0604-T0604",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Citizens for the Preservation of Wainscott", action: "Sued the East Hampton Town Board over its easement for the cable landing; the case was dismissed in February 2022.", date: "2021-01", source: SABIN("https://oppositionreport.org/projects/south-fork-wind-project-suffolk-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Preservation Society of Newport County and Southeast Lighthouse Foundation", action: "Sued the Interior Department over its review and permitting of the project.", date: "2023-11", source: SABIN("https://oppositionreport.org/projects/south-fork-wind-project-suffolk-county/"), origin: "sabin_center" },
    ],
  },
  // South Fork Wind Project (Suffolk County)
  {
    project: "south-fork-wind-farm-and-south-fork-export-cable-73126",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Citizens for the Preservation of Wainscott", action: "Sued the East Hampton Town Board over its easement for the cable landing; the case was dismissed in February 2022.", date: "2021-01", source: SABIN("https://oppositionreport.org/projects/south-fork-wind-project-suffolk-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Preservation Society of Newport County and Southeast Lighthouse Foundation", action: "Sued the Interior Department over its review and permitting of the project.", date: "2023-11", source: SABIN("https://oppositionreport.org/projects/south-fork-wind-project-suffolk-county/"), origin: "sabin_center" },
    ],
  },
  // Alamo Solar I (Preble County)
  {
    project: "alamo-solar-farm-oh-opsb-case-18-1578-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Concerned Citizens of Preble County", action: "Appealed the Ohio Power Siting Board's certificate to the Ohio Supreme Court, which upheld it in October 2023.", source: SABIN("https://oppositionreport.org/projects/alamo-solar-i-preble-county/"), origin: "sabin_center" },
    ],
  },
  // Angelina Solar I (Preble County)
  {
    project: "angelina-solar-facility-oh-opsb-case-18-1579-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Concerned Citizens of Preble County", action: "Appealed the Ohio Power Siting Board's certificate to the Ohio Supreme Court, which upheld it in October 2023.", source: SABIN("https://oppositionreport.org/projects/angelina-solar-i-preble-county/"), origin: "sabin_center" },
    ],
  },
  // Border Basin Solar Farm (Hancock County)
  {
    project: "border-basin-solar-oh-opsb-case-21-0277-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Local opponents, a township and the county health commissioner", action: "Opposed the project before the Ohio Power Siting Board; opponents appealed its approval to the Ohio Supreme Court, then dropped the appeal.", date: "2023-11", source: SABIN("https://oppositionreport.org/projects/border-basin-solar-farm-hancock-county/"), origin: "sabin_center" },
    ],
  },
  // Carnation Solar (Fairfield County)
  {
    project: "carnation-solar-oh-opsb-case-24-0881-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Protect Amanda Township", action: "Organized local opposition to the project online.", source: SABIN("https://oppositionreport.org/projects/carnation-solar-fairfield-county/"), origin: "sabin_center" },
    ],
  },
  // Cepheus Solar (Defiance County)
  {
    project: "cepheus-solar-oh-opsb-case-21-0293-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Seven local governments", action: "Opposed the project; the Ohio Power Siting Board cited their opposition in rejecting it.", date: "2023-01-18", source: SABIN("https://oppositionreport.org/projects/cepheus-solar-defiance-county/"), origin: "sabin_center" },
    ],
  },
  // Chestnut Solar (Marion County)
  {
    project: "chestnut-solar-oh-opsb-case-22-0988-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Marion County Board of Commissioners", action: "Passed a resolution opposing the project; the developer withdrew in May 2024.", date: "2023-02", source: SABIN("https://oppositionreport.org/projects/chestnut-solar-marion-county/"), origin: "sabin_center" },
    ],
  },
  // Chipmunk Solar (Pickaway County)
  {
    project: "chipmunk-solar-oh-opsb-case-21-0960-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed the project; the developer withdrew its application amid the opposition.", date: "2022-12-22", source: SABIN("https://oppositionreport.org/projects/chipmunk-solar-pickaway-county/"), origin: "sabin_center" },
    ],
  },
  // Circleville Solar (Pickaway County)
  {
    project: "circleville-solar-oh-opsb-case-21-1090-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Pickaway County Board of Commissioners", action: "Passed a resolution opposing the project.", date: "2022-04-12", source: SABIN("https://oppositionreport.org/projects/circleville-solar-pickaway-county/"), origin: "sabin_center" },
      { kind: "local_government", party: "Circleville City Council", action: "Passed a resolution opposing the project and other solar farms in Pickaway County.", date: "2022-11", source: SABIN("https://oppositionreport.org/projects/circleville-solar-pickaway-county/"), origin: "sabin_center" },
    ],
  },
  // Circleville Solar (Pickaway County)
  {
    project: "circleville-solar-transmission-line-oh-opsb-case-22-0117-el-btx-ELBTX",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Pickaway County Board of Commissioners", action: "Passed a resolution opposing the project.", date: "2022-04-12", source: SABIN("https://oppositionreport.org/projects/circleville-solar-pickaway-county/"), origin: "sabin_center" },
      { kind: "local_government", party: "Circleville City Council", action: "Passed a resolution opposing the project and other solar farms in Pickaway County.", date: "2022-11", source: SABIN("https://oppositionreport.org/projects/circleville-solar-pickaway-county/"), origin: "sabin_center" },
    ],
  },
  // Eastern Cottontail Solar (Fairfield County)
  {
    project: "eastern-cottontail-solar-oh-opsb-case-24-0495-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Citizens For Fair Fields and Walnut Township", action: "Intervened before the Ohio Power Siting Board in opposition, then appealed its approval to the Ohio Supreme Court.", date: "2025-12", source: SABIN("https://oppositionreport.org/projects/eastern-cottontail-solar-fairfield-county/"), origin: "sabin_center" },
    ],
  },
  // Emerson Creek Wind Farm (Erie and Huron Counties)
  {
    project: "emerson-creek-wind-farm-oh-opsb-case-18-1607-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Local residents and the Black Swamp Bird Observatory", action: "Intervened before the Ohio Power Siting Board to stop the project; the Ohio Supreme Court upheld the approval in July 2023.", source: SABIN("https://oppositionreport.org/projects/emerson-creek-wind-farm-erie-and-huron-counties/"), origin: "sabin_center" },
    ],
  },
  // Fountain Point Solar Farm (Logan County)
  {
    project: "fountain-point-solar-oh-opsb-case-21-1231-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "No Solar in Logan County (Ohio)", action: "Organized opposition to the project; about 100 residents spoke against it at a public meeting.", date: "2022-03", source: SABIN("https://oppositionreport.org/projects/fountain-point-solar-farm-logan-county/"), origin: "sabin_center" },
    ],
  },
  // Frasier Solar Project (Knox County)
  {
    project: "frasier-solar-oh-opsb-case-23-0796-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Knox Smart Development and Preserve Knox County", action: "Intervened before the Ohio Power Siting Board in opposition, then appealed its approval to the Ohio Supreme Court.", date: "2024-01", source: SABIN("https://oppositionreport.org/projects/frasier-solar-project-knox-county/"), origin: "sabin_center" },
    ],
  },
  // Grange Solar Grazing Center (Logan County)
  {
    project: "grange-solar-oh-opsb-case-24-0801-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Indian Lake Advocacy Group, Logan County and five townships", action: "Intervened before the Ohio Power Siting Board in opposition; the developer withdrew after Board staff recommended denial.", date: "2025-02", source: SABIN("https://oppositionreport.org/projects/grange-solar-grazing-center-logan-county/"), origin: "sabin_center" },
    ],
  },
  // Icebreaker Wind Project (Cuyahoga County)
  {
    project: "icebreaker-wind-facility-oh-opsb-case-16-1871-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Two Lake Erie shoreline residents", action: "Appealed to the Ohio Supreme Court the lifting of limits on nighttime turbine operation; the court upheld the Board in August 2022.", date: "2021-12-07", source: SABIN("https://oppositionreport.org/projects/icebreaker-wind-project-cuyahoga-county/"), origin: "sabin_center" },
    ],
  },
  // Kensington Solar Project (Columbiana County)
  {
    project: "kensington-solar-oh-opsb-case-21-0764-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Franklin Against Kensington Solar", action: "Organized opposition and asked to intervene in the state review; the developer withdrew in June 2024.", source: SABIN("https://oppositionreport.org/projects/kensington-solar-project-columbiana-county/"), origin: "sabin_center" },
      { kind: "local_government", party: "Columbiana County Board of Commissioners", action: "Passed a resolution against the project.", date: "2023-08", source: SABIN("https://oppositionreport.org/projects/kensington-solar-project-columbiana-county/"), origin: "sabin_center" },
    ],
  },
  // Kingwood Solar Project (Greene County)
  {
    project: "kingwood-solar-oh-opsb-case-21-0117-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed the project; the Ohio Power Siting Board rejected it, citing public opposition.", date: "2022-12", source: SABIN("https://oppositionreport.org/projects/kingwood-solar-project-greene-county/"), origin: "sabin_center" },
    ],
  },
  // Oak Run Solar Project (Madison County)
  {
    project: "oak-run-solar-oh-opsb-case-22-0549-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Deercreek, Monroe and Somerford Townships", action: "Passed resolutions opposing the project and intervened before the Ohio Power Siting Board.", source: SABIN("https://oppositionreport.org/projects/oak-run-solar-project-madison-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Madison County and Deercreek, Monroe and Somerford Townships", action: "Appealed the Ohio Power Siting Board's approval to the Ohio Supreme Court.", date: "2024-10", source: SABIN("https://oppositionreport.org/projects/oak-run-solar-project-madison-county/"), origin: "sabin_center" },
    ],
  },
  // Oak Run Solar Project (Madison County)
  {
    project: "oak-run-solar-transmission-line-oh-opsb-case-22-0550-el-btx-ELBTX",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Deercreek, Monroe and Somerford Townships", action: "Passed resolutions opposing the project and intervened before the Ohio Power Siting Board.", source: SABIN("https://oppositionreport.org/projects/oak-run-solar-project-madison-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Madison County and Deercreek, Monroe and Somerford Townships", action: "Appealed the Ohio Power Siting Board's approval to the Ohio Supreme Court.", date: "2024-10", source: SABIN("https://oppositionreport.org/projects/oak-run-solar-project-madison-county/"), origin: "sabin_center" },
    ],
  },
  // Scioto Farms Solar (Pickaway County)
  {
    project: "scioto-farms-solar-oh-opsb-case-21-0868-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Wayne Township", action: "Intervened before the Ohio Power Siting Board in opposition; the developer withdrew in December 2023.", source: SABIN("https://oppositionreport.org/projects/scioto-farms-solar-pickaway-county/"), origin: "sabin_center" },
      { kind: "local_government", party: "Pickaway County Board of Commissioners", action: "Passed a resolution opposing the project.", source: SABIN("https://oppositionreport.org/projects/scioto-farms-solar-pickaway-county/"), origin: "sabin_center" },
    ],
  },
  // South Branch Solar Farm (Hancock County)
  {
    project: "south-branch-solar-oh-opsb-case-21-0669-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "A project opponent", action: "Appealed the Ohio Power Siting Board's approval to the Ohio Supreme Court; 187 of 285 public comments opposed the project.", date: "2023-08", source: SABIN("https://oppositionreport.org/projects/south-branch-solar-farm-hancock-county/"), origin: "sabin_center" },
    ],
  },
  // Stark Solar Project (Stark County)
  {
    project: "stark-solar-oh-opsb-case-23-0931-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Stark County Board of Commissioners and Washington Township Trustees", action: "Opposed the project; the Ohio Power Siting Board rejected it in April 2025.", date: "2024-07", source: SABIN("https://oppositionreport.org/projects/stark-solar-project-stark-county/"), origin: "sabin_center" },
    ],
  },
  // Yellow Wood Solar (Clinton County)
  {
    project: "yellow-wood-solar-oh-opsb-case-20-1680-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Clinton County Commissioners", action: "Each stated opposition to the project.", date: "2022-05", source: SABIN("https://oppositionreport.org/projects/yellow-wood-solar-clinton-county/"), origin: "sabin_center" },
      { kind: "intervenor", party: "Local residents and businesses", action: "Intervened before the Ohio Power Siting Board in opposition.", date: "2021-09-30", source: SABIN("https://oppositionreport.org/projects/yellow-wood-solar-clinton-county/"), origin: "sabin_center" },
    ],
  },
  // Yellow Wood Solar (Clinton County)
  {
    project: "yellow-wood-solar-energy-llc-unit-ylwwd-YLWWD",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Clinton County Commissioners", action: "Each stated opposition to the project.", date: "2022-05", source: SABIN("https://oppositionreport.org/projects/yellow-wood-solar-clinton-county/"), origin: "sabin_center" },
      { kind: "intervenor", party: "Local residents and businesses", action: "Intervened before the Ohio Power Siting Board in opposition.", date: "2021-09-30", source: SABIN("https://oppositionreport.org/projects/yellow-wood-solar-clinton-county/"), origin: "sabin_center" },
    ],
  },
  // Muddy Creek Energy Park (Lane County)
  {
    project: "muddy-creek-energy-park-or-efsc-sc151",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Friends of Gap Road", action: "Opposed the project over farmland and bird impacts with a letter-writing campaign and billboards.", source: SABIN("https://oppositionreport.org/projects/muddy-creek-energy-park-lane-county/"), origin: "sabin_center" },
    ],
  },
  // Nolin Hills Energy Project (Umatilla County)
  {
    project: "interconnection-request-g0854-solar-wind-G0854",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Umatilla County", action: "Challenged the state siting council's approval in the Oregon Supreme Court, which upheld it in April 2024.", source: SABIN("https://oppositionreport.org/projects/nolin-hills-energy-project-umatilla-county/"), origin: "sabin_center" },
    ],
  },
  // Nolin Hills Energy Project (Umatilla County)
  {
    project: "interconnection-request-g0908-solar-battery-G0908",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Umatilla County", action: "Challenged the state siting council's approval in the Oregon Supreme Court, which upheld it in April 2024.", source: SABIN("https://oppositionreport.org/projects/nolin-hills-energy-project-umatilla-county/"), origin: "sabin_center" },
    ],
  },
  // Obsidian Solar Center (Lake County)
  {
    project: "obsidian-solar-center-unit-obslr-OBSLR",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Local farmers and ranchers", action: "Brought a contested case against the project; a state judge ruled for the developer in 2022.", source: SABIN("https://oppositionreport.org/projects/obsidian-solar-center-lake-county/"), origin: "sabin_center" },
    ],
  },
  // Revolution Wind (Newport County)
  {
    project: "revolution-wind-farm-project-88686",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Green Oceans", action: "Sued in state court over the coastal permit (dismissed April 2024), then in federal court over the federal approval.", date: "2023-10", source: SABIN("https://oppositionreport.org/projects/revolution-wind-newport-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Preservation Society of Newport County and Southeast Lighthouse Foundation", action: "Sued the Interior Department over its review and permitting of the project.", date: "2023-11", source: SABIN("https://oppositionreport.org/projects/revolution-wind-newport-county/"), origin: "sabin_center" },
    ],
  },
  // Axton Solar Project (Henry County)
  {
    project: "axton-solar-llc-va-scc-pur-2021-00085-00085",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Henry County Board of Supervisors", action: "Rejected the project for exceeding the county's cap on solar land use.", date: "2023-04-25", source: SABIN("https://oppositionreport.org/projects/axton-solar-project-henry-county/"), origin: "sabin_center" },
    ],
  },
  // Coastal Virginia Offshore Wind Project (City of Virginia Beach)
  {
    project: "coastal-virginia-offshore-wind-commercial-project-91811",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Committee for a Constructive Tomorrow, Heartland Institute and National Legal and Policy Center", action: "Sued in federal court to halt the project over right whale impacts; a preliminary injunction was denied in May 2024.", date: "2024-03", source: SABIN("https://oppositionreport.org/projects/coastal-virginia-offshore-wind-project-city-of-virginia-beach/"), origin: "sabin_center" },
    ],
  },
  // Coastal Virginia Offshore Wind Project (City of Virginia Beach)
  {
    project: "coastal-virginia-offshore-wind-cvow-commercial-project-unit-cvowc-CVOWC",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Committee for a Constructive Tomorrow, Heartland Institute and National Legal and Policy Center", action: "Sued in federal court to halt the project over right whale impacts; a preliminary injunction was denied in May 2024.", date: "2024-03", source: SABIN("https://oppositionreport.org/projects/coastal-virginia-offshore-wind-project-city-of-virginia-beach/"), origin: "sabin_center" },
    ],
  },
  // Apple Hill Solar and Willow Road Solar, f/k/a Chelsea Solar (Bennington County)
  {
    project: "chelsea-solar-llc-vt-23-0249-pet-49PET",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Bennington Select Board", action: "Rejected the revised project's siting request (it approved a settlement with the developer in June 2025).", date: "2023-06", source: SABIN("https://oppositionreport.org/projects/apple-hill-solar-and-willow-road-solar-f-k-a-chelsea-solar-bennington-county/"), origin: "sabin_center" },
    ],
  },
  // Dairy Air Wind Farm (Orleans County)
  {
    project: "dairy-air-wind-llc-vt-8887-c8887",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Town of Holland", action: "Fought the project before the Public Utility Commission; the developer dropped it in January 2020.", source: SABIN("https://oppositionreport.org/projects/dairy-air-wind-farm-orleans-county/"), origin: "sabin_center" },
    ],
  },
  // Carriger Solar Project (Klickitat County)
  {
    project: "carriger-solar-wa-efsec-ec109",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Citizens Educated About Solar Energy (CEASE)", action: "Organized local opposition to the project.", date: "2021-08", source: SABIN("https://oppositionreport.org/projects/carriger-solar-project-klickitat-county/"), origin: "sabin_center" },
      { kind: "moratorium", party: "Klickitat County Commission", action: "Adopted a six-month moratorium on solar projects in the area of the project.", date: "2023-01-10", source: SABIN("https://oppositionreport.org/projects/carriger-solar-project-klickitat-county/"), origin: "sabin_center" },
    ],
  },
  // Goldeneye Energy Storage (Skagit County)
  {
    project: "goldeneye-battery-storage-wa-efsec-ec115",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Skagit County Commissioners and Sedro-Woolley Mayor and Council", action: "Stated opposition to the project; the county later barred new energy storage on agricultural land.", date: "2024-08", source: SABIN("https://oppositionreport.org/projects/goldeneye-energy-storage-skagit-county/"), origin: "sabin_center" },
    ],
  },
  // High Noon Solar (Columbia County)
  {
    project: "high-noon-solar-energy-llc-unit-hghnn-HGHNN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Columbia County Board", action: "Passed a resolution urging the Public Service Commission to deny the project.", date: "2023-03-16", source: SABIN("https://oppositionreport.org/projects/high-noon-solar-columbia-county/"), origin: "sabin_center" },
    ],
  },
  // Vista Sands Solar (Portage County)
  {
    project: "vista-sands-solar-unit-vista-VISTA",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Wisconsin Wildlife Federation", action: "Intervened asking the Public Service Commission to shrink the project to protect prairie-chicken habitat.", source: SABIN("https://oppositionreport.org/projects/vista-sands-solar-portage-county/"), origin: "sabin_center" },
    ],
  },
  // Rail Tie Wind Project (Albany County)
  {
    project: "rail-tie-wind-unit-crtw1-CRTW1",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Local residents and businesses", action: "Challenged the county permit; the Wyoming Supreme Court upheld it in April 2023.", source: SABIN("https://oppositionreport.org/projects/rail-tie-wind-project-albany-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Albany County Conservancy and others", action: "Sued in federal court to stop the project under NEPA and the National Historic Preservation Act.", date: "2024-12-23", source: SABIN("https://oppositionreport.org/projects/rail-tie-wind-project-albany-county/"), origin: "sabin_center" },
    ],
  },
  // Rail Tie Wind Project (Albany County)
  {
    project: "rail-tie-wind-project-wy-isc-docket-2020-09-wXg9h",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "lawsuit", party: "Local residents and businesses", action: "Challenged the county permit; the Wyoming Supreme Court upheld it in April 2023.", source: SABIN("https://oppositionreport.org/projects/rail-tie-wind-project-albany-county/"), origin: "sabin_center" },
      { kind: "lawsuit", party: "Albany County Conservancy and others", action: "Sued in federal court to stop the project under NEPA and the National Historic Preservation Act.", date: "2024-12-23", source: SABIN("https://oppositionreport.org/projects/rail-tie-wind-project-albany-county/"), origin: "sabin_center" },
    ],
  },
  // Bay Breeze Solar Project (Jefferson County)
  {
    project: "limestone-land-development-llc-fka-bay-breeze-solar-llc-150-mw-ny-dps-case-24-03044-03044",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Concerned Citizens for Responsible Solar", action: "Formed to oppose the project.", source: SABIN("https://oppositionreport.org/projects/bay-breeze-solar-project-jefferson-county/"), origin: "sabin_center" },
      { kind: "moratorium", party: "Town of Lyme", action: "Adopted a 12-month moratorium on solar and battery projects, suspending work on the project.", date: "2024-12", source: SABIN("https://oppositionreport.org/projects/bay-breeze-solar-project-jefferson-county/"), origin: "sabin_center" },
    ],
  },
  // Riverside Solar Project (Jefferson County)
  {
    project: "riverside-solar-llc-ny-dps-case-19-f-0781-F0781",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Concerned Citizens for Responsible Solar", action: "Formed to oppose the project.", source: SABIN("https://oppositionreport.org/projects/riverside-solar-project-jefferson-county/"), origin: "sabin_center" },
      { kind: "moratorium", party: "Town of Lyme", action: "Adopted a 12-month moratorium on solar and battery projects, suspending work on the project.", date: "2024-12", source: SABIN("https://oppositionreport.org/projects/riverside-solar-project-jefferson-county/"), origin: "sabin_center" },
    ],
  },
  // Riverside Solar Project (Jefferson County)
  {
    project: "riverside-solar-llc-ny-dps-case-21-00752-00752",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Concerned Citizens for Responsible Solar", action: "Formed to oppose the project.", source: SABIN("https://oppositionreport.org/projects/riverside-solar-project-jefferson-county/"), origin: "sabin_center" },
      { kind: "moratorium", party: "Town of Lyme", action: "Adopted a 12-month moratorium on solar and battery projects, suspending work on the project.", date: "2024-12", source: SABIN("https://oppositionreport.org/projects/riverside-solar-project-jefferson-county/"), origin: "sabin_center" },
    ],
  },
  // Richwood Solar (Union County)
  {
    project: "richwood-solar-oh-opsb-case-23-0930-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "intervenor", party: "Citizens Against Richwood Solar and Claibourne, Leesburg and Taylor Townships", action: "Intervened before the Ohio Power Siting Board in opposition; the Board denied the project in January 2025.", source: SABIN("https://oppositionreport.org/projects/richwood-solar-union-county/"), origin: "sabin_center" },
    ],
  },
  // Laramie Range Wind Project (Laramie County)
  {
    project: "laramie-range-wind-project-wy-isc-docket-24-02-LWRHXL",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Laramie County Board of Commissioners", action: "Voted 3-1 to reject the project.", date: "2025-09-16", source: SABIN("https://oppositionreport.org/projects/laramie-range-wind-project-laramie-county/"), origin: "sabin_center" },
    ],
  },
  // Hillclimber Solar (Champaign County)
  {
    project: "hillclimber-solar-oh-opsb-case-25-0904-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed the project at a Champaign County public hearing.", date: "2025-11", source: SABIN("https://oppositionreport.org/projects/hillclimber-solar-champaign-county/"), origin: "sabin_center" },
    ],
  },
  // Lazy U Solar 1 (Hardeman County)
  {
    project: "lazy-u-solar-1-unit-lupv1-LUPV1",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed a county tax abatement for the project, which was approved.", date: "2025-11", source: SABIN("https://oppositionreport.org/projects/lazy-u-solar-1-hardeman-county/"), origin: "sabin_center" },
    ],
  },
  // Betterton Halo Solar (Kent County)
  {
    project: "halo-betterton-llc-md-psc-case-no-9786-c9786",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Town of Betterton", action: "Opposed the project at the Public Service Commission hearing, citing the town's helicopter landing zone and residential zoning.", date: "2025-09", source: SABIN("https://oppositionreport.org/projects/betterton-halo-solar-kent-county/"), origin: "sabin_center" },
      { kind: "organized_group", party: "Kent Conservation and Preservation Alliance", action: "Objected to the project at a town meeting.", date: "2025-11", source: SABIN("https://oppositionreport.org/projects/betterton-halo-solar-kent-county/"), origin: "sabin_center" },
    ],
  },
  // Ritter Station Solar (Fulton County)
  {
    project: "ritter-station-solar-oh-opsb-case-24-0928-el-bgn-ELBGN",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Fulton County Commissioners", action: "Voted unanimously to oppose the project; the Ohio Power Siting Board approved it the next week.", date: "2025-11-13", source: SABIN("https://oppositionreport.org/projects/ritter-station-solar-fulton-county/"), origin: "sabin_center" },
    ],
  },
  // Ritter Station Solar (Fulton County)
  {
    project: "ritter-station-solar-transmission-line-oh-opsb-case-24-0929-el-btx-ELBTX",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Fulton County Commissioners", action: "Voted unanimously to oppose the project; the Ohio Power Siting Board approved it the next week.", date: "2025-11-13", source: SABIN("https://oppositionreport.org/projects/ritter-station-solar-fulton-county/"), origin: "sabin_center" },
    ],
  },
  // Silver King Energy Center (Pinal County)
  {
    project: "silver-king-solar-llc-az-acc-docket-l-21390a-26-0045-00260-00260",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "local_government", party: "Pinal County Board of Supervisors", action: "Voted unanimously to reject the project's rezoning applications.", date: "2026-02-18", source: SABIN("https://oppositionreport.org/projects/silver-king-energy-center-pinal-county/"), origin: "sabin_center" },
    ],
  },
  // Deschutes Solar and BESS Facility (Wasco County)
  {
    project: "deschutes-solar-and-bess-unit-dech1-DECH1",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed the project at a Wasco County public hearing over farmland, wildfire and water concerns.", date: "2026-03", source: SABIN("https://oppositionreport.org/projects/deschutes-solar-and-bess-facility-wasco-county/"), origin: "sabin_center" },
    ],
  },
  // Deschutes Solar and BESS Facility (Wasco County)
  {
    project: "deschutes-solar-and-bess-unit-dech2-DECH2",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed the project at a Wasco County public hearing over farmland, wildfire and water concerns.", date: "2026-03", source: SABIN("https://oppositionreport.org/projects/deschutes-solar-and-bess-facility-wasco-county/"), origin: "sabin_center" },
    ],
  },
  // Deschutes Solar and BESS Facility (Wasco County)
  {
    project: "deschutes-solar-and-battery-energy-storage-system-facility-or-efsc-sc157",
    verifiedOn: "2026-09-30",
    records: [
      { kind: "organized_group", party: "Local residents", action: "Opposed the project at a Wasco County public hearing over farmland, wildfire and water concerns.", date: "2026-03", source: SABIN("https://oppositionreport.org/projects/deschutes-solar-and-bess-facility-wasco-county/"), origin: "sabin_center" },
    ],
  },
];

export const OPPOSITION_CAUSE = "local_state_opposition";

async function findProjectId(ref: string): Promise<string | null> {
  const where = ref.includes(":") ? { matchKey: ref } : { slug: ref };
  const p = await prisma.project.findUnique({ where, select: { id: true, mergedIntoId: true } });
  if (!p) return null;
  return p.mergedIntoId ?? p.id;
}

export async function ingestOpposition(entries: OppositionEntry[] = OPPOSITION): Promise<{
  entries: number;
  projects: number;
  records: number;
  cleared: number;
  errors: { project: string; message: string }[];
}> {
  const errors: { project: string; message: string }[] = [];
  // Several entries can resolve to the same project (a slug and its merged
  // duplicate); their records are combined.
  const byProject = new Map<string, { records: OppositionRecord[]; verifiedOn: Date }>();
  for (const e of entries) {
    const id = await findProjectId(e.project);
    if (!id) {
      errors.push({ project: e.project, message: "No project with this slug or matchKey" });
      continue;
    }
    const prev = byProject.get(id);
    byProject.set(id, { records: [...(prev?.records ?? []), ...e.records], verifiedOn: new Date(e.verifiedOn) });
  }

  let records = 0;
  for (const [projectId, { records: rs, verifiedOn }] of byProject) {
    await prisma.$transaction([
      prisma.projectOpposition.deleteMany({ where: { projectId } }),
      prisma.projectOpposition.createMany({
        data: rs.map((r) => ({
          projectId,
          kind: r.kind,
          party: r.party,
          action: r.action,
          date: r.date ? new Date(`${r.date.length === 7 ? `${r.date}-01` : r.date}T00:00:00Z`) : null,
          sourceLabel: r.source.label,
          sourceUrl: r.source.url,
          origin: r.origin,
          verifiedOn,
        })),
      }),
      prisma.projectCause.upsert({
        where: { projectId_causeSlug: { projectId, causeSlug: OPPOSITION_CAUSE } },
        create: { projectId, causeSlug: OPPOSITION_CAUSE },
        update: {},
      }),
    ]);
    records += rs.length;
  }

  // Projects no longer on the list lose their records and the cause tag.
  const keep = [...byProject.keys()];
  const stale = await prisma.projectOpposition.findMany({
    where: { projectId: { notIn: keep } },
    select: { projectId: true },
    distinct: ["projectId"],
  });
  const staleIds = stale.map((s) => s.projectId);
  if (staleIds.length > 0) {
    await prisma.projectOpposition.deleteMany({ where: { projectId: { in: staleIds } } });
  }
  // Also clears a tag left on a project with no records at all.
  await prisma.projectCause.deleteMany({ where: { causeSlug: OPPOSITION_CAUSE, projectId: { notIn: keep } } });

  return { entries: entries.length, projects: byProject.size, records, cleared: staleIds.length, errors };
}
