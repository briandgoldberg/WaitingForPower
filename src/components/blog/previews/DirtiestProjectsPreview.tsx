// Small thumbnail for the /blog index card — bold gradient instead of a
// flat box, matching the punchier look of this post's own OG image (see
// [slug]/opengraph-image.tsx's DirtiestProjectsCard).
export function DirtiestProjectsPreview() {
  return (
    <div
      className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] flex items-center justify-center gap-3 px-3"
      style={{ background: "linear-gradient(135deg, #451a03 0%, #78350f 55%, #b45309 100%)" }}
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{ width: 56, height: 56, background: "rgba(0,0,0,0.25)", border: "3px solid #fbbf24" }}
      >
        <span className="text-2xl font-extrabold" style={{ color: "#fbbf24" }}>
          13
        </span>
      </div>
      <span className="text-sm font-bold leading-tight text-white">Dirtiest Projects Pending Approval</span>
    </div>
  );
}
