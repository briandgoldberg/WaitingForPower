import Link from "next/link";

function Step({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
      <div className="text-sm font-semibold" style={{ color: "#e8a04a" }}>
        {label}
      </div>
      <div className="text-xs" style={{ color: "#cbd5e1" }}>
        {sublabel}
      </div>
    </div>
  );
}

function RedesignBanner() {
  return (
    <div
      className="rounded-lg px-6 py-5 flex items-center gap-6"
      style={{ background: "#1e3a5f" }}
    >
      <svg width="40" height="40" viewBox="0 0 800 800" className="shrink-0">
        <circle cx="400" cy="400" r="400" fill="#16304d" />
        <polygon points="400,170 200,410 380,410 360,570 560,330 380,330" fill="#e8a04a" />
      </svg>
      <div className="hidden sm:flex flex-1 gap-6">
        <Step label="1. Log it" sublabel="Comment, hearing, or contact" />
        <Step label="2. Count it" sublabel="Points, automatically" />
        <Step label="3. Rank it" sublabel="Public leaderboard" />
      </div>
      <div className="sm:hidden flex-1 text-sm" style={{ color: "#e8a04a" }}>
        Log it → Count it → Rank it
      </div>
    </div>
  );
}

export function AdvocacyPlatformRedesign() {
  return (
    <div className="text-sm leading-relaxed flex flex-col gap-3">
      <RedesignBanner />
      <p>
        The comment box on every project page is gone. It let anyone type anything, which meant it
        mostly filled up with noise instead of a record of real advocacy. It&rsquo;s been replaced
        with &ldquo;I Advocated&rdquo;: pick what you actually did &mdash; submitted a public comment,
        found the comment period already closed, or attended a specific hearing &mdash; and say
        whether you support approving or denying the project. Attending a hearing has to match one of
        that project&rsquo;s own real hearing dates; you can&rsquo;t claim one that didn&rsquo;t happen.
      </p>
      <p>
        Every logged action earns points, and{" "}
        <Link href="/?feed=leaders" className="underline text-[var(--accent)]">
          a public leaderboard
        </Link>{" "}
        now tracks who&rsquo;s advocated the most. The home page has a new{" "}
        <Link href="/?feed=advocating" className="underline text-[var(--accent)]">
          Advocacy activity
        </Link>{" "}
        feed showing every action site-wide, right next to the existing project-changes feed.
      </p>
      <p>
        There&rsquo;s also a new way to log advocacy that isn&rsquo;t tied to a project at all: hit{" "}
        <Link href="/policies" className="underline text-[var(--accent)]">
          &ldquo;I Reached Out!&rdquo;
        </Link>{" "}
        on the Advocacy page after contacting your state energy regulator or a member of Congress,
        and say which permitting reform issue you raised. It feeds the same leaderboard.
      </p>
      <p>
        None of this is postable through the API or MCP server &mdash; it stays a real record of
        people actually doing something, not something a script can pad out.
      </p>
    </div>
  );
}
