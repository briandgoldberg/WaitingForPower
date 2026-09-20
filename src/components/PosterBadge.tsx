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
