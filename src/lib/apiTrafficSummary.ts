import { classifyUserAgent, type UserAgentClass } from "@/lib/classifyUserAgent";

// Turns a day of ApiRequestLog rows into what the daily digest needs to be
// useful: who called (grouped by caller, not by raw request), whether they
// are new, how far into an MCP session they got, and what they actually
// asked. Raw per-endpoint counts alone said "1940 mcp calls", which
// answers nothing — most of it is a handful of callers handshaking.

export interface ApiLogRow {
  createdAt: Date;
  endpoint: string;
  userAgent: string | null;
  query: string | null;
  rpcMethod: string | null;
  toolName: string | null;
  clientName: string | null;
  ipHash: string | null;
  src: string | null;
}

export interface ApiCaller {
  label: string;
  cls: UserAgentClass;
  // False when this caller's ipHash appeared before the window; null when
  // there's no ipHash to tell (rows logged without IP_HASH_SALT/CRON_SECRET).
  isNew: boolean | null;
  calls: number;
  endpoints: string[];
  // Furthest MCP step reached: connected < initialize < tools/list < tools/call.
  mcpStage: "connected" | "initialized" | "listed tools" | "called tools" | null;
  tools: { name: string; count: number }[];
}

export interface ApiQuestion {
  at: Date;
  caller: string;
  what: string;
  // Identical calls from the same caller are collapsed into one line.
  count: number;
}

export interface ApiTrafficSummary {
  totalCalls: number;
  callsByClass: Record<UserAgentClass, number>;
  callersByClass: Record<UserAgentClass, number>;
  newCallers: number;
  // Non-crawler MCP callers only, so the funnel reflects possible real use.
  mcpFunnel: { connected: number; initialized: number; listedTools: number; calledTools: number };
  toolCalls: { name: string; calls: number; callers: number }[];
  // Non-crawler callers, most active first.
  callers: ApiCaller[];
  // Individual non-crawler tool calls and REST queries, oldest first.
  questions: ApiQuestion[];
  sources: { src: string; count: number }[];
}

const STAGES = ["connected", "initialized", "listed tools", "called tools"] as const;

const RANK: Record<UserAgentClass, number> = { real: 0, ambiguous: 1, bot: 2 };

function callerKey(r: ApiLogRow): string {
  return r.ipHash ? `ip:${r.ipHash}` : `ua:${r.userAgent ?? ""}`;
}

function shortUa(ua: string | null): string {
  if (!ua) return "(no user-agent)";
  if (ua.startsWith("Mozilla/")) {
    if (ua.includes("iPhone")) return "iPhone browser";
    if (ua.includes("Android")) return "Android browser";
    if (ua.includes("Mac OS X")) return "Mac browser";
    if (ua.includes("Windows")) return "Windows browser";
    return "browser";
  }
  return ua.length > 70 ? `${ua.slice(0, 70)}…` : ua;
}

export function summarizeApiTraffic(rows: ApiLogRow[], priorIpHashes: Set<string>, limits = { callers: 15, questions: 40 }): ApiTrafficSummary {
  const groups = new Map<string, ApiLogRow[]>();
  for (const r of rows) {
    const k = callerKey(r);
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }

  const callsByClass: Record<UserAgentClass, number> = { real: 0, ambiguous: 0, bot: 0 };
  const callersByClass: Record<UserAgentClass, number> = { real: 0, ambiguous: 0, bot: 0 };
  const mcpFunnel = { connected: 0, initialized: 0, listedTools: 0, calledTools: 0 };
  const toolTotals = new Map<string, { calls: number; callers: Set<string> }>();
  const sourceCounts = new Map<string, number>();
  const callers: ApiCaller[] = [];
  const questionMap = new Map<string, ApiQuestion>();
  const addQuestion = (at: Date, caller: string, callerKeyStr: string, what: string) => {
    const k = `${callerKeyStr}\n${what}`;
    const q = questionMap.get(k);
    if (q) q.count++;
    else questionMap.set(k, { at, caller, what, count: 1 });
  };
  let newCallers = 0;

  for (const [key, g] of groups) {
    const clientName = g.find((r) => r.clientName)?.clientName ?? null;
    const ua = g.find((r) => r.userAgent)?.userAgent ?? null;
    // A caller is a crawler if either its UA or its self-reported MCP
    // client name says so; otherwise take the most "real" UA it used.
    const classes = [...new Set(g.map((r) => classifyUserAgent(r.userAgent)))];
    if (clientName) classes.push(classifyUserAgent(clientName));
    const cls: UserAgentClass = classes.includes("bot") ? "bot" : classes.sort((a, b) => RANK[a] - RANK[b])[0];

    const ipHash = g[0].ipHash;
    const isNew = ipHash ? !priorIpHashes.has(ipHash) : null;
    if (isNew) newCallers++;
    callsByClass[cls] += g.length;
    callersByClass[cls]++;

    for (const r of g) if (r.src) sourceCounts.set(r.src, (sourceCounts.get(r.src) ?? 0) + 1);
    if (cls === "bot") continue;

    const label = clientName && ua ? `${clientName} · ${shortUa(ua)}` : clientName ?? shortUa(ua);
    const mcpRows = g.filter((r) => r.endpoint === "mcp");
    let stage = -1;
    const tools = new Map<string, number>();
    for (const r of mcpRows) {
      const methods = r.rpcMethod?.split(",") ?? [];
      stage = Math.max(stage, 0);
      if (methods.includes("initialize")) stage = Math.max(stage, 1);
      if (methods.includes("tools/list")) stage = Math.max(stage, 2);
      if (r.toolName) {
        stage = 3;
        tools.set(r.toolName, (tools.get(r.toolName) ?? 0) + 1);
        const t = toolTotals.get(r.toolName) ?? { calls: 0, callers: new Set<string>() };
        t.calls++;
        t.callers.add(key);
        toolTotals.set(r.toolName, t);
        addQuestion(r.createdAt, label, key, `${r.toolName}(${r.query ?? ""})`);
      }
    }
    if (stage >= 0) mcpFunnel.connected++;
    if (stage >= 1) mcpFunnel.initialized++;
    if (stage >= 2) mcpFunnel.listedTools++;
    if (stage >= 3) mcpFunnel.calledTools++;

    for (const r of g) {
      if (r.endpoint !== "mcp" && r.query) addQuestion(r.createdAt, label, key, `${r.endpoint}?${r.query}`);
    }

    callers.push({
      label,
      cls,
      isNew,
      calls: g.length,
      endpoints: [...new Set(g.map((r) => r.endpoint))],
      mcpStage: stage >= 0 ? STAGES[stage] : null,
      tools: [...tools.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    });
  }

  // Real before ambiguous, then callers that got furthest (actually called
  // tools), then by volume.
  callers.sort(
    (a, b) =>
      RANK[a.cls] - RANK[b.cls] ||
      (b.mcpStage ? STAGES.indexOf(b.mcpStage) : -1) - (a.mcpStage ? STAGES.indexOf(a.mcpStage) : -1) ||
      b.calls - a.calls,
  );
  const questions = [...questionMap.values()].sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    totalCalls: rows.length,
    callsByClass,
    callersByClass,
    newCallers,
    mcpFunnel,
    toolCalls: [...toolTotals.entries()]
      .map(([name, t]) => ({ name, calls: t.calls, callers: t.callers.size }))
      .sort((a, b) => b.calls - a.calls),
    callers: callers.slice(0, limits.callers),
    questions: questions.slice(0, limits.questions),
    sources: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([src, count]) => ({ src, count })),
  };
}
