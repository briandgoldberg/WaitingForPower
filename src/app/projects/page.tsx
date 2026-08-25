import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import { Explorer } from "@/components/Explorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects — WaitingForPower",
  description:
    "Explore every U.S. energy project WaitingForPower tracks — map and list views, filterable by state, status, fuel type, and permitting stage.",
};

// schema.org Dataset markup — lets search engines and AI agents identify
// this as a queryable dataset (with a machine-readable distribution) rather
// than just a webpage. See also /llms.txt and /api/projects.
const DATASET_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "WaitingForPower: U.S. Energy Project Permitting Tracker",
  description:
    "Live, sourced dataset of U.S. energy projects — generation, transmission, storage, LNG, and pipelines, every fuel type — currently stuck waiting on permitting approval, merged from public federal/state sources and refreshed automatically.",
  url: "https://waitingforpower.com/projects",
  license: "https://github.com/briandgoldberg/WaitingForPower/blob/main/LICENSE",
  creator: { "@type": "Person", name: "Brian Goldberg" },
  spatialCoverage: { "@type": "Place", name: "United States" },
  keywords: [
    "energy",
    "permitting reform",
    "renewable energy",
    "transmission",
    "solar",
    "wind",
    "pipelines",
    "clean energy",
    "infrastructure",
  ],
  distribution: {
    "@type": "DataDownload",
    encodingFormat: "application/json",
    contentUrl: "https://waitingforpower.com/api/projects",
  },
};

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: { causes: true, sources: true, milestones: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET_JSON_LD) }}
      />
      <Explorer projects={projects.map(serializeProject)} />
    </>
  );
}
