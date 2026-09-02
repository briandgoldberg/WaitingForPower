// Shared enums/labels for project type, fuel/technology type, and pipeline
// stage. Kept separate from causeCategories.ts because these describe *what*
// a project is / where it's at, not *why* it's delayed.

export type ProjectType =
  | "generation"
  | "transmission"
  | "storage"
  | "lng"
  | "pipeline";

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "generation", label: "Generation" },
  { value: "transmission", label: "Transmission" },
  { value: "storage", label: "Storage" },
  { value: "lng", label: "LNG" },
  { value: "pipeline", label: "Pipeline" },
];

export type FuelType =
  | "solar"
  | "wind_onshore"
  | "wind_offshore"
  | "storage"
  | "gas"
  | "nuclear"
  | "hydro"
  | "lng"
  | "pipeline"
  | "transmission"
  | "geothermal"
  | "other";

export const FUEL_TYPES: { value: FuelType; label: string; color: string }[] = [
  { value: "solar", label: "Solar", color: "#f59e0b" },
  { value: "wind_onshore", label: "Wind (onshore)", color: "#0ea5e9" },
  { value: "wind_offshore", label: "Wind (offshore)", color: "#0369a1" },
  { value: "storage", label: "Storage", color: "#8b5cf6" },
  { value: "gas", label: "Gas", color: "#b45309" },
  { value: "nuclear", label: "Nuclear", color: "#059669" },
  { value: "hydro", label: "Hydro", color: "#0891b2" },
  { value: "lng", label: "LNG", color: "#ea580c" },
  { value: "pipeline", label: "Pipeline", color: "#78350f" },
  { value: "transmission", label: "Transmission", color: "#4338ca" },
  { value: "geothermal", label: "Geothermal", color: "#be123c" },
  { value: "other", label: "Other", color: "#6b7280" },
];

export const FUEL_TYPE_BY_VALUE: Record<FuelType, { label: string; color: string }> =
  Object.fromEntries(FUEL_TYPES.map(({ value, ...rest }) => [value, rest])) as Record<
    FuelType,
    { label: string; color: string }
  >;

// Technologies with essentially zero direct generation emissions. Used for
// the "clean energy capacity waiting" headline stat — a simple MW sum, not
// an emissions estimate.
export const ZERO_CARBON_FUELS: FuelType[] = [
  "solar",
  "wind_onshore",
  "wind_offshore",
  "nuclear",
  "hydro",
  "geothermal",
];

export type ProjectStage =
  | "interconnection_study"
  | "environmental_review"
  | "agency_permitting"
  | "planned_pre_filing"
  | "regulatory_approvals_pending"
  | "local_review"
  | "litigation"
  | "approved_awaiting_construction"
  | "under_construction"
  | "cancelled"
  | "completed";

