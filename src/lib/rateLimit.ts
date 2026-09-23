// A simple, DB-backed sliding-window rate limit for the site's
// programmatic/agent-facing endpoints (see src/app/mcp/route.ts and the
// /api/projects, /api/export, /api/snapshots routes). This project has no
// Redis/KV store, and Fluid Compute doesn't guarantee shared in-memory state
// across invocations of the same function, so this leans on the
// ApiRequestLog table every one of those routes already writes to for usage
// tracking — one extra indexed count() query per request, cheap next to the
// real work each of these routes does, and durable across cold starts.
//
// Deliberately fails open: a caller we can't identify (no ipHash, e.g.
// IP_HASH_SALT unset in local dev) is never blocked, since the point is
// stopping a single runaway caller, not gating everyone behind a signal
// that's sometimes absent.

import { prisma } from "@/lib/db";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export async function isRateLimited(endpoint: string, ipHash: string | null, opts: RateLimitOptions): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - opts.windowMs);
  try {
    const count = await prisma.apiRequestLog.count({ where: { endpoint, ipHash, createdAt: { gte: since } } });
    return count > opts.max;
  } catch (err) {
    // A rate-limit check failing must never take the real endpoint down.
    console.error(`Rate limit check failed for ${endpoint}:`, err);
    return false;
  }
}

export function rateLimitedResponse(retryAfterSeconds: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", message: "Too many requests. Please slow down and try again shortly." }),
    {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(retryAfterSeconds), ...extraHeaders },
    },
  );
}
