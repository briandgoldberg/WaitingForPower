import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/data/blogPosts";

export const metadata: Metadata = {
  title: "Blog | WaitingForPower",
  description: "Analysis and findings from WaitingForPower's live dataset of U.S. energy projects waiting on permitting approval.",
};

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Blog</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Analysis and findings pulled directly from the live dataset.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <time dateTime={post.publishedAt} className="text-xs text-[var(--muted)]">
                {new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
              </time>
              <h2 className="text-lg font-semibold mt-1">{post.title}</h2>
              <p className="text-sm text-[var(--muted)] mt-1">{post.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
