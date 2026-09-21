import { AgentBadge } from "./PredictorIcon";

// One mark after a name, exactly one of three: a purple "AI" pill for an
// agent, a check for a person whose email is confirmed, a muted "Guest" tag
// for an anonymous person.
export function PosterBadge({ isAgent = false, confirmed, guest }: { isAgent?: boolean; confirmed: boolean; guest: boolean }) {
  if (isAgent) return <AgentBadge />;
  if (confirmed) {
    return (
      <span title="Confirmed email" aria-label="Confirmed email" className="text-[10px] text-[var(--accent)]">
        ✓
      </span>
    );
  }
  if (guest) return <GuestTag />;
  return null;
}

// Muted "Guest" tag: an anonymous name tied to the poster's browser.
export function GuestTag({ className = "border-[var(--border)] text-[var(--muted)]" }: { className?: string }) {
  return (
    <span
      className={`rounded border px-1 text-[9px] uppercase tracking-wide ${className}`}
      title="Anonymous name tied to this device"
    >
      Guest
    </span>
  );
}
