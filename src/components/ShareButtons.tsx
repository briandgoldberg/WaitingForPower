"use client";

import { useState } from "react";

// Twitter/X publishes a real "share this URL" web intent that takes share
// text directly. Neither Instagram nor TikTok does (both are app-first,
// no official web link for sharing an arbitrary external URL) — so there's
// a generic "Share" button too: it opens the OS share sheet (lists
// whatever apps are actually installed, including Instagram/TikTok) where
// supported, and falls back to copying the link to the clipboard where it
// isn't (most desktop browsers).
//
// No Facebook button: its sharer.php ignores any text passed via URL
// params (its old `quote` param is unreliable and mostly deprecated) — it
// scrapes the target URL's Open Graph tags instead, so a dedicated button
// wasn't adding a meaningfully different action from "Share" or just
// pasting the link. The openGraph metadata (see src/app/layout.tsx and
// generateMetadata in src/app/project/[id]/page.tsx) still makes link
// previews look right anywhere OG tags are read, Facebook included.

function shareUrls(url: string, text: string) {
  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  };
}

function IconButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {children}
    </button>
  );
}

// Labeled variant of the X icon button above, for a spot that wants a full
// call-to-action rather than a compact icon row (e.g. under a blog post).
// Reuses the same intent URL, not a separate implementation.
export function PostToXButton({ url, text }: { url: string; text: string }) {
  const { twitter } = shareUrls(url, text);
  return (
    <a
      href={twitter}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.3 22H1.2l8.1-9.3L1 2h7.3l5 6.6L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
      </svg>
      Post to X
    </a>
  );
}

export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const urls = shareUrls(url, text);

  async function share() {
    // Prefer the OS-level share sheet where available (most mobile
    // browsers, some desktop ones) — it lists whatever apps are actually
    // installed, including Instagram/TikTok, which is strictly better than
    // a clipboard copy. Falls back to copying the link when unsupported.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        // User cancelled the share sheet, or it failed — fall through to
        // clipboard copy rather than leaving the click looking like a no-op.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail too (permissions, non-secure context) —
      // the button is non-essential, so just skip the confirmation rather
      // than surface an error for a share action.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <IconButton label="Share on X (Twitter)" href={urls.twitter}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
          <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.3 22H1.2l8.1-9.3L1 2h7.3l5 6.6L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
        </svg>
      </IconButton>
      <IconButton label="Share" onClick={share}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="M8.2 10.8 15.8 6.7M8.2 13.2l7.6 4.1" strokeLinecap="round" />
        </svg>
      </IconButton>
      {copied && <span className="text-xs text-[var(--muted)]">Link copied</span>}
    </div>
  );
}
