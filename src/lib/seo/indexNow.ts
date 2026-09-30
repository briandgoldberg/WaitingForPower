// Submits changed URLs to the IndexNow API (https://www.indexnow.org) so
// Bing/Yandex (and tools that relay to Google) recrawl them promptly instead
// of waiting on the next organic crawl. One shared endpoint accepts submissions
// on behalf of all participating search engines — no per-engine auth.
//
// The key file at public/<INDEXNOW_KEY>.txt (containing just the key) proves
// domain ownership; IndexNow fetches it at keyLocation to verify each request.

const HOST = "waitingforpower.com";
const KEY = "cdb082f82954832a74647bd7c20f25fc";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status: number; body: string }> {
  if (urls.length === 0) throw new Error("submitToIndexNow: no URLs given");
  if (urls.length > 10_000) throw new Error("submitToIndexNow: IndexNow caps a single submission at 10,000 URLs");
  for (const url of urls) {
    if (!url.startsWith(`https://${HOST}/`)) {
      throw new Error(`submitToIndexNow: URL "${url}" is not on ${HOST} — refusing to submit on another host's behalf`);
    }
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

if (require.main === module) {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("Usage: tsx src/lib/seo/indexNow.ts <url1> <url2> ...");
    process.exit(1);
  }
  submitToIndexNow(urls)
    .then(({ ok, status, body }) => {
      console.log(`IndexNow submission: ${ok ? "accepted" : "FAILED"} (HTTP ${status})${body ? ` — ${body}` : ""}`);
      console.log(`Submitted ${urls.length} URL(s):\n${urls.map((u) => `  ${u}`).join("\n")}`);
      if (!ok) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
