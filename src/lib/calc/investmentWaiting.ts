// Estimated capital investment waiting — replaces an earlier "energy bill
// impact" estimate (MW × capacity factor × days waiting × wholesale price),
// which only had data for ~5 of 377 projects because most of the dataset
// (EIA-860M "Planned" generators) doesn't publish an application-filed
// date, so "days waiting" couldn't be computed for them.
//
// This estimate needs only capacity + fuel type — no filing date at all —
// so it's computable for nearly every generation/storage project instead of
// a small subset. Also chosen because "$X billion in construction
// investment waiting on a permit" is a number most people can place
// immediately (jobs, local economic activity), more than a wholesale
// energy-market abstraction.
//
// METHOD:
//   estimated investment waiting
//     = capacity (MW) × 1,000 (kW/MW) × typical overnight capital cost for
//       that technology ($/kW)
//
// Capital cost figures are EIA's own published national-average overnight
// construction costs — "Cost and Performance Characteristics of New
// Generating Technologies," Annual Energy Outlook 2022, Table 1 (2021$/kW,
// not inflation-adjusted — a known simplification, called out on
// /methodology): https://www.eia.gov/outlooks/aeo/assumptions/pdf/table_8.2.pdf
//
// Transmission, pipeline, and LNG projects are NOT run through this formula
// — a transmission line's build cost is driven by route length and terrain,
// not its MW rating, so "$/kW of generation capacity" isn't the right unit
// for it, and EIA's table doesn't cover it. Their investment-waiting is
// shown as "not estimated."

import type { FuelType } from "@/lib/data/taxonomies";

export const CAPITAL_COST_USD_PER_KW: Partial<Record<FuelType, number>> = {
  solar: 1327,
  wind_onshore: 1718,
  wind_offshore: 6041,
  storage: 1316,
  // Average of EIA's single-shaft ($1,201/kW) and multi-shaft ($1,062/kW)
  // combined-cycle figures — the two most common new gas configurations.
  gas: 1130,
  nuclear: 7030,
  hydro: 3083,
  geothermal: 3076,
};

export interface InvestmentWaitingInput {
  fuelType: string;
  capacityValue: number | null;
  capacityUnit: string | null;
}

export interface InvestmentWaitingResult {
  applicable: boolean;
  reason?: string;
  estimatedUsd?: number;
  costPerKw?: number;
}

export function estimateInvestmentWaiting(input: InvestmentWaitingInput): InvestmentWaitingResult {
  const { fuelType, capacityValue, capacityUnit } = input;

  if (capacityUnit !== "MW") {
    return {
      applicable: false,
      reason:
        "Investment-waiting is only estimated for projects with capacity measured in MW (generation/storage). This project's capacity is measured differently (e.g. MTPA, or pipeline length/diameter).",
    };
  }

  const costPerKw = CAPITAL_COST_USD_PER_KW[fuelType as FuelType];
  if (costPerKw == null) {
    return {
      applicable: false,
      reason: `No published typical capital cost is used for fuel type "${fuelType}" in v1, so no dollar estimate is shown for it.`,
    };
  }

  if (capacityValue == null) {
    return { applicable: false, reason: "Missing capacity data needed to compute an estimate." };
  }

  const estimatedUsd = capacityValue * 1000 * costPerKw;
  return { applicable: true, estimatedUsd, costPerKw };
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
