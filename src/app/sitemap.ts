import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { splitStateCodes } from "@/lib/data/usStates";
import { statusBucketForProject, type ProjectStage } from "@/lib/data/taxonomies";
import { BLOG_POSTS } from "@/lib/data/blogPosts";

const BASE_URL = "https://waitingforpower.com";

// Bumped whenever a change to the shared project-page template (title,
// layout, metadata — anything rendered from code rather than from a
// project's own row) should count as a real content change for every
// project URL's sitemap lastmod, without writing to Project.updatedAt —
// that column is also the cron-health heartbeat (src/app/api/health/crons/
// route.ts), so bulk-touching it there would mask a genuinely broken
// ingest cron for up to its staleness threshold (36h-9d).
const PROJECT_TEMPLATE_UPDATED_AT = new Date("2026-09-29T20:44:36-07:00"); // status-first search titles/descriptions (#25)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await prisma.project.findMany({
    where: { mergedIntoId: null },
    select: { slug: true, updatedAt: true, state: true },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/projects`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/states`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/policies`, changeFrequency: "monthly", priority: 0.6 },
    // Individual topic threads (/board/{id}) are deliberately not enumerated
    // here, same reasoning as project comments never getting their own
    // sitemap entry — unmoderated UGC, discoverable via this hub page's
    // own links rather than proactively submitted one by one. /board itself
    // now just redirects here (see src/app/board/page.tsx).
    { url: `${BASE_URL}/activity`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/data-licensing`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${BASE_URL}/project/${p.slug}`,
    lastModified: p.updatedAt > PROJECT_TEMPLATE_UPDATED_AT ? p.updatedAt : PROJECT_TEMPLATE_UPDATED_AT,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // One page per state, but only ones with at least one still-waiting
  // project — the state page itself only lists the "in_permitting" bucket
  // (see src/app/state/[code]/page.tsx), so a state whose only tracked
  // projects have already resolved would otherwise be a near-empty page
  // submitted to search engines.
  const statusRows = await prisma.project.findMany({
    where: { mergedIntoId: null },
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

  const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...projectRoutes, ...stateRoutes, ...blogRoutes];
}
