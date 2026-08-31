import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { splitStateCodes } from "@/lib/data/usStates";
import { statusBucketForProject, type ProjectStage } from "@/lib/data/taxonomies";

const BASE_URL = "https://waitingforpower.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await prisma.project.findMany({
    select: { slug: true, updatedAt: true, state: true },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/projects`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/states`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/policies`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${BASE_URL}/project/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // One page per state, but only ones with at least one still-waiting
  // project — the state page itself only lists the "in_permitting" bucket
  // (see src/app/state/[code]/page.tsx), so a state whose only tracked
  // projects have already resolved would otherwise be a near-empty page
  // submitted to search engines.
  const statusRows = await prisma.project.findMany({
    select: { state: true, currentStage: true, noLongerReported: true },
  });
  const stateCodes = new Set<string>();
  for (const p of statusRows) {
    if (statusBucketForProject(p.currentStage as ProjectStage, p.noLongerReported) !== "in_permitting") continue;
    for (const code of splitStateCodes(p.state)) stateCodes.add(code);
  }
  const stateRoutes: MetadataRoute.Sitemap = [...stateCodes].map((code) => ({
    url: `${BASE_URL}/state/${code}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...projectRoutes, ...stateRoutes];
}
