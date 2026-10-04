import type { Metadata } from "next";
import { AdvocacyTabs, type AdvocacyTab } from "@/components/advocacy/AdvocacyTabs";
import { NationalAdvocacySection } from "@/components/advocacy/NationalAdvocacySection";
import { PublicHearingsSection } from "@/components/advocacy/PublicHearingsSection";
import { PublicCommentsSection } from "@/components/advocacy/PublicCommentsSection";
import { getAdvocacyProjects } from "@/lib/advocacyProjects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Advocacy — WaitingForPower",
  description:
    "Push for faster energy permitting: email Congress, attend a public hearing, or submit a public comment.",
  alternates: {
    canonical: "/policies",
    types: { "application/rss+xml": "/hearings.rss" },
  },
};

const TABS: AdvocacyTab[] = ["national", "hearings", "comments"];

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; fuel?: string }>;
}) {
  const { tab, fuel } = await searchParams;
  const defaultTab = TABS.find((t) => t === tab) ?? "national";
  // Lets a link elsewhere on the site (e.g. the home page's "Advocate for
  // Solar Projects") land on the Submit Public Comments tab pre-filtered to
  // one or more fuel types — see PublicCommentsSection's own
  // Fuel/technology filter.
  const initialFuelFilter = fuel ? fuel.split(",").map((f) => f.trim()).filter(Boolean) : [];
  const advocacyProjects = await getAdvocacyProjects();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <AdvocacyTabs
        defaultTab={defaultTab}
        nationalAdvocacy={<NationalAdvocacySection />}
        publicHearings={<PublicHearingsSection projects={advocacyProjects} />}
        publicComments={<PublicCommentsSection projects={advocacyProjects} initialFuelFilter={initialFuelFilter} />}
      />
    </div>
  );
}
