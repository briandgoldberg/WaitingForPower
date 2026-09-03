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

export function IntentWidget() {
  const [visible, setVisible] = useState(false);
  const [answered, setAnswered] = useState(false);

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

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do if storage is blocked — it'll just show again next
      // visit for this browser, not a functional break.
    }
  }

  async function answer(intent: string) {
    setAnswered(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, path: window.location.pathname }),
      });
    } catch {
      // Best-effort — a failed log write shouldn't surface an error to a
      // visitor answering a one-question survey.
    }
    setTimeout(dismiss, 1200);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg p-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 text-[var(--muted)] hover:text-[var(--foreground)] text-sm leading-none"
      >
        ✕
      </button>
      {answered ? (
        <p className="text-sm text-[var(--text-secondary)] pr-4">Thanks!</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-[var(--accent)] pr-4 mb-3">
            What brings you to WaitingForPower today?
          </p>
          <div className="flex flex-col gap-1.5">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => answer(opt.value)}
                className="text-left text-sm rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
