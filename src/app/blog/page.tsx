import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/data/blogPosts";
import { LeastEfficientStatesPreview } from "@/components/blog/previews/LeastEfficientStatesPreview";
import { FortEdwardSolarPreview } from "@/components/blog/previews/FortEdwardSolarPreview";
import { GasTakingOverNewFilingsPreview } from "@/components/blog/previews/GasTakingOverNewFilingsPreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | WaitingForPower",
  description: "Analysis and findings from WaitingForPower's live dataset of U.S. energy projects waiting on permitting approval.",
};

// Maps a post's slug to its index-card thumbnail — see
// src/app/blog/[slug]/page.tsx's POST_COMPONENTS for the equivalent
// full-post registry these pair with.
const PREVIEW_COMPONENTS: Record<string, React.ComponentType> = {
  "gas-taking-over-new-filings": GasTakingOverNewFilingsPreview,
  "least-efficient-states-for-permitting": LeastEfficientStatesPreview,
  "fort-edward-solar-approved": FortEdwardSolarPreview,
};

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Blog</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Ideas from our data and announcements.</p>
      </div>

      <ul className="flex flex-col gap-4">
        {BLOG_POSTS.map((post) => {
          const Preview = PREVIEW_COMPONENTS[post.slug];
          return (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="flex flex-col sm:flex-row gap-4 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 hover:bg-black/5 dark:hover:bg-white/10"
              >
                {Preview && (
                  <div className="sm:w-40 shrink-0">
                    <Preview />
                  </div>
                )}
                <div>
                  <time dateTime={post.publishedAt} className="text-xs text-[var(--muted)]">
                    {new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
                  </time>
                  <h2 className="text-lg font-semibold mt-1">{post.title}</h2>
                  <p className="text-sm text-[var(--muted)] mt-1">{post.excerpt}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
