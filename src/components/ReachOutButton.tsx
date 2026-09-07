"use client";

import { OPEN_FEEDBACK_EVENT } from "@/components/FeedbackWidget";

// Replaces the old /contact page link — opens the same feedback widget
// every other "give feedback" surface on the site uses, rather than a
// separate contact form.
export function ReachOutButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT))}
      className="underline"
    >
      Reach out
    </button>
  );
}
