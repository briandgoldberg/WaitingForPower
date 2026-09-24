// Ad attribution without touching the database: the first visit carrying
// utm_* parameters (e.g. a Google Ads click) is remembered in localStorage,
// and later actions (advocacy logs, board posts, feedback) are reported to
// Vercel Web Analytics as custom events tagged with it. Event timestamps are
// what tie an event back to the actual row in the database.
//
// Browser-only; every storage access is wrapped because localStorage can be
// missing or throw (private windows, blocked site data).

import { track } from "@vercel/analytics";

const STORAGE_KEY = "wfp_attribution";
// An ad click counts toward actions taken within this window.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

type Attribution = Partial<Record<(typeof UTM_KEYS)[number], string>> & { landedAt: number; landingPath: string };

// track() silently drops events until <Analytics /> has set up window.va,
// and that component mounts after AttributionTracker's effect runs, so the
// landing event on the ad click itself would be lost. This is the same queue
// @vercel/analytics creates (its initQueue skips if window.va already exists,
// and the loaded script drains window.vaq).
function ensureQueue(): void {
  if (window.va) return;
  window.va = (event, properties) => {
    (window.vaq ??= []).push([event, properties]);
  };
}

function read(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Attribution;
    return Date.now() - a.landedAt < MAX_AGE_MS ? a : null;
  } catch {
    return null;
  }
}

// Called on every page load. Records a new attribution (and an "Ad landing"
// event) only when the URL actually carries utm_* parameters, so browsing
// around afterwards never overwrites it.
let captured = false;

export function captureAttribution(): void {
  // Once per page load (React's dev-mode effect double-run would otherwise
  // count one ad click as two landings).
  if (captured) return;
  captured = true;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  const found: Partial<Record<(typeof UTM_KEYS)[number], string>> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) found[k] = v.slice(0, 100);
  }
  if (Object.keys(found).length === 0) return;
  const a: Attribution = { ...found, landedAt: Date.now(), landingPath: window.location.pathname };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    // Storage unavailable: the landing event below still records the click.
  }
  ensureQueue();
  track("Ad landing", { ad: adLabel(a), path: a.landingPath });
}

// Vercel Web Analytics keeps only two custom properties per event on the Pro
// plan, so every event carries exactly two: which ad ("<campaign>:<content>",
// e.g. "advocates_2026:tracker") and the page it happened on.
function adLabel(a: Attribution): string {
  return `${a.utm_campaign ?? a.utm_source ?? "unknown"}:${a.utm_content ?? "none"}`.slice(0, 100);
}

// Reports a meaningful action. Only visitors who arrived via a tagged link
// are reported, since the point is to see what ad traffic does.
export function trackAttributedAction(action: "Advocacy logged" | "Official contact logged" | "Board post" | "Feedback sent"): void {
  const a = read();
  if (!a) return;
  ensureQueue();
  track(action, { ad: adLabel(a), path: window.location.pathname });
}
