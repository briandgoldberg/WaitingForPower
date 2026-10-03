"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreatePredictorKey } from "@/lib/clientIdentity";
import type { IdentityStatus } from "@/lib/community";

// Shown only to the identity that created the post — resolves "who am I"
// the same way every other board form does (anonymousKey -> /api/identity)
// and compares against the post's own predictorId, rather than trusting
// anything the client already has lying around. The actual ownership check
// that matters happens again server-side in lib/forum.ts's deleteTopic/
// deleteReply; this is just what decides whether to show the button.
//
// What happens after a successful delete, in priority order: `onDeleted`
// (a client parent, e.g. TopicList, removing it from local state), else
// `redirectTo` (used from a server-component parent, which can't pass a
// closure across the boundary — e.g. the topic page after deleting the
// topic itself), else router.refresh() (re-runs the server component, e.g.
// a reply disappearing from the topic page).
export function DeleteButton({
  predictorId,
  deleteUrl,
  onDeleted,
  redirectTo,
  confirmText,
}: {
  predictorId: string;
  deleteUrl: string;
  onDeleted?: () => void;
  redirectTo?: string;
  confirmText: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const k = getOrCreatePredictorKey();
    setKey(k);
    fetch(`/api/identity?anonymousKey=${encodeURIComponent(k)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { me: IdentityStatus | null } | null) => setMyId(d?.me?.id ?? null))
      .catch(() => setMyId(null));
  }, []);

  if (!key || myId !== predictorId) return null;

  async function handleDelete() {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(`${deleteUrl}?anonymousKey=${encodeURIComponent(key!)}`, { method: "DELETE" });
      if (res.ok) {
        if (onDeleted) onDeleted();
        else if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleDelete();
      }}
      disabled={busy}
      className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
