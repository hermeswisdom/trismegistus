import { Play, X } from "lucide-react";
import { getMeaning, getTrack } from "@/lib/rooms";
import { useMeaningSheet } from "@/lib/meaning-sheet";
import { usePlayer } from "@/lib/player-store";
import { noteUserGesture } from "@/lib/sc-widget";
import { cn } from "@/lib/utils";

export function MeaningSheet() {
  const trackId = useMeaningSheet((s) => s.trackId);
  const close = useMeaningSheet((s) => s.close);
  const play = usePlayer((s) => s.play);
  const track = trackId ? getTrack(trackId) : undefined;
  const meaning = trackId ? getMeaning(trackId) : "";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-[opacity,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        trackId ? "visible opacity-100" : "invisible opacity-0 pointer-events-none",
      )}
    >
      <button
        type="button"
        aria-label="Close meaning"
        onClick={close}
        className="absolute inset-0 bg-bg/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meaning-title"
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto border-t border-border bg-surface px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-8",
          "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          trackId ? "translate-y-0" : "translate-y-6",
        )}
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs tracking-[0.28em] text-accent uppercase">
                The verse
              </p>
              <h2
                id="meaning-title"
                className="mt-2 truncate font-display text-2xl text-fg sm:text-3xl"
              >
                {track?.title ?? "Tablet"}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
            >
              <X className="size-5" />
            </button>
          </div>
          {track ? (
            <img
              src={track.image}
              alt=""
              className="mt-8 aspect-video w-full object-cover"
            />
          ) : null}
          <p className="mt-8 whitespace-pre-line font-display text-xl leading-relaxed text-fg sm:text-2xl">
            {meaning}
          </p>
          {track ? (
            <button
              type="button"
              onPointerDown={noteUserGesture}
              onClick={() => {
                play(track.id, { forceEmbed: true });
                close();
              }}
              className="mt-8 inline-flex h-12 items-center gap-2 bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]"
            >
              <Play className="size-3.5" fill="currentColor" />
              Play the tablet
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
