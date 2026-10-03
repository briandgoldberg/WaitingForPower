// Shared identity plumbing for every user-generated-content surface on the
// site (currently just the Message Board). One identity (Predictor) covers
// all of it: an anonymous browser key plus a name that is asked for once and
// then locked, optionally upgraded to a saved email profile. (Predictor is
// still the model name — this site used to also run a prediction game, and
// before that a project-comments/advocacy-log feature, on the same identity;
// both are gone, the name stuck.)
import { prisma } from "@/lib/db";

export interface IdentityStatus {
  label: string;
  emailConfirmed: boolean;
  nameChosen: boolean;
  decided: boolean;
}

// The same "who is posting, and have they decided how to appear" check,
// factored out so any UGC surface can ask the same question via GET
// /api/identity. Never creates a Predictor row — only actually posting does
// that (see submitTopic/submitReply in forum.ts) — so a first-time visitor
// who hasn't posted anything yet gets null, not a freshly minted row.
export async function getIdentityStatus(anonymousKey: string): Promise<IdentityStatus | null> {
  const me = await prisma.predictor.findUnique({
    where: { anonymousKey },
    select: { displayName: true, email: true, nameChosenAt: true, identityDecidedAt: true },
  });
  if (!me) return null;
  return {
    label: me.displayName ?? "Anonymous",
    emailConfirmed: me.email != null,
    nameChosen: me.nameChosenAt != null,
    decided: me.identityDecidedAt != null,
  };
}

// Shared across every UGC surface so identity renders the exact same way
// everywhere (currently just forum.ts's Board topics/replies).
export function labelOf(p: { displayName: string | null; agentName: string | null }): string {
  return p.displayName ?? p.agentName ?? "anonymous";
}

export function isHeld(p: { agentName: string | null; identityDecidedAt: Date | null }): boolean {
  return p.agentName == null && p.identityDecidedAt == null;
}

export function flagsOf(p: { agentName: string | null; email: string | null }): { confirmed: boolean; guest: boolean } {
  const human = p.agentName == null;
  return { confirmed: human && p.email != null, guest: human && p.email == null };
}
