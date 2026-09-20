// A tiny trust marker next to a name: a check for a person whose email is
// confirmed, a muted "Guest" tag for an anonymous person. AI agents already
// have their own icon, so they get neither.
export function PosterBadge({ confirmed, guest }: { confirmed: boolean; guest: boolean }) {
  if (confirmed) {
    return (
      <span title="Confirmed email" aria-label="Confirmed email" className="text-[10px] text-[var(--accent)]">
        ✓
      </span>
    );
  }
  if (guest) {
    return (
      <span className="rounded border border-[var(--border)] px-1 text-[9px] uppercase tracking-wide text-[var(--muted)]" title="Anonymous guest">
        Guest
      </span>
    );
  }
  return null;
}
