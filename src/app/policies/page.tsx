import type { Metadata } from "next";
import { AdvocacyTabs } from "@/components/advocacy/AdvocacyTabs";
import { NationalAdvocacySection } from "@/components/advocacy/NationalAdvocacySection";
import { PublicHearingsSection } from "@/components/advocacy/PublicHearingsSection";
import { getUpcomingPublicHearingGroups } from "@/lib/hearings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Advocacy — WaitingForPower",
  description:
    "Push for faster energy permitting two ways: six bipartisan national policies, and real public hearings happening now that you can attend.",
  alternates: { canonical: "/policies" },
};

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const defaultTab = tab === "hearings" ? "hearings" : "national";
  const hearingGroups = await getUpcomingPublicHearingGroups();
  const hearingCount = hearingGroups.reduce((n, g) => n + g.hearings.length, 0);

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Advocacy</h1>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">
          Two ways to push for faster, better energy permitting: national policy change, and
          showing up to the hearings happening right now.
        </p>
      </div>

      <AdvocacyTabs
        defaultTab={defaultTab}
        hearingCount={hearingCount}
        nationalAdvocacy={<NationalAdvocacySection />}
        publicHearings={<PublicHearingsSection groups={hearingGroups} />}
      />
    </div>
  );
}
