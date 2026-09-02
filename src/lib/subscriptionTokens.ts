import { randomBytes } from "crypto";

// Opaque bearer tokens for the confirm/unsubscribe links — not derived from
// the subscription's other fields, so knowing a project id or email doesn't
// help guess one.
export function generateSubscriptionToken(): string {
  return randomBytes(32).toString("hex");
}
