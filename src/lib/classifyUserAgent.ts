// Classifies an ApiRequestLog user-agent as real usage vs. the MCP
// directory/registry crawler ecosystem that dominates raw call counts —
// see the 2026-09-08 hand audit that found ~79% of a day's /mcp traffic
// was self-described liveness/health/census bots (SentinelOracle alone was
// 40% of one day's total). Built to stop the daily digest's raw call count
// from reading as "usage" when it's mostly discovery-bot noise.
//
// Heuristic, not a proof: a UA can lie. This only classifies what a
// well-behaved client's own string says about itself, the same signal
// used in every hand audit so far. "ambiguous" (bare curl/node/python
// clients with no identifying string) is its own bucket rather than
// folded into either side, since intent genuinely can't be read from the
// log alone — see the 2026-09-07 audit for why that distinction mattered.

const BOT_KEYWORDS = [
  "bot", "probe", "crawler", "monitor", "census", "audit", "watch",
  "witness", "check", "spike", "tripwire", "scan", "liveness", "health",
  "index", "observatory", "reputation", "trust", "drift", "beat",
];

const AMBIGUOUS_EXACT_PREFIXES = ["node", "undici", "curl/", "python-httpx", "go-http-client", "deno"];

export type UserAgentClass = "bot" | "ambiguous" | "real";

export function classifyUserAgent(ua: string | null): UserAgentClass {
  if (!ua || ua.trim() === "") return "ambiguous";
  const lower = ua.toLowerCase();
  if (BOT_KEYWORDS.some((k) => lower.includes(k))) return "bot";
  if (AMBIGUOUS_EXACT_PREFIXES.some((p) => lower.startsWith(p))) return "ambiguous";
  return "real";
}
