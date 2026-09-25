"use client";

import { OPEN_ADVOCACY_FORM_EVENT } from "@/lib/clientIdentity";

// Sits next to the Advocate pill (see SectionPills' headerAction) as a
// shortcut straight to the "I Advocated!" log further down the page — that
// log (ProjectDiscussion, in its own "Advocacy" section) is a different
// component from the Advocate pill's own panel (TakeActionSection: docket,
// regulators, hearings), so this jumps past the pill entirely rather than
// opening it. Same amber pill styling as "I Reached Out!" and the log's own
// button.
export function AdvocateNowButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new Event(OPEN_ADVOCACY_FORM_EVENT));
        document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition-colors bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
    >
      I Advocated!
    </button>
  );
}
