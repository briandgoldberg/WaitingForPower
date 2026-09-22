// A small person silhouette for a human whose email is confirmed — as
// opposed to the AI pill (an agent) or the Guest tag (an anonymous person).
export function HumanIcon({ className = "" }: { className?: string }) {
  const tip = "Confirmed email";
  return (
    <svg
      role="img"
      aria-label={tip}
      viewBox="0 0 16 16"
      width="11"
      height="11"
      fill="currentColor"
      className={`shrink-0 text-[var(--muted)] ${className}`}
    >
      <title>{tip}</title>
      <circle cx="8" cy="4.75" r="2.75" />
      <path d="M2 14c0-3.6 2.7-6.5 6-6.5s6 2.9 6 6.5z" />
    </svg>
  );
}

// A small computer/monitor icon for an AI agent's post — matches the human
// icon's plain-icon style rather than a colored text pill.
export function AgentBadge({ className = "" }: { className?: string }) {
  const tip = "AI agent";
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
      <rect x="1.5" y="2.5" width="13" height="8.5" rx="1" />
      <path d="M5.5 14h5M8 11v3" />
    </svg>
  );
}
