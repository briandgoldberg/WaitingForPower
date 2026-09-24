"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SaveProfilePrompt } from "./SaveProfilePrompt";
import { IdentityDecision } from "./IdentityDecision";
import { SignInLink } from "./SignInLink";
import { ChooseName } from "./ChooseName";
import { PosterBadge } from "./PosterBadge";
import { DISCUSSION_CHANGED_EVENT, getOrCreatePredictorKey } from "@/lib/clientIdentity";
import { relativeTime } from "@/lib/feedTime";
import type { Discussion, DiscussionItem } from "@/lib/community";
import { HEARING_LOOKBACK_DAYS, describeAdvocacyEntry, STANCE_INFO, type AdvocacyType, type Stance } from "@/lib/data/advocacyPoints";
import { AdvocacyActionFields, type HearingOption } from "@/components/advocacy/AdvocacyActionFields";
import { trackAttributedAction } from "@/lib/attribution";

const POSTS_PER_PAGE = 10;

// A project's "I Advocated" log: what real people (and agents) have
// actually done about this project, not a free-form comment thread — see
// advocacyPoints.ts for the three choices and their point values. Identity
// is the same as everywhere else on the site: an anonymous browser key plus
// a name asked for once and then locked.
export function ProjectDiscussion({ projectId, hearings = [] }: { projectId: string; hearings?: HearingOption[] }) {
  const [data, setData] = useState<Discussion | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [visible, setVisible] = useState(POSTS_PER_PAGE);

  const [formOpen, setFormOpen] = useState(false);
  const [advocacyType, setAdvocacyType] = useState<AdvocacyType | null>(null);
  const [stance, setStance] = useState<Stance | null>(null);
  const [hearingDate, setHearingDate] = useState("");
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const eligibleHearings = useMemo(() => {
    const now = Date.now();
    const cutoff = now - HEARING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    return hearings
      .filter((h) => {
        const t = new Date(h.date).getTime();
        return t <= now && t >= cutoff;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [hearings]);

  const load = useCallback(
    (keyOverride?: string | null) => {
      const k = keyOverride ?? key;
      fetch(`/api/comments?projectId=${encodeURIComponent(projectId)}`, {
        headers: k ? { "x-anonymous-key": k } : undefined,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Discussion | null) => {
          if (d?.items) {
            setData(d);
            setNowMs(Date.now());
          }
        })
        .catch(() => setData((prev) => prev ?? { items: [], me: null, stanceTally: { approve: 0, deny: 0 } }));
    },
    [projectId, key],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const k = getOrCreatePredictorKey();
      setKey(k);
      load(k);
    }, 0);
    const onChanged = () => load();
    window.addEventListener(DISCUSSION_CHANGED_EVENT, onChanged);
    return () => {
      clearTimeout(t);
      window.removeEventListener(DISCUSSION_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  const sorted = useMemo(() => {
    return [...(data?.items ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data]);

  const me = data?.me ?? null;

  function resetForm() {
    setAdvocacyType(null);
    setStance(null);
    setHearingDate("");
    setNote("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key || !advocacyType) return;
    if (!stance) {
      setError("Say whether you support approving or denying this.");
      return;
    }
    if (advocacyType === "attended_hearing" && !hearingDate) {
      setError("Pick which hearing you attended.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          anonymousKey: key,
          body: note.trim(),
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
      setPointsEarned(result.pointsEarned ?? null);
      resetForm();
      setFormOpen(false);
      window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT));
      setTimeout(() => setPointsEarned(null), 3000);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  // Optimistic like: flip the heart immediately, then settle to the server's
  // count (or roll back on failure).
  async function handleLike(id: string, current: { liked: boolean; count: number }) {
    if (!key) return;
    const apply = (liked: boolean, count: number) =>
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((it) => (it.rawId === id ? { ...it, likedByMe: liked, likeCount: count } : it)) } : prev,
      );
    apply(!current.liked, Math.max(0, current.count + (current.liked ? -1 : 1)));
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey: key, targetId: id }),
      });
      if (!res.ok) throw new Error("like failed");
      const result = await res.json();
      apply(result.liked, result.count);
    } catch {
      apply(current.liked, current.count);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-base font-semibold text-[var(--accent)]">Advocacy{sorted.length > 0 ? ` (${sorted.length})` : ""}</h2>
      </div>

      {data && (data.stanceTally.approve > 0 || data.stanceTally.deny > 0) && <StanceTallyBar tally={data.stanceTally} />}

      {me && !me.decided && key ? (
        <IdentityDecision anonymousKey={key} label={me.label} onDecided={() => window.dispatchEvent(new Event(DISCUSSION_CHANGED_EVENT))} />
      ) : (
        <div>
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-full bg-[var(--accent)] text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              I Advocated
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] p-3">
              <AdvocacyActionFields
                advocacyType={advocacyType}
                onAdvocacyType={setAdvocacyType}
                hearingDate={hearingDate}
                onHearingDate={setHearingDate}
                eligibleHearings={eligibleHearings}
                stance={stance}
                onStance={setStance}
                note={note}
                onNote={setNote}
              />

              <div className="flex items-center gap-2 flex-wrap">
                {!me && <SignInLink />}
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    resetForm();
                  }}
                  className="text-sm text-[var(--muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting || !advocacyType || !stance}
                  className="rounded-md bg-[var(--accent)] text-white px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  {posting ? "…" : "Log it"}
                </button>
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            </form>
          )}

          {pointsEarned != null && (
            <p className="mt-2 text-sm font-semibold text-[var(--accent)]">+{pointsEarned} points. Thanks for advocating!</p>
          )}

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
      )}

      {data && sorted.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col gap-4">
          {sorted.slice(0, visible).map((post) => (
            <PostRow key={post.rawId} post={post} nowMs={nowMs} onLike={() => handleLike(post.rawId, { liked: post.likedByMe, count: post.likeCount })} />
          ))}
        </ul>
      )}

      {data && sorted.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + POSTS_PER_PAGE)}
          className="mt-4 text-sm font-medium px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10"
        >
          Show more
        </button>
      )}
      {data && sorted.length === 0 && <p className="text-xs text-[var(--muted)] mt-4">No one has logged advocacy here yet. Be the first.</p>}
    </div>
  );
}

