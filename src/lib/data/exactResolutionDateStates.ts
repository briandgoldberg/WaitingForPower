import { splitStateCodes } from "@/lib/data/usStates";

// States where a project's ingest module extracts a real, source-published
// resolutionDate — see src/lib/ingest/README.md's "resolutionDate /
// resolutionDateConfidence" section. Kept independently of any one feature:
// this is a data-quality fact about the pipeline (which states we can date
// an approval/cancellation to with confidence), not tied to what used it.
// Keep in sync with that README section when a currently-uncertain state
// (Delaware, Illinois, North Carolina) gets resolved one way or the other.
export const EXACT_RESOLUTION_DATE_STATES: ReadonlySet<string> = new Set([
  "AL",
  "AR",
  "AZ",
  "CA",
  "CO",
  "CT",
  "FL",
  "ID",
  "IN",
  "KY",
  "LA",
  "MA",
  "MO",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "ND",
  "OK",
  "OR",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VA",
  "VT",
  "WA",
  "WV",
  "WI",
]);

// A project's `state` can hold multiple comma-joined codes for a
// multi-state transmission/pipeline project — counted if ANY of its states
// can produce a real date, since the resolution event is shared across the
// whole project either way.
export function hasExactResolutionDateState(state: string | null | undefined): boolean {
  return splitStateCodes(state ?? null).some((code) => EXACT_RESOLUTION_DATE_STATES.has(code));
}
