import { TRACKS } from "@/lib/rooms";
import { coverThumb } from "@/lib/cover-thumb";
import { cn } from "@/lib/utils";

const MOSAIC = TRACKS.slice(0, 24);

export function CoverMosaic({ className }: { className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-4 grid-rows-6 sm:grid-cols-8 sm:grid-rows-3", className)}
      aria-hidden="true"
    >
      {MOSAIC.map((track) => (
        <img
          key={track.id}
          // 480px thumbs: cells are ~160x300px (desktop) / ~98x111px (phones),
          // and React preloads each eager <img> at high priority.
          src={coverThumb(track.image)}
          alt=""
          className="size-full min-h-0 object-cover outline-none"
        />
      ))}
    </div>
  );
}
