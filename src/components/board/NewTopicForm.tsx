"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreatePredictorKey } from "@/lib/clientIdentity";
import { POLICIES } from "@/lib/data/policies";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";
import { IdentityDecision } from "@/components/IdentityDecision";
import { SaveProfilePrompt } from "@/components/SaveProfilePrompt";
import { ChooseName } from "@/components/ChooseName";
import type { IdentityStatus } from "@/lib/community";
import { trackAttributedAction } from "@/lib/attribution";

// Mirrors src/lib/forum.ts's MAX_TITLE_LENGTH/MAX_BODY_LENGTH — kept as
// plain constants here rather than imported, since forum.ts pulls in the
// Prisma client (server-only) and this is a client component.
const MAX_TITLE_LENGTH = 140;
const MAX_BODY_LENGTH = 2000;

// Starts a new Message Board topic — same guest-or-confirm-email identity
// gate as every other posting surface on the site (IdentityDecision), tagged
// with 1+ of the six national permitting-reform issues so the board stays
// anchored to advocacy rather than becoming a general chat room.
export function NewTopicForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [me, setMe] = useState<IdentityStatus | null | undefined>(undefined);
  const [identityOpen, setIdentityOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [issues, setIssues] = useState<Set<string>>(new Set());
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A first-ever post is held until identity is decided (see IdentityDecision
  // below) — remember where to go once that happens, rather than navigating
  // straight to a topic that would 404 while still held.
  const [pendingTopicId, setPendingTopicId] = useState<string | null>(null);

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

  function reset() {
    setTitle("");
    setBody("");
    setIssues(new Set());
    setError(null);
  }

  const ready = title.trim().length > 0 && body.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !key) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey: key, title: title.trim(), body: body.trim(), issues: [...issues] }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      trackAttributedAction("Board post");
      reset();
      if (result.identityDecided) {
        setOpen(false);
        router.push(`/board/${result.id}`);
      } else {
        // Not visible yet — stay put and let the identity gate take over;
        // its onDecided handler below navigates once it's actually public.
        setPendingTopicId(result.id);
        loadIdentity(key);
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  // A first-time poster's topic is held until they decide how to appear.
  if (me && !me.decided && key) {
    return (
      <IdentityDecision
        anonymousKey={key}
        label={me.label}
        onDecided={() => {
          if (pendingTopicId) {
            router.push(`/board/${pendingTopicId}`);
          } else {
            loadIdentity(key);
          }
        }}
      />
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 min-h-[48px] w-full sm:w-auto rounded-full bg-[var(--accent)] text-white px-5 text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
      >
        Start a topic
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={MAX_TITLE_LENGTH}
        placeholder="Topic title"
        aria-label="Topic title"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm font-medium"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_BODY_LENGTH}
        rows={4}
        placeholder="What's on your mind about permitting reform?"
        aria-label="Topic body"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Which issue(s)? (optional)</span>
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
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
            className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              issues.has("other") ? "bg-[var(--foreground)] text-[var(--background)] border-transparent" : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            Something else
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-sm text-[var(--muted)] px-2 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready || posting}
          className="min-h-[44px] rounded-md bg-[var(--accent)] text-white px-5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {posting ? "Posting…" : "Post topic"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

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
    </form>
  );
}
