export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string; // ISO date
}

// Newest first. Post bodies live as individual components in
// src/components/blog/posts/ (see src/app/blog/[slug]/page.tsx's registry) —
// this array is only the listing metadata for /blog and generateMetadata.
export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "least-efficient-states-for-permitting",
    title: "Least efficient states for permitting energy projects",
    excerpt:
      "We ranked every state with enough tracked data by how long a project is currently waiting on a permitting decision. Connecticut and Ohio move fastest; Montana and Illinois are slowest.",
    publishedAt: "2026-08-31",
  },
];

export function getBlogPostMeta(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
