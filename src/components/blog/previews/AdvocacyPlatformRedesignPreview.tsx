// Small thumbnail for the /blog index card — same navy/amber brand banner
// used at the top of the full post (see AdvocacyPlatformRedesign.tsx),
// scaled down instead of duplicated as a second design.
export function AdvocacyPlatformRedesignPreview() {
  return (
    <div
      className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] flex flex-col items-center justify-center gap-2"
      style={{ background: "#1e3a5f" }}
    >
      <svg width="32" height="32" viewBox="0 0 800 800">
        <circle cx="400" cy="400" r="400" fill="#16304d" />
        <polygon points="400,170 200,410 380,410 360,570 560,330 380,330" fill="#e8a04a" />
      </svg>
      <div className="text-xs font-medium" style={{ color: "#e8a04a" }}>
        Log it → Count it → Rank it
      </div>
    </div>
  );
}
