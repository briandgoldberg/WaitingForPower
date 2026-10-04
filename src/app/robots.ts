import type { MetadataRoute } from "next";

// Deliberately permissive — this site wants to be crawled, cited, and
// queried by AI agents (see /llms.txt), not just indexed for human search.
// The wildcard rule already allows everyone; known AI crawlers are listed
// explicitly anyway so the intent is visible to anyone reading this file,
// human or agent, not just implied by omission.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // /test1 is an unannounced internal feed, not a page meant to be
      // crawled or cited — disallowed here too, on top of its own noindex,
      // since it's not linked from anywhere a crawler would find it.
      { userAgent: "*", allow: "/", disallow: "/test1" },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "anthropic-ai",
          "PerplexityBot",
          "Google-Extended",
          "CCBot",
          "Bytespider",
          "Amazonbot",
        ],
        allow: "/",
        disallow: "/test1",
      },
    ],
    sitemap: "https://waitingforpower.com/sitemap.xml",
    host: "https://waitingforpower.com",
  };
}
