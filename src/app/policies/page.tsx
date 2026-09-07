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
  alternates: {
    canonical: "/policies",
    types: { "application/rss+xml": "/hearings.rss" },
  },
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
      <AdvocacyTabs
        defaultTab={defaultTab}
        hearingCount={hearingCount}
        nationalAdvocacy={<NationalAdvocacySection />}
        publicHearings={<PublicHearingsSection groups={hearingGroups} />}
      />
    </div>
  );
}