// planned_pre_filing and regulatory_approvals_pending map directly to
// EIA-860M's own "Planned" tab status codes (P) and (L) respectively — see
// statusToStage in src/lib/ingest/eia860mPlanned.ts. (L) is EIA's own
// "Category L" ("Regulatory approvals pending. Not under construction");
// kept namewise-parallel to EIA's letter so it's traceable back to the
// source, even though the UI label itself just says "Regulatory approvals
// pending" for brevity.
export const PROJECT_STAGES: { value: ProjectStage; label: string }[] = [
  { value: "interconnection_study", label: "Interconnection study" },
  { value: "environmental_review", label: "Environmental review" },
  { value: "planned_pre_filing", label: "Planned, approvals not yet initiated" },
  { value: "regulatory_approvals_pending", label: "Regulatory approvals pending" },
  { value: "agency_permitting", label: "Agency permitting" },
  { value: "local_review", label: "Local/state review" },
  { value: "litigation", label: "Litigation" },
  { value: "approved_awaiting_construction", label: "Approved, awaiting construction" },
  { value: "under_construction", label: "Under construction" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

// Originally (through 2026-08-25) this site tracked ONLY projects still
// waiting on a regulatory yes — RESOLVED_STAGES marked the four stages
// that meant a project was no longer "waiting" (cleared approval, started
// construction, cancelled, or finished), and upsertNormalizedProject
// (src/lib/ingest/common.ts) deleted any previously-tracked project whose
// stage transitioned into one of these. Product direction changed: the
// site now keeps every project regardless of outcome (common.ts no longer
// deletes on RESOLVED_STAGES), surfaced through the frontend's Status
// filter (see StatusBucket/statusBucketForStage below) instead of hidden
// from the dataset entirely. RESOLVED_STAGES itself is unchanged in
// meaning — "this stage means the project is no longer waiting" — just no
// longer used to delete; it's now the input to statusBucketForStage's
// Cancelled/Suspended vs. Permits Complete split.
export const RESOLVED_STAGES: ProjectStage[] = [
  "approved_awaiting_construction",
  "under_construction",
  "cancelled",
  "completed",
];

// PROJECT_STAGES filtered to the "still waiting" stages — for the Stage
// filter-pill UI, which only ever offers sub-stage granularity within the
// default "In Permitting" status bucket (see StatusBucket below); a
// resolved-stage project is reached via the Status filter instead, not
// the Stage pills.
export const TRACKED_PROJECT_STAGES = PROJECT_STAGES.filter(
  (s) => !RESOLVED_STAGES.includes(s.value),
);

// The broad buckets the frontend's top-level Status filter offers —
// coarser than the individual ProjectStage values above, and the thing
// most users actually want to ask ("is this still in permitting, did it
// die, did it get through, or did we just lose track of it?").
// "in_permitting" is every non-resolved, still-reported stage (unchanged
// from this site's original "waiting" definition, so it's the default
// filter value — see DEFAULT_FILTERS in src/lib/filters.ts — and
// reproduces the exact same project set/count this site always showed,
// before resolved-stage projects started being kept at all).
// "no_longer_reported" (added 2026-08-25) is orthogonal to the other three
// — see Project.noLongerReported in schema.prisma — a still-pending
// project whose source stopped listing it, not a real outcome we
// observed, so it gets its own bucket rather than being folded into
// Cancelled/Suspended.
export type StatusBucket = "in_permitting" | "cancelled_suspended" | "permits_complete" | "no_longer_reported";

export const STATUS_BUCKETS: { value: StatusBucket; label: string }[] = [
  { value: "in_permitting", label: "In Permitting" },
  { value: "cancelled_suspended", label: "Cancelled / Suspended" },
  { value: "permits_complete", label: "Permits Complete" },
  { value: "no_longer_reported", label: "No Longer Being Reported" },
];

// No ingestion module in this project currently distinguishes a genuine
// "suspended" outcome from "cancelled" — there's no separate
// ProjectStage for it (a handful of module headers document a source's
// own "Suspended Proceedings"-style status, but none of those currently
// map to a RESOLVED_STAGES value). "cancelled" is the only real stage
// behind the "Cancelled / Suspended" bucket today; kept as its own array
// (not just RESOLVED_STAGES minus the Permits Complete stages) so a
// future "suspended" ProjectStage has one obvious place to wire in.
const CANCELLED_SUSPENDED_STAGES: ProjectStage[] = ["cancelled"];
const PERMITS_COMPLETE_STAGES: ProjectStage[] = [
  "approved_awaiting_construction",
  "under_construction",
  "completed",
];

// Deprecated alias kept only because it's a small, self-contained pure
// function with no reason to force every call site to thread a
// noLongerReported flag through if they don't have one — prefer
// statusBucketForProject below wherever a Project/ProjectDTO is in hand.
export function statusBucketForStage(stage: ProjectStage): StatusBucket {
  if (CANCELLED_SUSPENDED_STAGES.includes(stage)) return "cancelled_suspended";
  if (PERMITS_COMPLETE_STAGES.includes(stage)) return "permits_complete";
  return "in_permitting";
}

// The real bucket function every project-list/filter/stats call site
// should use — noLongerReported takes priority over the stage-derived
// bucket. By construction (see common.ts's vanished-detection logic)
// noLongerReported is only ever true for a project whose last-known stage
// was still non-resolved, so there's no real conflict between the two
// signals in practice, but the flag is checked first regardless.
export function statusBucketForProject(stage: ProjectStage, noLongerReported: boolean): StatusBucket {
  if (noLongerReported) return "no_longer_reported";
  return statusBucketForStage(stage);
}

export const PROJECT_STAGE_BY_VALUE: Record<ProjectStage, string> = Object.fromEntries(
  PROJECT_STAGES.map(({ value, label }) => [value, label]),
) as Record<ProjectStage, string>;

export type VerificationStatus =
  | "verified"
  | "user_submitted_pending"
  | "user_submitted_verified";

export const VERIFICATION_STATUSES: { value: VerificationStatus; label: string }[] = [
  { value: "verified", label: "Verified (primary source)" },
  { value: "user_submitted_verified", label: "User-submitted, verified" },
  { value: "user_submitted_pending", label: "User-submitted, pending review" },
];

export const VERIFICATION_STATUS_BY_VALUE: Record<VerificationStatus, string> = Object.fromEntries(
  VERIFICATION_STATUSES.map(({ value, label }) => [value, label]),
) as Record<VerificationStatus, string>;

export function formatCapacity(value: number | null, unit: string | null): string {
  if (value == null) return "Not disclosed";
  const rounded = value >= 100 ? Math.round(value).toLocaleString("en-US") : value;
  return `${rounded} ${unit ?? ""}`.trim();
}
