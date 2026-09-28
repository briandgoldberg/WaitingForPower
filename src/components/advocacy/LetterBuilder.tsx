"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Step = 1 | 2 | 3;

function NextButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="self-end text-sm font-semibold px-5 py-2.5 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors whitespace-nowrap"
      style={{ color: "white" }}
    >
      Next →
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-sm font-semibold px-5 py-2.5 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
    >
      ← Back
    </button>
  );
}

// A 3-step flow — pick issues, pick a political leaning, then get the
// assembled letter — instead of one long page, so a visitor is never
// looking at more than one decision at a time. See advocacyLetters.ts for
// why nothing here is generated live: every combination is a deterministic
// composition of reviewed text, not a model call.
export function LetterBuilder() {
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<Set<CauseSlug>>(new Set());
  const [orientation, setOrientation] = useState<Orientation>("moderate");
  const [letterText, setLetterText] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Step 1's card grid is tall enough on mobile that reaching "Next" means
  // scrolling well down the page — the next step is much shorter, so
  // without this the same scroll offset lands past its content instead of
  // on it. Scrolls the whole widget back to the top on every step change,
  // skipping the initial mount so loading the page doesn't itself scroll.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

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

  const canProceedStep1 = causeSlugs.length > 0;

  return (
    <div ref={containerRef} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 flex flex-col gap-4 scroll-mt-4">
      {/* Same title/subtitle pairing as a project page's own heading —
          text-3xl font-bold for the headline, text-sm text-muted for the
          line right under it. */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight max-w-2xl">Email Congress and Demand Change</h2>
        <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
          Six bipartisan policies to speed up permit decisions. Inspired by{" "}
          <a href="https://citizensclimatelobby.org/" target="_blank" rel="noreferrer" className="underline">
            Citizens&rsquo; Climate Lobby
          </a>
          .
        </p>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xl font-bold tracking-tight">What issues do you care about?</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                  <div className="h-1" style={{ backgroundColor: cause.color }} />
                  <div className="p-2.5 flex flex-col gap-1 bg-[var(--background)]">
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
                      <a
                        href={`#${policy.slug}`}
                        className="text-xs font-medium text-[var(--accent)] border border-[var(--border)] rounded-full px-2.5 py-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        Learn more →
                      </a>
                      <span className="text-xs text-[var(--muted)]">{active ? "Added to letter" : "Not included"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <NextButton onClick={() => setStep(2)} disabled={!canProceedStep1} />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xl font-bold tracking-tight">What&rsquo;s your political leaning?</h3>

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

          <div className="flex items-center justify-between">
            <BackButton onClick={() => setStep(1)} />
            <NextButton onClick={() => setStep(3)} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xl font-bold tracking-tight">Your letter is ready</h3>

          <textarea
            value={letterText}
            onChange={(e) => setLetterText(e.target.value)}
            rows={6}
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
              href="https://www.congress.gov/members/find-your-member"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold px-4 py-2 rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-center whitespace-nowrap"
            >
              Email your Congress member →
            </a>
            {copied && <span className="text-xs text-[var(--muted)] self-center">Copied to clipboard</span>}
          </div>

          <BackButton onClick={() => setStep(2)} />
        </div>
      )}
    </div>
  );
}
