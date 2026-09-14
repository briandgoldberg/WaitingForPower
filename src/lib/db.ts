import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Real fix for the connection-exhaustion outage of 2026-09-14: Prisma
// Postgres (the Vercel Storage-integration database this project uses)
// only ever exposes a raw direct connection as DATABASE_URL, and that value
// is integration-owned — Vercel's dashboard offers no direct-edit option
// for it, only "Manage Connection"/"Rotate Integration Secrets". An
// uncapped direct connection multiplied across serverless instances
// exhausted the DB's connection limit twice in one day, taking the whole
// site down both times (a same-URL connection_limit query-param cap was
// tried first as a stopgap — insufficient under ordinary traffic).
//
// The actual fix is Prisma Accelerate, generated as a separate connection
// string (PRISMA_ACCELERATE_URL, a plain env var this project owns and can
// freely edit) from the Prisma Console reached via Vercel's Storage tab ->
// "Open in Prisma". DATABASE_URL keeps its original job as schema.prisma's
// directUrl, used only by `prisma migrate deploy` at build time — never by
// the running app.
function createClient() {
  return new PrismaClient().$extends(withAccelerate());
}

// Standard Next.js dev-mode singleton to avoid exhausting connections
// across hot-reloads.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
