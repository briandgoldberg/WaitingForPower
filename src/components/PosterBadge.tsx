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
  if (guest) return <DeviceIcon />;
  return null;
}

// A tiny laptop: this name is an anonymous handle tied to the poster's browser.
export function DeviceIcon({ className = "" }: { className?: string }) {
  const tip = "Anonymous name tied to this device";
  return (
    <svg
      role="img"
      aria-label={tip}
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-[var(--muted)] ${className}`}
    >
      <title>{tip}</title>
      <rect x="3" y="3.5" width="10" height="7" rx="1" />
      <path d="M1.5 13h13" />
    </svg>
  );
}
