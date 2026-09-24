"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrCreatePredictorKey, DISCUSSION_CHANGED_EVENT } from "@/lib/clientIdentity";
import { STATE_NAMES } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { POLICIES } from "@/lib/data/policies";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import {
  CONTACT_TARGET_TYPES,
  CONTACT_POINTS,
  HEARING_LOOKBACK_DAYS,
  pointsFor,
  type ContactTargetType,
  type AdvocacyType,
  type Stance,
} from "@/lib/data/advocacyPoints";
import { IdentityDecision } from "@/components/IdentityDecision";
import { SaveProfilePrompt } from "@/components/SaveProfilePrompt";
import { ChooseName } from "@/components/ChooseName";
import { AdvocacyActionFields, type HearingOption } from "./AdvocacyActionFields";
import type { IdentityStatus } from "@/lib/community";
import { trackAttributedAction } from "@/lib/attribution";

const STATE_OPTIONS = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
const MAX_NOTE = 500;

interface ProjectMatch {
  id: string;
  slug: string;
  name: string;
  state: string | null;
  hearings: HearingOption[];
}

type ReachedAbout = "project" | "official";

// Logs a real piece of advocacy that didn't happen through a project page
// or the letter builder — either about a specific project (searched up
// here, then the exact same "what did you do" flow as that project's own
// "I Advocated" log) or a contact with a state regulator or member of
// Congress. Same points, same leaderboard, same guest-or-confirm-email
// identity flow as everywhere else on the site.
export function AdvocacyContactForm() {
  const [key, setKey] = useState<string | null>(null);
  const [me, setMe] = useState<IdentityStatus | null | undefined>(undefined);
  const [identityOpen, setIdentityOpen] = useState(false);

  const [reachedAbout, setReachedAbout] = useState<ReachedAbout>("project");

  // Project mode
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [project, setProject] = useState<ProjectMatch | null>(null);
  const [advocacyType, setAdvocacyType] = useState<AdvocacyType | null>(null);
  const [hearingDate, setHearingDate] = useState("");
  const [stance, setStance] = useState<Stance | null>(null);
  const [projectNote, setProjectNote] = useState("");

  // Official mode
  const [targetType, setTargetType] = useState<ContactTargetType | null>(null);
  const [state, setState] = useState("");
  const [regulatorName, setRegulatorName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [issues, setIssues] = useState<Set<string>>(new Set());
  const [officialNote, setOfficialNote] = useState("");

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const regulators = useMemo(() => (state ? (STATE_REGULATORS[state] ?? []) : []), [state]);

  const eligibleHearings = useMemo(() => {
    if (!project) return [];
    const now = Date.now();
    const cutoff = now - HEARING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    return project.hearings.filter((h) => {
      const t = new Date(h.date).getTime();
      return t <= now && t >= cutoff;
    });
  }, [project]);

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

  // Debounced project search.
  useEffect(() => {
    if (project || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/projects/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: ProjectMatch[] }) => setResults(d.results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, project]);

  function toggleIssue(slug: string) {
    setIssues((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function resetProjectForm() {
    setQuery("");
    setResults([]);
    setProject(null);
    setAdvocacyType(null);
    setHearingDate("");
    setStance(null);
    setProjectNote("");
  }

  function resetOfficialForm() {
    setTargetType(null);
    setState("");
    setRegulatorName("");
    setMemberName("");
    setIssues(new Set());
    setOfficialNote("");
  }

  const officialReady = targetType != null && state !== "" && (targetType !== "state_regulator" || regulatorName !== "");
  const projectReady = project != null && advocacyType != null && stance != null && (advocacyType !== "attended_hearing" || hearingDate !== "");

  async function handleProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectReady || !key || !project || !advocacyType) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          anonymousKey: key,
          body: projectNote.trim(),
          advocacyType,
          stance,
          hearingDate: advocacyType === "attended_hearing" ? hearingDate : undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      trackAttributedAction("Advocacy logged");
      setPointsEarned(result.pointsEarned ?? (advocacyType ? pointsFor(advocacyType) : null));
      resetProjectForm();
      window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT));
      loadIdentity(key);
      setTimeout(() => setPointsEarned(null), 3000);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleOfficialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!officialReady || !targetType || !key) return;
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
          note: officialNote.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      trackAttributedAction("Official contact logged");
      setPointsEarned(result.pointsEarned ?? CONTACT_POINTS);
      resetOfficialForm();
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
  // form until resolved.
  if (me && !me.decided && key) {
    return <IdentityDecision anonymousKey={key} label={me.label} onDecided={() => loadIdentity(key)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setReachedAbout("project")}
          aria-pressed={reachedAbout === "project"}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            reachedAbout === "project"
              ? "border-[var(--accent)] bg-accent/10 font-semibold"
              : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          About a project
        </button>
        <button
          type="button"
          onClick={() => setReachedAbout("official")}
          aria-pressed={reachedAbout === "official"}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            reachedAbout === "official"
              ? "border-[var(--accent)] bg-accent/10 font-semibold"
              : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          A regulator or Congress
        </button>
      </div>

      {reachedAbout === "project" ? (
        <form onSubmit={handleProjectSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-3">
          {!project ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Which project?</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects by name"
                aria-label="Search projects by name"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
              {searching && <p className="text-xs text-[var(--muted)]">Searching…</p>}
              {results.length > 0 && (
                <ul className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setProject(r);
                          setResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {r.name}
                        {r.state && <span className="text-[var(--muted)]"> · {STATE_NAMES[r.state] ?? r.state}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{project.name}</span>
              <button type="button" onClick={resetProjectForm} className="text-xs text-[var(--accent)] underline shrink-0">
                Change project
              </button>
            </div>
          )}

          {project && (
            <AdvocacyActionFields
              advocacyType={advocacyType}
              onAdvocacyType={setAdvocacyType}
              hearingDate={hearingDate}
              onHearingDate={setHearingDate}
              eligibleHearings={eligibleHearings}
              stance={stance}
              onStance={setStance}
              note={projectNote}
              onNote={setProjectNote}
            />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex-1" />
            <button
              type="submit"
              disabled={!projectReady || posting}
              className="rounded-md bg-[var(--accent)] text-white px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {posting ? "…" : "Log it"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      ) : (
        <form onSubmit={handleOfficialSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-3">
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
            value={officialNote}
            onChange={(e) => setOfficialNote(e.target.value)}
            maxLength={MAX_NOTE}
            rows={2}
            placeholder="Add a note (optional)"
            aria-label="Add a note (optional)"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex-1" />
            <button
              type="submit"
              disabled={!officialReady || posting}
              className="rounded-md bg-[var(--accent)] text-white px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {posting ? "…" : "Log it"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {pointsEarned != null && <p className="text-sm font-semibold text-[var(--accent)]">+{pointsEarned} points. Thanks for advocating!</p>}

      {me && !me.nameChosen && (
        <p className="text-[11px] text-[var(--muted)]">
          Posting as {me.label} ·{" "}
          <button type="button" onClick={() => setIdentityOpen((o) => !o)} className="text-[var(--accent)] underline">
            Choose a name
          </button>
        </p>
      )}
      {identityOpen && key && me && !me.nameChosen && (
        <div>{me.emailConfirmed ? <ChooseName anonymousKey={key} onDone={() => setIdentityOpen(false)} /> : <SaveProfilePrompt anonymousKey={key} />}</div>
      )}
    </div>
  );
}
