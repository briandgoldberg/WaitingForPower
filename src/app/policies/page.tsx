import type { Metadata } from "next";
import { AdvocacyTabs, type AdvocacyTab } from "@/components/advocacy/AdvocacyTabs";
import { NationalAdvocacySection } from "@/components/advocacy/NationalAdvocacySection";
import { PublicHearingsSection } from "@/components/advocacy/PublicHearingsSection";
import { PublicCommentsSection } from "@/components/advocacy/PublicCommentsSection";
import { ReadPublicCommentsSection } from "@/components/advocacy/ReadPublicCommentsSection";
import { getAdvocacyProjects } from "@/lib/advocacyProjects";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Advocacy — WaitingForPower",
  description:
    "Push for faster energy permitting: email Congress, attend a public hearing, submit a public comment, or read what others are telling regulators.",
  alternates: {
    canonical: "/policies",
    types: { "application/rss+xml": "/hearings.rss" },
  },
};

const TABS: AdvocacyTab[] = ["national", "hearings", "comments", "read-comments"];
const READ_COMMENTS_PAGE_SIZE = 100;

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

  const [commentRows, commentTotal] = await Promise.all([
    prisma.publicComment.findMany({
      orderBy: { filedDate: "desc" },
      take: READ_COMMENTS_PAGE_SIZE,
      select: {
        id: true,
        filedDate: true,
        filerName: true,
        title: true,
        sourceUrl: true,
        docketLabel: true,
        project: { select: { name: true, slug: true, state: true } },
      },
    }),
    prisma.publicComment.count(),
  ]);
  const readableComments = commentRows.map((c) => ({
    id: c.id,
    filedDate: c.filedDate.toISOString(),
    filerName: c.filerName,
    title: c.title,
    sourceUrl: c.sourceUrl,
    docketLabel: c.docketLabel,
    projectName: c.project.name,
    projectSlug: c.project.slug,
    projectState: c.project.state,
  }));

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <AdvocacyTabs
        defaultTab={defaultTab}
        nationalAdvocacy={<NationalAdvocacySection />}
        publicHearings={<PublicHearingsSection projects={advocacyProjects} />}
        publicComments={<PublicCommentsSection projects={advocacyProjects} initialFuelFilter={initialFuelFilter} />}
        readPublicComments={<ReadPublicCommentsSection comments={readableComments} total={commentTotal} />}
      />
    </div>
  );
}
