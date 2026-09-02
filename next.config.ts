import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // www and the apex domain were both serving identical content with no
  // canonical tag (confirmed via curl: both return HTTP 200, no redirect) —
  // Google Search Console flagged this as "Duplicate without user-selected
  // canonical" and was splitting indexing between the two. Every URL in
  // this site's own metadata/sitemap (layout.tsx, sitemap.ts, etc.) uses
  // the apex domain, so www redirects there.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.waitingforpower.com" }],
        destination: "https://waitingforpower.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
