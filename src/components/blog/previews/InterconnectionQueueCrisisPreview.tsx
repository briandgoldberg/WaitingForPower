import { computeInterconnectionQueueCrisis } from "@/lib/interconnectionQueueCrisis";
import { QueueGrowthChart } from "@/components/blog/QueueGrowthChart";

// Small thumbnail for the /blog index card — same live data as the full
// post, just the compact/no-axis rendering (see QueueGrowthChart).
export async function InterconnectionQueueCrisisPreview() {
  const { years } = await computeInterconnectionQueueCrisis();
  return (
    <div className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <QueueGrowthChart years={years} compact />
    </div>
  );
}
