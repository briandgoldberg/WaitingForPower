"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wfp_feedback_auto_shown";
const SHOW_AFTER_MS = 15000;

// Fired by anything site-wide that wants to open the feedback form on
// demand — see the footer's "Reach out" button in src/app/layout.tsx, the
// replacement for the old dedicated /contact page.
export const OPEN_FEEDBACK_EVENT = "wfp:open-feedback";

type Step = "minimized" | "form" | "thanks";

// This is the site's only "contact us" surface (the old /contact page was
// removed in favor of this) — auto-opens once per browser so it's
// discoverable, then minimizes into a small always-visible pill rather
// than disappearing, so feedback stays reachable indefinitely afterward.
export function FeedbackWidget() {
  const [step, setStep] = useState<Step>("minimized");
  const [feedbackText, setFeedbackText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alreadyAutoShown = false;
    try {
      alreadyAutoShown = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private browsing / storage blocked — treat as not-yet-shown rather
      // than crash; worst case this auto-opens every visit for that
      // browser instead of once.
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!alreadyAutoShown) {
      timer = setTimeout(() => {
        setStep("form");
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // Nothing to do if storage is blocked — it'll just auto-open
          // again next visit for this browser, not a functional break.
        }
      }, SHOW_AFTER_MS);
    }

    function onOpenRequest() {
      setStep("form");
    }
    window.addEventListener(OPEN_FEEDBACK_EVENT, onOpenRequest);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(OPEN_FEEDBACK_EVENT, onOpenRequest);
    };
  }, []);

  function minimize() {
    setStep("minimized");
  }

  async function send() {
    const text = feedbackText.trim();
    const email = contactEmail.trim();
    if (!text && !email) {
      minimize();
      return;
    }
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackText: text, contactEmail: email, path: window.location.pathname }),
      });
    } catch {
      // Best-effort — a visitor shouldn't see an error for an optional,
      // already-dismissible widget.
    }
    setSending(false);
    setFeedbackText("");
    setContactEmail("");
    setStep("thanks");
    setTimeout(minimize, 1400);
  }

  if (step === "minimized") {
    return (
      <button
        onClick={() => setStep("form")}
        className="fixed bottom-1 right-2 sm:bottom-4 sm:right-4 z-40 flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] shadow-lg h-10 w-10 text-base sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm sm:font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label="Open feedback form"
      >
        💬<span className="hidden sm:inline">Feedback</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-40 w-auto sm:w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg p-4">
      <button
        onClick={minimize}
        aria-label="Minimize"
        className="absolute top-2 right-2 text-[var(--muted)] hover:text-[var(--foreground)] text-sm leading-none"
      >
        ✕
      </button>

      {step === "form" && (
        <>
          <p className="text-sm font-semibold text-[var(--accent)] pr-4 mb-1">Got feedback?</p>
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Leave a note or an email if you&rsquo;d like us to reach out.
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="A note, question, or request…"
            rows={3}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm mb-2 resize-none"
          />
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm mb-3"
          />
          <div className="flex items-center justify-between gap-2">
            <button onClick={minimize} className="text-xs text-[var(--muted)] hover:underline">
              Skip
            </button>
            <button
              onClick={send}
              disabled={sending}
              className="rounded-md bg-[var(--accent)] text-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </>
      )}

      {step === "thanks" && <p className="text-sm text-[var(--text-secondary)] pr-4">Thanks!</p>}
    </div>
  );
}
