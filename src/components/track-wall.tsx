import { useEffect } from "react";
import { Pause, Play, Dices } from "lucide-react";
import { HermesNote } from "@/components/hermes-note";
import { HeartButton, ShareButton } from "@/components/track-actions";
import { MarkButton } from "@/components/mark-button";
import { TileMarkDrift } from "@/components/mark-drift";
import { useMarksFeed } from "@/lib/marks-feed";
import {
  ROOMS,
  TRACKS,
  tracksInRoom,
  unassignedTracks,
  type StyleRoom,
  type Track,
} from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { useWheelSpin } from "@/lib/wheel-spin";
import { cn } from "@/lib/utils";

export function TrackWall() {
  const entered = usePlayer((s) => s.entered);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const play = usePlayer((s) => s.play);
  const pause = usePlayer((s) => s.pause);
  const requestSpin = useWheelSpin((s) => s.requestSpin);
  const hydrateMarks = useMarksFeed((s) => s.hydrate);
  const current = TRACKS.find((t) => t.id === currentId) ?? TRACKS[0];
  const loose = unassignedTracks();

  useEffect(() => {
    void hydrateMarks();
  }, [hydrateMarks]);

  return (
    <section id="top" className="relative">
      <div className="relative isolate min-h-dvh overflow-hidden">
        {current ? (
          <img
            src={current.image}
            alt=""
            className="absolute inset-0 size-full object-cover outline-none brightness-110"
          />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/55 to-bg/30" />
        <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-end px-5 pb-32 pt-28 sm:px-8">
          <p className="text-xs font-medium tracking-[0.42em] text-accent uppercase">
            Esoteric music · {ROOMS.length} genres
          </p>
          <h1 className="mt-4">
            {entered ? (
              <HermesNote playing={playing} align="start" />
            ) : (
              <span className="hermes-word">TRISMEGISTUS</span>
            )}
          </h1>
          <p className="mt-5 max-w-md text-lead font-light text-fg/85">
            {TRACKS.length} tablets. Each style is a room. The cover is the
            current.
          </p>
          {current ? (
            <div className="mt-10 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => (playing ? pause() : play(current.id))}
                className="inline-flex h-12 w-fit items-center gap-2 bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
              >
                {playing ? (
                  <>
                    <Pause className="size-3.5" fill="currentColor" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="ml-px size-3.5" fill="currentColor" />
                    Play {current.title}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("wheel")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  requestSpin();
                }}
                className="inline-flex h-12 w-fit items-center gap-2 bg-elevated px-5 text-xs font-medium tracking-[0.2em] text-fg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
              >
                <Dices className="size-3.5" />
                Random
              </button>
              <HeartButton id={current.id} className="bg-elevated" />
              <ShareButton track={current} className="bg-elevated" />
              <MarkButton trackId={current.id} className="bg-elevated" />
            </div>
          ) : null}
        </div>
      </div>

      <div id="work" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            The wall
          </p>
          <h2 className="mt-3 font-display text-section text-fg">
            Hip-hop. Dance. Soul. Filed by the sound.
          </h2>
        </div>

        <nav
          className="sticky top-16 z-20 border-y border-border bg-bg/90"
          aria-label="Genres"
        >
          <ul className="mx-auto flex max-w-6xl flex-wrap gap-1 px-5 py-2 sm:px-8">
            {ROOMS.map((room) => (
              <li key={room.id} className="shrink-0">
                <a
                  href={`#genre-${room.id}`}
                  className="block px-3 py-2.5 text-xs font-medium tracking-[0.18em] text-muted uppercase transition-colors duration-150 hover:text-accent"
                >
                  {room.style}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {ROOMS.map((room) => (
          <GenreBlock key={room.id} room={room} />
        ))}
        {loose.length > 0 ? (
          <GenreBlock
            room={{
              id: "loose",
              name: "Unfiled",
              numeral: "—",
              style: "Other",
              epithet: "Still finding the room",
              note: "Tablets not yet seated in a style.",
              backdrop: loose[0].image,
              trackIds: loose.map((t) => t.id),
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function GenreBlock({ room }: { room: StyleRoom }) {
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const play = usePlayer((s) => s.play);
  const pause = usePlayer((s) => s.pause);
  const tracks = tracksInRoom(room);

  return (
    <section
      id={`genre-${room.id}`}
      className="border-t border-border scroll-mt-32"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-16">
        <header className="lg:sticky lg:top-36 lg:self-start">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            {room.numeral} · {room.style}
          </p>
          <h3 className="mt-3 font-display text-section text-fg">{room.name}</h3>
          <p className="mt-3 text-xs tracking-[0.16em] text-muted uppercase">
            {room.epithet}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg/80">
            {room.note}
          </p>
          <p className="mt-5 text-xs tracking-[0.2em] text-subtle uppercase">
            {tracks.length} tablets
          </p>
        </header>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
          {tracks.map((track) => (
            <GenreTile
              key={track.id}
              track={track}
              styleLabel={room.style}
              active={track.id === currentId}
              isPlaying={track.id === currentId && playing}
              onToggle={() =>
                track.id === currentId && playing ? pause() : play(track.id)
              }
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function GenreTile({
  track,
  styleLabel,
  active,
  isPlaying,
  onToggle,
}: {
  track: Track;
  styleLabel: string;
  active: boolean;
  isPlaying: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="relative">
      <button
        type="button"
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
            "absolute inset-0 bg-linear-to-t from-bg via-bg/20 to-transparent transition-opacity duration-200",
            isPlaying ? "opacity-100" : "opacity-80 group-hover:opacity-90",
          )}
        />
        {active ? (
          <span className="absolute inset-0 ring-2 ring-accent ring-inset" />
        ) : null}
        <TileMarkDrift trackId={track.id} />
        <span className="absolute inset-x-0 bottom-0 z-[6] p-3 sm:p-4">
          <span className="block text-xs tracking-[0.2em] text-accent uppercase">
            {styleLabel}
          </span>
          <span className="mt-1 block truncate font-display text-lg leading-tight text-fg sm:text-xl">
            {track.title}
          </span>
        </span>
      </button>
      <div className="absolute top-2 right-2 z-10 flex">
        <HeartButton
          id={track.id}
          className="size-11 bg-bg/55 text-fg"
        />
        <ShareButton
          track={track}
          className="size-11 bg-bg/55 text-fg"
        />
        <MarkButton
          trackId={track.id}
          className="size-11 bg-bg/55 text-fg"
        />
      </div>
    </li>
  );
}
