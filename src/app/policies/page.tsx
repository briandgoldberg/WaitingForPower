import type { Metadata } from "next";
import { AdvocacyTabs, type AdvocacyTab } from "@/components/advocacy/AdvocacyTabs";
import { NationalAdvocacySection } from "@/components/advocacy/NationalAdvocacySection";
import { StateAdvocacySection } from "@/components/advocacy/StateAdvocacySection";
import { ProjectAdvocacySection } from "@/components/advocacy/ProjectAdvocacySection";
import { PublicHearingsSection } from "@/components/advocacy/PublicHearingsSection";
import { getUpcomingPublicHearingGroups } from "@/lib/hearings";
import { getAdvocacyProjects } from "@/lib/advocacyProjects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Advocacy — WaitingForPower",
  description:
    "Push for faster energy permitting: national policies, your state regulator, the projects that have waited longest, and real public hearings you can attend.",
  alternates: {
    canonical: "/policies",
    types: { "application/rss+xml": "/hearings.rss" },
  },
};

const TABS: AdvocacyTab[] = ["national", "state", "project", "hearings"];

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const defaultTab = TABS.find((t) => t === tab) ?? "national";
  const [hearingGroups, advocacyProjects] = await Promise.all([getUpcomingPublicHearingGroups(), getAdvocacyProjects()]);
  const hearingCount = hearingGroups.reduce((n, g) => n + g.hearings.length, 0);

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <AdvocacyTabs
        defaultTab={defaultTab}
        hearingCount={hearingCount}
        nationalAdvocacy={<NationalAdvocacySection />}
        stateAdvocacy={<StateAdvocacySection />}
        projectAdvocacy={<ProjectAdvocacySection projects={advocacyProjects} />}
        publicHearings={<PublicHearingsSection groups={hearingGroups} />}
      />
    </div>
  );
}
