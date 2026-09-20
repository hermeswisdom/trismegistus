import { TRACKS } from "@/lib/rooms";
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
          src={track.image}
          alt=""
          className="size-full min-h-0 object-cover outline-none"
        />
      ))}
    </div>
  );
}
