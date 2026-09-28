// Short, factual points a first-time speaker can use at a public hearing, by
// project type. They open with support and name safety or local concerns
// directly, which carries more weight with local boards than advocacy alone.
// General statements only: nothing here claims a fact about a specific
// project.

const STORAGE = [
  "Battery storage holds clean power from the middle of the day for the evening peak, when the grid is most strained.",
  "It lets the grid lean less on gas peaker plants, which run on the hottest days and are among the most polluting.",
  "I support this project with strong fire-safety conditions: current NFPA 855 standards, fire-department review, and an emergency response plan.",
];

const SOLAR = [
  "Solar is the cheapest new power to build, and every month of delay keeps bills higher than they need to be.",
  "Demand for electricity is rising quickly, and projects that are ready to build shouldn't wait years for a decision.",
  "I support this project with reasonable conditions on setbacks, screening, and restoring the land when it's retired.",
];

const WIND = [
  "Wind adds low-cost power, often at night and in winter when solar produces less.",
  "Demand for electricity is rising quickly, and projects that are ready to build shouldn't wait years for a decision.",
  "I support this project with reasonable conditions on setbacks, lighting, and wildlife monitoring.",
];

const TRANSMISSION = [
  "New power lines let cheaper power reach homes and cut the congestion that raises local bills.",
  "A stronger grid keeps the lights on during heat waves and winter storms.",
  "I support this line, routed along existing corridors where possible, with fair treatment for affected landowners.",
];

const GENERAL = [
  "Demand for electricity is rising quickly, and years-long approval delays raise costs for everyone.",
  "Projects that meet the rules deserve a clear, timely decision.",
  "I support this project with conditions that address neighbors' safety and environmental concerns.",
];

export function talkingPointsFor(fuelType: string): string[] {
  if (fuelType === "storage") return STORAGE;
  if (fuelType === "solar") return SOLAR;
  if (fuelType === "wind_onshore" || fuelType === "wind_offshore") return WIND;
  if (fuelType === "transmission") return TRANSMISSION;
  return GENERAL;
}
