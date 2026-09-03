"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wfp_intent_answered";
const SHOW_AFTER_MS = 15000;

const INTENT_OPTIONS: { value: string; label: string }[] = [
  { value: "researcher_journalist", label: "Researcher / journalist" },
  { value: "developer_consultant", label: "Energy developer / consultant" },
  { value: "investor", label: "Investor" },
  { value: "policy_advocacy", label: "Policy / advocacy" },
  { value: "just_exploring", label: "Just exploring" },
];

type Step = "prompt" | "detail" | "thanks";

export function IntentWidget() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("prompt");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
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
    setVisible(false);
  }

  async function selectIntent(intent: string) {
    // Set the moment an intent is picked, not only on final send/skip — a
    // visitor who closes the widget mid-detail-step (or just refreshes)
    // should never see the initial prompt again either.
    markAnswered();
    setStep("detail");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, path: window.location.pathname }),
      });
      const data = await res.json();
      if (res.ok && data.id) setFeedbackId(data.id);
    } catch {
      // Best-effort — the detail step below just quietly can't attach to a
      // row if this failed; see sendDetail's own id guard.
    }
  }

  async function sendDetail() {
    const text = feedbackText.trim();
    const email = contactEmail.trim();
    if (!text && !email) {
      close();
      return;
    }
    if (!feedbackId) {
      close();
      return;
    }
    setSending(true);
    try {
      await fetch(`/api/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackText: text, contactEmail: email }),
      });
    } catch {
      // Best-effort — a visitor shouldn't see an error for an optional,
      // already-dismissible extra step.
    }
    setSending(false);
    setStep("thanks");
    setTimeout(close, 1400);
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

      {step === "prompt" && (
        <>
          <p className="text-sm font-semibold text-[var(--accent)] pr-4 mb-3">
            What brings you to WaitingForPower today?
          </p>
          <div className="flex flex-col gap-1.5">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectIntent(opt.value)}
                className="text-left text-sm rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "detail" && (
        <>
          <p className="text-sm font-semibold text-[var(--accent)] pr-4 mb-1">Anything else? (optional)</p>
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
              onClick={sendDetail}
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
