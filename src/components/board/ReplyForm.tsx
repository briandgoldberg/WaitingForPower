"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreatePredictorKey } from "@/lib/clientIdentity";
import { IdentityDecision } from "@/components/IdentityDecision";
import { SaveProfilePrompt } from "@/components/SaveProfilePrompt";
import { ChooseName } from "@/components/ChooseName";
import type { IdentityStatus } from "@/lib/community";

const MAX_REPLY = 1000;

export function ReplyForm({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [key, setKey] = useState<string | null>(null);
  const [me, setMe] = useState<IdentityStatus | null | undefined>(undefined);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !key) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousKey: key, body: body.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setBody("");
      // Refresh in case this reply is already public (not a first-ever
      // post), and re-check identity — a first-ever post needs to flip this
      // form into the IdentityDecision gate below so it doesn't just stay
      // silently held.
      router.refresh();
      loadIdentity(key);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  if (me && !me.decided && key) {
    return (
      <IdentityDecision
        anonymousKey={key}
        label={me.label}
        onDecided={() => {
          loadIdentity(key);
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_REPLY}
        rows={3}
        placeholder="Write a reply"
        aria-label="Write a reply"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex-1" />
        <button
          type="submit"
          disabled={!body.trim() || posting}
          className="min-h-[44px] rounded-md bg-[var(--accent)] text-white px-5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {posting ? "Posting…" : "Reply"}
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
