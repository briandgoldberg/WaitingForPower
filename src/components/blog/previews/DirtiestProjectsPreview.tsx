// Small thumbnail for the /blog index card — plain, on-brand instead of a
// data visualization, since the full post's real content (the ranked list
// itself) doesn't compress into a small chart the way the other posts' do.
export function DirtiestProjectsPreview() {
  return (
    <div
      className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] flex flex-col items-center justify-center gap-1"
      style={{ background: "#78350f" }}
    >
      <span className="text-2xl font-bold" style={{ color: "#fbbf24" }}>
        13
      </span>
      <span className="text-xs font-medium text-center px-3" style={{ color: "#fde68a" }}>
        largest fossil-fuel projects pending
      </span>
    </div>
  );
}
