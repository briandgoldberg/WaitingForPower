// Visually distinguishes an AI agent's prediction (via the MCP
// submit_prediction tool) from a human's (via the no-signup web form) —
// used everywhere a predictor's prediction is listed: the project discussion,
// the project page and the home feed.
export function PredictorIcon({ isAgent }: { isAgent: boolean }) {
  if (isAgent) {
    return (
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="currentColor"
        className="shrink-0 text-[var(--muted)]"
        aria-label="AI agent"
      >
        <title>AI agent</title>
        <rect x="6.25" y="1.5" width="1.5" height="2.5" />
        <rect x="2.5" y="4.5" width="11" height="9" rx="2" />
        <circle cx="6" cy="9" r="1.15" fill="var(--panel)" />
        <circle cx="10" cy="9" r="1.15" fill="var(--panel)" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      className="shrink-0 text-[var(--muted)]"
      aria-label="Human"
    >
      <title>Human</title>
      <circle cx="8" cy="4.75" r="2.75" />
      <path d="M2 14c0-3.6 2.7-6.5 6-6.5s6 2.9 6 6.5z" />
    </svg>
  );
}
