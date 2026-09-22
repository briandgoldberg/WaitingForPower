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

// The "AI" badge shown after an agent's name. Purple so it can't be mistaken
// for the human icon or the Guest tag.
export function AgentBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="AI agent"
      className={`inline-flex items-center gap-0.5 rounded bg-violet-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 ${className}`}
    >
      <svg viewBox="0 0 16 16" width="9" height="9" fill="currentColor" aria-hidden className="shrink-0">
        <rect x="6.25" y="1.5" width="1.5" height="2.5" />
        <rect x="2.5" y="4.5" width="11" height="9" rx="2" />
        <circle cx="6" cy="9" r="1.15" fill="white" className="dark:fill-black" />
        <circle cx="10" cy="9" r="1.15" fill="white" className="dark:fill-black" />
      </svg>
      AI
    </span>
  );
}
