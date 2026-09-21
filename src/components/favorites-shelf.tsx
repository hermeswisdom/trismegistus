import { HeartButton } from "@/components/track-actions";
import { AccountNudge } from "@/components/account-nudge";
import { getMeaning, type Track } from "@/lib/rooms";
import { noteUserGesture } from "@/lib/sc-widget";
import { cn } from "@/lib/utils";

export function FavoritesShelf({
  saved,
  currentId,
  playing,
  dailyId,
  onToggle,
}: {
  saved: Track[];
  currentId: string;
  playing: boolean;
  dailyId: string;
  onToggle: (id: string) => void;
}) {
  return (
    <section id="saved" className="border-t border-border bg-elevated/20">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
          Saved tablets
        </p>
        <h2 className="mt-3 font-display text-section text-fg">
          The ones you kept.
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
          Hearts stay on this phone. A name carries them. Open a cover to play.
        </p>
        <AccountNudge className="mt-3 max-w-lg" />

        {saved.length === 0 ? (
          <p
            data-favorites-empty=""
            className="mt-8 border border-border px-5 py-8 text-sm text-muted"
          >
            No saved tablets yet. Heart one on the wall — they gather here.
          </p>
        ) : (
          <ul
            data-favorites-shelf=""
            className="favorites-shelf mt-8 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {saved.map((track) => (
              <ShelfCard
                key={track.id}
                track={track}
                active={track.id === currentId}
                isPlaying={track.id === currentId && playing}
                isDaily={track.id === dailyId}
                onToggle={() => onToggle(track.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ShelfCard({
  track,
  active,
  isPlaying,
  isDaily,
  onToggle,
}: {
  track: Track;
  active: boolean;
  isPlaying: boolean;
  isDaily: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="relative w-[9.75rem] shrink-0 snap-start sm:w-44">
      <button
        type="button"
        data-saved-tablet={track.id}
        onPointerDown={noteUserGesture}
        onClick={onToggle}
        className="group relative block w-full overflow-hidden text-left"
      >
        <img
          src={track.image}
          alt=""
          loading="lazy"
          className="aspect-square w-full object-cover outline-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
        />
        <div
          className={cn(
            "absolute inset-0 bg-linear-to-t from-bg via-bg/20 to-transparent",
            isPlaying ? "opacity-100" : "opacity-80",
          )}
        />
        {active ? (
          <span className="absolute inset-0 ring-2 ring-accent ring-inset" />
        ) : null}
        {isDaily ? (
          <span className="absolute top-2 left-2 z-10 bg-accent px-2 py-1 text-[0.6rem] font-medium tracking-[0.16em] text-bg uppercase">
            Today
          </span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 z-[6] p-2.5">
          <span className="block truncate font-display text-base leading-tight text-fg">
            {track.title}
          </span>
          <span className="mt-1 line-clamp-2 text-[0.65rem] leading-relaxed text-fg/80">
            {getMeaning(track.id)}
          </span>
        </span>
      </button>
      <div className="absolute top-1.5 right-1.5 z-10">
        <HeartButton id={track.id} className="size-10 bg-bg/55 text-fg" />
      </div>
    </li>
  );
}
