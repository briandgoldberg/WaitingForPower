// Short, factual points a first-time speaker can use at a public hearing, by
// project type — both a case for the project and the concerns most
// commonly raised against it, so someone preparing to speak (whichever
// side they're on, or just trying to understand the debate) has both.
// Support points open with support and name safety or local concerns
// directly, which carries more weight with local boards than advocacy
// alone. General statements only: nothing here claims a fact about a
// specific project.

const STORAGE_FOR = [
  "Battery storage holds clean power from the middle of the day for the evening peak, when the grid is most strained.",
  "It lets the grid lean less on gas peaker plants, which run on the hottest days and are among the most polluting.",
  "I support this project with strong fire-safety conditions: current NFPA 855 standards, fire-department review, and an emergency response plan.",
];
const STORAGE_AGAINST = [
  "Lithium-ion battery fires (thermal runaway) can be hard to extinguish and may require evacuating nearby homes.",
  "Cooling fans and inverters can run around the clock, adding steady noise for close neighbors.",
  "A large battery enclosure this close to homes affects the neighborhood's character and property values.",
];

const SOLAR_FOR = [
  "Solar is the cheapest new power to build, and every month of delay keeps bills higher than they need to be.",
  "Demand for electricity is rising quickly, and projects that are ready to build shouldn't wait years for a decision.",
  "I support this project with reasonable conditions on setbacks, screening, and restoring the land when it's retired.",
];
const SOLAR_AGAINST = [
  "This converts farmland, open space, or habitat that won't be easily restored for decades.",
  "Glare and visual impact affect neighboring properties and the character of the area.",
  "Construction traffic and dust will disrupt the area for the length of the build.",
];

const WIND_FOR = [
  "Wind adds low-cost power, often at night and in winter when solar produces less.",
  "Demand for electricity is rising quickly, and projects that are ready to build shouldn't wait years for a decision.",
  "I support this project with reasonable conditions on setbacks, lighting, and wildlife monitoring.",
];
const WIND_AGAINST = [
  "Turbine noise and shadow flicker can reach nearby homes depending on setback distance.",
  "Turbines change the visual character of the landscape for miles around.",
  "Birds and bats can be at risk without careful siting and ongoing monitoring.",
];

const TRANSMISSION_FOR = [
  "New power lines let cheaper power reach homes and cut the congestion that raises local bills.",
  "A stronger grid keeps the lights on during heat waves and winter storms.",
  "I support this line, routed along existing corridors where possible, with fair treatment for affected landowners.",
];
const TRANSMISSION_AGAINST = [
  "Towers and lines have a lasting visual impact on the landscape they cross.",
  "Landowners along the route may face an easement or eminent domain process they didn't choose.",
  "Property values near a new line's right-of-way can be affected.",
];

const GENERAL_FOR = [
  "Demand for electricity is rising quickly, and years-long approval delays raise costs for everyone.",
  "Projects that meet the rules deserve a clear, timely decision.",
  "I support this project with conditions that address neighbors' safety and environmental concerns.",
];
const GENERAL_AGAINST = [
  "Neighbors often feel the local review process moves faster than they can meaningfully weigh in.",
  "Long-term land use and decommissioning responsibility should be clearly spelled out before approval.",
  "Local input earlier in the process, not just at a final hearing, builds more trust in the outcome.",
];

export function talkingPointsFor(fuelType: string): string[] {
  if (fuelType === "storage") return STORAGE_FOR;
  if (fuelType === "solar") return SOLAR_FOR;
  if (fuelType === "wind_onshore" || fuelType === "wind_offshore") return WIND_FOR;
  if (fuelType === "transmission") return TRANSMISSION_FOR;
  return GENERAL_FOR;
}

export function talkingPointsAgainst(fuelType: string): string[] {
  if (fuelType === "storage") return STORAGE_AGAINST;
  if (fuelType === "solar") return SOLAR_AGAINST;
  if (fuelType === "wind_onshore" || fuelType === "wind_offshore") return WIND_AGAINST;
  if (fuelType === "transmission") return TRANSMISSION_AGAINST;
  return GENERAL_AGAINST;
}
