// Auto-posting real upcoming hearings to Bluesky and Mastodon — both APIs
// are free with no approval queue (unlike X/Twitter's post-Feb-2026
// pay-per-post pricing, which is why there's no X poster here). Each
// platform is entirely optional: with no credentials configured, its
// post*() function is a silent no-op so the cron this feeds into runs fine
// with zero, one, or both platforms wired up.

export interface HearingPost {
  text: string; // pre-built, already within each platform's length limit check below
  url: string; // the project/docket page — embedded in the post as a link
}

export function buildHearingPostText(params: {
  projectName: string;
  state: string | null;
  dateLabel: string; // e.g. "Sep 21, 2026"
  location: string | null;
}): string {
  const { projectName, state, dateLabel, location } = params;
  const where = location ? ` — ${location}` : "";
  const stateTag = state ? ` (${state})` : "";
  return `⚡ Public hearing: ${projectName}${stateTag}\n${dateLabel}${where}`;
}

interface PostResult {
  ok: boolean;
  skipped?: boolean; // true when the platform isn't configured — not an error
  error?: string;
}

export async function postToBluesky(post: HearingPost): Promise<PostResult> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !appPassword) return { ok: true, skipped: true };

  try {
    const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password: appPassword }),
    });
    if (!sessionRes.ok) {
      return { ok: false, error: `Bluesky auth failed: ${sessionRes.status}` };
    }
    const session = (await sessionRes.json()) as { accessJwt: string; did: string };

    const text = `${post.text}\n${post.url}`;
    const record = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
    };

    const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record,
      }),
    });
    if (!postRes.ok) {
      return { ok: false, error: `Bluesky post failed: ${postRes.status} ${await postRes.text()}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function postToMastodon(post: HearingPost): Promise<PostResult> {
  const instanceUrl = process.env.MASTODON_INSTANCE_URL; // e.g. "https://mastodon.social"
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;
  if (!instanceUrl || !accessToken) return { ok: true, skipped: true };

  try {
    const status = `${post.text}\n${post.url}`;
    const res = await fetch(`${instanceUrl.replace(/\/$/, "")}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      return { ok: false, error: `Mastodon post failed: ${res.status} ${await res.text()}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
