import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton to avoid exhausting SQLite connections
// across hot-reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma Postgres (the Vercel Storage-integration database this project
// uses) only ever offers one connection string — a raw direct connection,
// not a pooled one — and it's owned by the integration, so its value can't
// be edited in Vercel's dashboard (see the "Manage Connection"/"Rotate
// Integration Secrets"-only menu). Capping connection_limit/pool_timeout
// here means every serverless instance opens at most a handful of direct
// connections instead of Prisma's uncapped default pool size, which is what
// exhausted the DB's connection limit and took the whole site down
// (2026-09-14) when a heavy local seeding script ran alongside normal
// traffic. Applied in code, not the env var, so it takes effect in both
// local dev and every Vercel deployment without touching the locked value.
function withConnectionLimit(url: string): string {
  if (/[?&]connection_limit=/.test(url)) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=5&pool_timeout=10`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: withConnectionLimit(process.env.DATABASE_URL ?? "") } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
