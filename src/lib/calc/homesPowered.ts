// Approximate homes a project's capacity could power over a year:
//   MW × capacity factor × 8,760 h ÷ average home's annual use.
// Capacity factors are typical U.S. fleet averages (EIA Electric Power Monthly,
// 2023, table 6.07.A/B), so a MW of nuclear counts for about four times a MW of
// solar. Offshore wind has no U.S. fleet yet, so it uses NREL ATB's typical
// value. Gas mixes baseload combined-cycle plants (~59%) with peakers (~10-15%),
// so it uses a middle 45%.
//
// Storage, transmission, LNG and pipelines don't generate electricity (storage
// shifts it; the rest move it), so they don't count toward homes at all.

const HOURS_PER_YEAR = 8760;

// EIA: average U.S. residential customer used 10,791 kWh in 2022.
export const AVG_HOME_MWH_PER_YEAR = 10.791;

export const CAPACITY_FACTORS: Record<string, number> = {
  solar: 0.233,
  wind_onshore: 0.332,
  wind_offshore: 0.42,
  nuclear: 0.931,
  hydro: 0.349,
  geothermal: 0.699,
  gas: 0.45,
};

// Null when the project doesn't generate power or has no MW figure.
export function homesPowered(fuelType: string, capacityValue: number | null, capacityUnit: string | null): number | null {
  const cf = CAPACITY_FACTORS[fuelType];
  if (cf == null || capacityUnit !== "MW" || capacityValue == null) return null;
  return (capacityValue * cf * HOURS_PER_YEAR) / AVG_HOME_MWH_PER_YEAR;
}

// "≈ 64 million homes", "≈ 850,000 homes": two significant figures, since this
// is an estimate.
export function formatHomes(homes: number): string {
  if (homes >= 1_000_000) {
    const m = homes / 1_000_000;
    return `≈ ${m >= 10 ? Math.round(m).toLocaleString("en-US") : m.toFixed(1)} million homes`;
  }
  const digits = Math.max(0, Math.floor(Math.log10(Math.max(homes, 1))) - 1);
  const rounded = Math.round(homes / 10 ** digits) * 10 ** digits;
  return `≈ ${rounded.toLocaleString("en-US")} homes`;
}
