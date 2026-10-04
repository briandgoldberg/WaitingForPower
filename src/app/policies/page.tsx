import type { Metadata } from "next";
import { AdvocacyTabs, type AdvocacyTab } from "@/components/advocacy/AdvocacyTabs";
import { NationalAdvocacySection } from "@/components/advocacy/NationalAdvocacySection";
import { ProjectAdvocacySection } from "@/components/advocacy/ProjectAdvocacySection";
import { getAdvocacyProjects } from "@/lib/advocacyProjects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Advocacy — WaitingForPower",
  description:
    "Push for faster energy permitting: national policies, the projects that have waited longest, and real public hearings you can attend.",
  alternates: {
    canonical: "/policies",
    types: { "application/rss+xml": "/hearings.rss" },
  },
};

const TABS: AdvocacyTab[] = ["project", "national"];

// Lets a link elsewhere on the site (e.g. the home page) land directly on one
// of the Projects tab's comment-likelihood buckets — see SHORT_LIKELIHOOD_LABELS
// and BUCKET_SCORE in ProjectAdvocacySection for what each bucket shows.
const COMMENT_BUCKETS: Record<string, number> = { all: 0, unlikely: 1, maybe: 2, confirmed: 3 };

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; comments?: string; upcoming?: string; fuel?: string }>;
}) {
  const { tab, comments, upcoming, fuel } = await searchParams;
  // The old Public Hearings tab was folded into Projects.
  const defaultTab = TABS.find((t) => t === tab) ?? "national";
  const initialBucket = comments ? (COMMENT_BUCKETS[comments] ?? 0) : 0;
  const initialUpcomingOnly = upcoming === "1";
  // Lets a link elsewhere on the site (e.g. the home page's "Advocate for
  // Solar Projects") land on this tab pre-filtered to one or more fuel
  // types — see ProjectAdvocacySection's own Fuel/technology filter.
  const initialFuelFilter = fuel ? fuel.split(",").map((f) => f.trim()).filter(Boolean) : [];
  const advocacyProjects = await getAdvocacyProjects();

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <AdvocacyTabs
        defaultTab={defaultTab}
        nationalAdvocacy={<NationalAdvocacySection />}
        projectAdvocacy={
          <ProjectAdvocacySection
            projects={advocacyProjects}
            initialBucket={initialBucket}
            initialUpcomingOnly={initialUpcomingOnly}
            initialFuelFilter={initialFuelFilter}
          />
        }
      />
    </div>
  );
}