// Approve/deny split across every entry with a stance on this project —
// a proportional two-color bar, same idea as a vote tally.
function StanceTallyBar({ tally }: { tally: { approve: number; deny: number } }) {
  const total = tally.approve + tally.deny;
  const approvePct = total > 0 ? (tally.approve / total) * 100 : 50;
  return (
    <div className="mb-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div style={{ width: `${approvePct}%`, backgroundColor: STANCE_INFO.approve.color }} />
        <div style={{ width: `${100 - approvePct}%`, backgroundColor: STANCE_INFO.deny.color }} />
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        <span aria-hidden>{STANCE_INFO.approve.icon}</span> {tally.approve} advocated to approve ·{" "}
        <span aria-hidden>{STANCE_INFO.deny.icon}</span> {tally.deny} to deny
      </p>
    </div>
  );
}

function PostRow({ post, nowMs, onLike }: { post: DiscussionItem; nowMs: number | null; onLike: () => void }) {
  const description = post.advocacyType ? describeAdvocacyEntry(post.advocacyType, post.hearingDate) : null;
  const stanceInfo = post.stance ? STANCE_INFO[post.stance] : null;
  return (
    <li className="text-sm">
      <div className="flex items-center gap-1.5 text-xs">
        {stanceInfo && (
          <span
            aria-label={stanceInfo.label}
            title={stanceInfo.label}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]"
            style={{ backgroundColor: `${stanceInfo.color}1a` }}
          >
            {stanceInfo.icon}
          </span>
        )}
        <span className="font-semibold truncate">{post.label}</span>
        <PosterBadge isAgent={post.isAgent} confirmed={post.confirmed} guest={post.guest} />
        {post.pending && (
          <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-1 text-[10px]">Only you can see this</span>
        )}
        {nowMs != null && <span className="text-[var(--muted)]">· {relativeTime(post.createdAt, nowMs)}</span>}
      </div>
      {description && (
        <p className="mt-1 text-[var(--text-secondary)]">
          {post.label} {description}
          {stanceInfo ? ` ${stanceInfo.phrase}` : ""}.
        </p>
      )}
      {post.body && <p className="mt-0.5 text-[var(--text-secondary)] whitespace-pre-wrap break-words">{post.body}</p>}
      <div className="flex items-center gap-4 mt-1.5 text-xs">
        <LikeButton liked={post.likedByMe} count={post.likeCount} onClick={onLike} />
      </div>
    </li>
  );
}

function LikeButton({ liked, count, onClick }: { liked: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={`inline-flex items-center gap-1 ${liked ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      <span>{count > 0 ? count : "Like"}</span>
    </button>
  );
}
