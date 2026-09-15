// Domain-ownership proof for the official MCP Registry (registry.modelcontextprotocol.io) —
// lets this site publish its MCP server under the `com.waitingforpower/*`
// namespace via HTTP-challenge verification instead of GitHub OAuth. See
// https://modelcontextprotocol.io/registry/publishing/authentication.
// The value below is a public key only (not a secret) — its matching
// private key is held outside the repo and used just to sign the registry
// login request, never committed.
// Rotated 2026-09-14: the original private key wasn't recoverable (kept
// outside the repo, as this file's own comment always said, and never
// located), so this is a fresh keypair replacing the old one entirely.
export const dynamic = "force-static";

const BODY = "v=MCPv1; k=ed25519; p=qG5WCtSQVHkV+s5hu68UEDxfE8OdpROBw8j9xDfWGLQ=";

export async function GET() {
  return new Response(BODY, { headers: { "Content-Type": "text/plain" } });
}
