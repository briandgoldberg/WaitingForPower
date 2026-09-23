"use client";

import { useEffect, useMemo, useState } from "react";
import type { CauseSlug } from "@/lib/data/causeCategories";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { POLICIES } from "@/lib/data/policies";
import { ORIENTATION_OPTIONS, buildLetter, letterSubject, type Orientation } from "@/lib/data/advocacyLetters";

// Picks one or more issues plus a political leaning and assembles a
// pre-written letter to a member of Congress — see advocacyLetters.ts for
// why nothing here is generated live. Every combination is a deterministic
// composition of reviewed text, not a model call.
export function LetterBuilder() {
  const [selected, setSelected] = useState<Set<CauseSlug>>(new Set());
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [letterText, setLetterText] = useState("");
  const [copied, setCopied] = useState(false);

  const causeSlugs = useMemo(() => [...selected], [selected]);

  const computedLetter = useMemo(() => {
    if (!orientation || causeSlugs.length === 0) return "";
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

  const ready = orientation !== null && causeSlugs.length > 0;
  const mailtoHref = ready
    ? `mailto:?subject=${encodeURIComponent(letterSubject(causeSlugs))}&body=${encodeURIComponent(letterText)}`
    : undefined;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold tracking-tight">Write to your representative or senator</h3>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Pick what you care about and how you lean, and this fills in a real letter you can send. Modeled on how{" "}
          <a href="https://citizensclimatelobby.org/" target="_blank" rel="noreferrer" className="underline">
            Citizens&rsquo; Climate Lobby
          </a>{" "}
          trains volunteers to write to Congress: the same ask, framed for who you are.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Which issues do you care about?
        </span>
        <div className="flex flex-wrap gap-2">
          {POLICIES.map((policy) => {
            const cause = CAUSE_CATEGORY_BY_SLUG[policy.slug];
            const active = selected.has(policy.slug);
            return (
              <button
                key={policy.slug}
                type="button"
                onClick={() => toggleCause(policy.slug)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "text-white border-transparent"
                    : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                style={active ? { backgroundColor: cause.color } : undefined}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: active ? "white" : cause.color }}
                />
                {policy.badgeLabel ?? cause.shortLabel}
              </button>
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

      {ready ? (
        <div className="flex flex-col gap-2.5">
          <textarea
            value={letterText}
            onChange={(e) => setLetterText(e.target.value)}
            rows={14}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm leading-relaxed font-sans resize-y"
            aria-label="Your letter"
          />
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
              href={mailtoHref}
              className="text-sm font-semibold px-4 py-2 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-center whitespace-nowrap"
            >
              Open in email
            </a>
            {copied && <span className="text-xs text-[var(--muted)] self-center">Copied to clipboard</span>}
          </div>
          <p className="text-xs text-[var(--muted)]">
            Find your representative or senator using the links above, then paste this into their contact form or
            email, filling in the brackets with your own details.
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">Choose at least one issue and how you lean to see your letter.</p>
      )}
    </div>
  );
}
