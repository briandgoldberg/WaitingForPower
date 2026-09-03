import { computeGasFilingShareByYear } from "@/lib/gasFilingShare";
import { GasShareChart } from "@/components/blog/GasShareChart";

// Small thumbnail for the /blog index card — same live data as the full
// post, just the compact/no-axis rendering (see GasShareChart).
export async function GasTakingOverNewFilingsPreview() {
  const { years } = await computeGasFilingShareByYear();
  return (
    <div className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <GasShareChart years={years} compact />
    </div>
  );
}
