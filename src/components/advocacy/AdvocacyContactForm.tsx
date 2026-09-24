"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrCreatePredictorKey } from "@/lib/clientIdentity";
import { STATE_NAMES } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { POLICIES } from "@/lib/data/policies";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { CONTACT_TARGET_TYPES, CONTACT_POINTS, type ContactTargetType } from "@/lib/data/advocacyPoints";
import { IdentityDecision } from "@/components/IdentityDecision";
import { SaveProfilePrompt } from "@/components/SaveProfilePrompt";
import { ChooseName } from "@/components/ChooseName";
import type { IdentityStatus } from "@/lib/community";

const STATE_OPTIONS = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
const MAX_NOTE = 500;

// Logs a real contact with a state regulator or a member of Congress —
// the National/State Advocacy tabs' companion to a project's "I Advocated"
// button. Same points, same leaderboard, not tied to one project, and the
// same guest-or-confirm-email identity flow as everywhere else on the site
// (see IdentityDecision): a first post is held until the person decides how
// to appear, which GET /api/identity checks without creating a row just
// from viewing this form.
export function AdvocacyContactForm() {
  const [key, setKey] = useState<string | null>(null);
  const [me, setMe] = useState<IdentityStatus | null | undefined>(undefined);
  const [identityOpen, setIdentityOpen] = useState(false);

  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<ContactTargetType | null>(null);
  const [state, setState] = useState("");
  const [regulatorName, setRegulatorName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [issues, setIssues] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const regulators = useMemo(() => (state ? (STATE_REGULATORS[state] ?? []) : []), [state]);

  function loadIdentity(k: string) {
    fetch(`/api/identity?anonymousKey=${encodeURIComponent(k)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { me: IdentityStatus | null } | null) => setMe(d?.me ?? null))
      .catch(() => setMe(null));
  }

  useEffect(() => {
    const k = getOrCreatePredictorKey();
    setKey(k);
    loadIdentity(k);
  }, []);

  function toggleIssue(slug: string) {
    setIssues((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function resetForm() {
    setTargetType(null);
    setState("");
    setRegulatorName("");
    setMemberName("");
    setIssues(new Set());
    setNote("");
    setError(null);
  }

  const ready = targetType != null && state !== "" && (targetType !== "state_regulator" || regulatorName !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !targetType || !key) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/advocacy-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymousKey: key,
          targetType,
          state,
          targetName: targetType === "state_regulator" ? regulatorName : memberName.trim() || undefined,
          issues: [...issues],
          note: note.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setPointsEarned(result.pointsEarned ?? CONTACT_POINTS);
      resetForm();
      setOpen(false);
      loadIdentity(key);
      setTimeout(() => setPointsEarned(null), 3000);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  // A first-time poster's entry is held until they decide how to appear —
  // same gate as a project's "I Advocated" log, takes over in place of the
  // button/form until resolved.
  if (me && !me.decided && key) {
    return <IdentityDecision anonymousKey={key} label={me.label} onDecided={() => loadIdentity(key)} />;
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
        >
          I Contacted an Official
        </button>
        {pointsEarned != null && <p className="text-sm font-semibold text-[var(--accent)]">+{pointsEarned} points. Thanks for advocating!</p>}
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Who did you reach?</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CONTACT_TARGET_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setTargetType(opt.value);
                setRegulatorName("");
              }}
              aria-pressed={targetType === opt.value}
              className={`text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                targetType === opt.value
                  ? "border-[var(--accent)] bg-accent/10 font-medium"
                  : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {targetType && (
          <div className="flex flex-wrap gap-2">
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setRegulatorName("");
              }}
              aria-label="State"
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
            >
              <option value="">State</option>
              {STATE_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>

            {targetType === "state_regulator" && state && (
              <select
                value={regulatorName}
                onChange={(e) => setRegulatorName(e.target.value)}
                aria-label="Regulator"
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
              >
                <option value="">Which regulator?</option>
                {regulators.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}

            {(targetType === "house" || targetType === "senate") && (
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Who, if you'd like to say (optional)"
                maxLength={120}
                className="flex-1 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
              />
            )}
          </div>
        )}

        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">What did you advocate for? (optional)</span>
        <div className="flex flex-wrap gap-1.5">
          {POLICIES.map((policy) => {
            const cause = CAUSE_CATEGORY_BY_SLUG[policy.slug];
            const active = issues.has(policy.slug);
            return (
              <button
                key={policy.slug}
                type="button"
                onClick={() => toggleIssue(policy.slug)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? "text-white border-transparent" : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                style={active ? { backgroundColor: cause.color } : undefined}
              >
                {policy.badgeLabel ?? cause.shortLabel}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => toggleIssue("other")}
            aria-pressed={issues.has("other")}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              issues.has("other") ? "bg-[var(--foreground)] text-[var(--background)] border-transparent" : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            Something else
          </button>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE}
          rows={2}
          placeholder="Add a note (optional)"
          aria-label="Add a note (optional)"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            className="text-sm text-[var(--muted)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready || posting}
            className="rounded-md bg-[var(--accent)] text-white px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {posting ? "…" : "Log it"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>

      {me && !me.nameChosen && (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Posting as {me.label} ·{" "}
          <button type="button" onClick={() => setIdentityOpen((o) => !o)} className="text-[var(--accent)] underline">
            Choose a name
          </button>
        </p>
      )}
      {identityOpen && key && me && !me.nameChosen && (
        <div className="mt-1">
          {me.emailConfirmed ? <ChooseName anonymousKey={key} onDone={() => setIdentityOpen(false)} /> : <SaveProfilePrompt anonymousKey={key} />}
        </div>
      )}
    </div>
  );
}
