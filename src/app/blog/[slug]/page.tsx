import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostMeta } from "@/lib/data/blogPosts";
import { PostToXButton } from "@/components/ShareButtons";
import { LeastEfficientStatesForPermitting } from "@/components/blog/posts/LeastEfficientStatesForPermitting";
import { FortEdwardSolarApproved } from "@/components/blog/posts/FortEdwardSolarApproved";

export const dynamic = "force-dynamic";

// Maps a post's slug to its body component — see src/lib/data/blogPosts.ts
// for the listing metadata (title/excerpt/date) these pair with.
const POST_COMPONENTS: Record<string, React.ComponentType> = {
  "least-efficient-states-for-permitting": LeastEfficientStatesForPermitting,
  "fort-edward-solar-approved": FortEdwardSolarApproved,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getBlogPostMeta(slug);
  if (!meta) return {};
  return {
    title: `${meta.title} | WaitingForPower`,
    description: meta.excerpt,
    openGraph: {
      title: meta.title,
      description: meta.excerpt,
      url: `https://waitingforpower.com/blog/${meta.slug}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = getBlogPostMeta(slug);
  const Body = POST_COMPONENTS[slug];
  if (!meta || !Body) notFound();

  const url = `https://waitingforpower.com/blog/${meta.slug}`;

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6 flex flex-col gap-5">
      <div>
        <Link href="/blog" className="text-xs text-[var(--muted)] hover:underline">
          ← Blog
        </Link>
        <time dateTime={meta.publishedAt} className="block text-xs text-[var(--muted)] mt-2">
          {new Date(meta.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
        </time>
        <h1 className="text-2xl font-bold tracking-tight mt-1">{meta.title}</h1>
      </div>

      <Body />

      <div className="pt-2 border-t border-[var(--border)]">
        <PostToXButton url={url} text={`${meta.title} — waitingforpower.com`} />
      </div>
    </div>
  );
}
