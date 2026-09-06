// Domain-ownership proof for the official MCP Registry (registry.modelcontextprotocol.io) —
// lets this site publish its MCP server under the `com.waitingforpower/*`
// namespace via HTTP-challenge verification instead of GitHub OAuth. See
// https://modelcontextprotocol.io/registry/publishing/authentication.
// The value below is a public key only (not a secret) — its matching
// private key is held outside the repo and used just to sign the registry
// login request, never committed.
export const dynamic = "force-static";

const BODY = "v=MCPv1; k=ed25519; p=UNCMO+xvRFbyjBXZQC54p3A8s0XhA+8BUfjsQ2kPQFY=";

export async function GET() {
  return new Response(BODY, { headers: { "Content-Type": "text/plain" } });
}
