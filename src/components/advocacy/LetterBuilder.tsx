"use client";

import { useEffect, useMemo, useState } from "react";
import type { CauseSlug } from "@/lib/data/causeCategories";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { POLICIES } from "@/lib/data/policies";
import { ORIENTATION_OPTIONS, buildLetter, type Orientation } from "@/lib/data/advocacyLetters";

// A small on/off switch for "include this issue in my letter" — kept local
// to this file since nothing else on the site needs a toggle yet.
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-black/15 dark:bg-white/20"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Picks one or more issues plus a political leaning and assembles a
// pre-written letter to a member of Congress — see advocacyLetters.ts for
// why nothing here is generated live. Every combination is a deterministic
// composition of reviewed text, not a model call. The issue and leaning
// pickers always stay visible; only the written-out letter itself folds up,
// via `expanded` below — the actions (Copy letter, Find your representative)
// stay visible either way, right after the leaning picker when folded.
export function LetterBuilder() {
  const [selected, setSelected] = useState<Set<CauseSlug>>(new Set());
  const [orientation, setOrientation] = useState<Orientation>("moderate");
  const [letterText, setLetterText] = useState("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const causeSlugs = useMemo(() => [...selected], [selected]);

  const computedLetter = useMemo(() => {
    if (causeSlugs.length === 0) return "";
    return buildLetter({ causeSlugs, orientation });
  }, [causeSlugs, orientation]);

  // Regenerates whenever the selections change. A visitor can still edit the
  // text by hand afterward; changing an issue or the leaning again starts
  // fresh from the newly composed letter rather than trying to merge edits.
  useEffect(() => {
    setLetterText(computedLetter);
  }, [computedLetter]);

  function toggleCause(slug: CauseSlug) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letterText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-essential — skip the confirmation rather than surface an error.
    }
  }

  const ready = causeSlugs.length > 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 flex flex-col gap-4">
      <h3 className="text-lg font-bold tracking-tight">Write to your representative or senator</h3>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Which issues do you care about?
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {POLICIES.map((policy) => {
            const cause = CAUSE_CATEGORY_BY_SLUG[policy.slug];
            const active = selected.has(policy.slug);
            return (
              <div
                key={policy.slug}
                className={`rounded-xl border overflow-hidden transition-colors ${
                  active ? "border-transparent" : "border-[var(--border)]"
                }`}
                style={active ? { boxShadow: `0 0 0 1.5px ${cause.color}` } : undefined}
              >
                <div className="h-1.5" style={{ backgroundColor: cause.color }} />
                <div className="p-3 flex flex-col gap-1.5 bg-[var(--background)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm leading-snug">{policy.title}</div>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{policy.oneLiner}</p>
                    </div>
                    <Toggle
                      checked={active}
                      onChange={() => toggleCause(policy.slug)}
                      label={`Include ${policy.title} in your letter`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    <a href={`#${policy.slug}`} className="text-xs font-medium text-[var(--accent)] underline">
                      Learn more →
                    </a>
                    <span className="text-xs text-[var(--muted)]">{active ? "In your letter" : "Not included"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">How do you lean?</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ORIENTATION_OPTIONS.map((opt) => {
            const active = orientation === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setOrientation(opt.value)}
                aria-pressed={active}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-accent/10"
                    : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <div className="text-sm font-semibold" style={active ? { color: "var(--accent)" } : undefined}>
                  {opt.label}
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{opt.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {ready && (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center justify-between gap-2 text-sm font-semibold"
          >
            <span>Your letter</span>
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="M5 7l5 5 5-5" />
            </svg>
          </button>

          {expanded && (
            <textarea
              value={letterText}
              onChange={(e) => setLetterText(e.target.value)}
              rows={14}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm leading-relaxed font-sans resize-y"
              aria-label="Your letter"
            />
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={copyLetter}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-accent hover:bg-accent/90 shadow-sm transition-colors whitespace-nowrap"
              style={{ color: "white" }}
            >
              Copy letter
            </button>
            <a
              href="https://www.congress.gov/members/find-your-member"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold px-4 py-2 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-center whitespace-nowrap"
            >
              Find your representative →
            </a>
            {copied && <span className="text-xs text-[var(--muted)] self-center">Copied to clipboard</span>}
          </div>
        </div>
      )}
    </div>
  );
}
