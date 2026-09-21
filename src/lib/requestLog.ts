import { createHash } from "crypto";

// Extra detail for ApiRequestLog rows so "how many real questions, from how
// many distinct callers" is answerable: which MCP method and tool, the
// client's self-reported name, a salted hash of the caller's IP (repeat
// callers can be counted without ever storing an address), and an optional
// ?src= tag naming the channel a link came from.

const MAX_BODY_CHARS = 64_000;

export interface RequestDetails {
  rpcMethod: string | null;
  toolName: string | null;
  clientName: string | null;
  ipHash: string | null;
  src: string | null;
}

// Salted with a server-side secret, so the hash can't be reversed by
// enumerating IPv4 space without that secret. Stable (no daily rotation) on
// purpose: the point is counting callers across days.
export function hashIp(req: Request): string | null {
  const secret = process.env.IP_HASH_SALT ?? process.env.CRON_SECRET;
  if (!secret) return null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`wfp-ip:${secret}:${ip}`).digest("hex").slice(0, 24);
}

export function srcTag(req: Request): string | null {
  try {
    const v = new URL(req.url).searchParams.get("src");
    return v ? v.slice(0, 40).replace(/[^\w.-]/g, "") || null : null;
  } catch {
    return null;
  }
}

type RpcMessage = { method?: unknown; params?: { name?: unknown; clientInfo?: { name?: unknown } } };

// Reads a JSON-RPC body (single message or batch) for the method, the tool
// called, and the client name sent with `initialize`. Never throws.
export function describeRpcBody(text: string): Pick<RequestDetails, "rpcMethod" | "toolName" | "clientName"> {
  const out = { rpcMethod: null as string | null, toolName: null as string | null, clientName: null as string | null };
  if (!text || text.length > MAX_BODY_CHARS) return out;
  try {
    const parsed = JSON.parse(text) as RpcMessage | RpcMessage[];
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    const methods: string[] = [];
    for (const m of messages) {
      if (typeof m?.method !== "string") continue;
      if (!methods.includes(m.method)) methods.push(m.method);
      if (m.method === "tools/call" && !out.toolName && typeof m.params?.name === "string") out.toolName = m.params.name.slice(0, 80);
      if (m.method === "initialize" && !out.clientName && typeof m.params?.clientInfo?.name === "string") {
        out.clientName = m.params.clientInfo.name.slice(0, 80);
      }
    }
    out.rpcMethod = methods.join(",").slice(0, 120) || null;
  } catch {
    // not JSON-RPC; leave nulls
  }
  return out;
}
