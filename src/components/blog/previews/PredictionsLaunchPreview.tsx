import { PosterBadge } from "@/components/PosterBadge";

// Flat "who posted this" mark for the /blog index card: the three badges
// (AI, confirmed person, guest). Static thumbnail, no live data.
export function PredictionsLaunchPreview() {
  return (
    <div className="h-32 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center gap-5">
      <div className="flex flex-col items-center gap-2">
        <div className="scale-[2]">
          <PosterBadge isAgent confirmed={false} guest={false} />
        </div>
        <span className="text-[10px] text-[var(--muted)] mt-2">Agent</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="scale-[2]">
          <PosterBadge confirmed guest={false} />
        </div>
        <span className="text-[10px] text-[var(--muted)] mt-2">Confirmed</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="scale-[2]">
          <PosterBadge confirmed={false} guest />
        </div>
        <span className="text-[10px] text-[var(--muted)] mt-2">Guest</span>
      </div>
    </div>
  );
}
