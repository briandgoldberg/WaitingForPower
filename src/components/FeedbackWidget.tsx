"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wfp_feedback_answered";
const SHOW_AFTER_MS = 15000;

type Step = "form" | "thanks";

// A single optional-comment-and-email screen — shown once per browser (a
// localStorage flag), never re-prompted. Closing it without typing
// anything writes nothing; see src/app/api/feedback/route.ts.
export function FeedbackWidget() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [feedbackText, setFeedbackText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alreadyAnswered = false;
    try {
      alreadyAnswered = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private browsing / storage blocked — treat as not-yet-answered
      // rather than crash; worst case this shows every visit for that
      // browser instead of once.
    }
    if (alreadyAnswered) return;

    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  function markAnswered() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do if storage is blocked — it'll just show again next
      // visit for this browser, not a functional break.
    }
  }

  function close() {
    markAnswered();
    setVisible(false);
  }

  async function send() {
    const text = feedbackText.trim();
    const email = contactEmail.trim();
    if (!text && !email) {
      close();
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
    markAnswered();
    setStep("thanks");
    setTimeout(() => setVisible(false), 1400);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg p-4">
      <button
        onClick={close}
        aria-label="Dismiss"
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
            <button onClick={close} className="text-xs text-[var(--muted)] hover:underline">
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
