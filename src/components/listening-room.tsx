import { Pause, Play } from "lucide-react";
import { ROOMS, tracksInRoom, type StyleRoom, type Track } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { cn } from "@/lib/utils";

export function ListeningRoom() {
  return (
    <>
      {ROOMS.map((room) => (
        <RoomSection key={room.id} room={room} />
      ))}
    </>
  );
}

function RoomSection({ room }: { room: StyleRoom }) {
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const play = usePlayer((s) => s.play);
  const pause = usePlayer((s) => s.pause);
  const tracks = tracksInRoom(room);
  const activeHere = tracks.some((t) => t.id === currentId);
  const featured =
    tracks.find((t) => t.id === currentId) ?? tracks[0];

  function onTrack(track: Track) {
    if (track.id === currentId && playing) pause();
    else play(track.id);
  }

  return (
    <section
      id={`room-${room.id}`}
      className="relative isolate min-h-dvh overflow-hidden border-t border-border"
    >
      <img
        src={room.backdrop}
        alt=""
        className="absolute inset-0 size-full object-cover outline-none opacity-45 brightness-110"
      />
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/75 to-bg/45" />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-end gap-10 px-5 py-20 pb-44 sm:px-8 lg:py-28 lg:pb-48">
        <div className="max-w-lg">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            Room {room.numeral} · {room.style}
          </p>
          <h2 className="mt-3 font-display text-section italic text-fg">{room.name}</h2>
          <p className="mt-2 text-xs tracking-[0.16em] text-muted uppercase">{room.epithet}</p>
          <p className="mt-5 text-sm leading-relaxed text-fg/80 sm:text-base">{room.note}</p>
          {featured ? (
            <button
              type="button"
              onClick={() => onTrack(featured)}
              className="mt-8 inline-flex h-12 items-center gap-2 bg-fg px-6 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
            >
              {activeHere && playing ? (
                <>
                  <Pause className="size-3.5" fill="currentColor" />
                  Pause room
                </>
              ) : (
                <>
                  <Play className="ml-px size-3.5" fill="currentColor" />
                  Play this room
                </>
              )}
            </button>
          ) : null}
        </div>

        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-10">
          {featured ? (
            <img
              src={featured.image}
              alt=""
              className="hidden aspect-square w-full object-cover lg:block"
            />
          ) : null}

          <ol className="min-w-0 divide-y divide-border border-y border-border bg-bg/50">
            {tracks.map((track, index) => {
              const active = track.id === currentId;
              const isPlaying = active && playing;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => onTrack(track)}
                    className="flex w-full items-center gap-4 px-3 py-3.5 text-left sm:px-4"
                  >
                    <span className="w-6 shrink-0 text-xs tabular-nums tracking-[0.14em] text-subtle">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <img
                      src={track.image}
                      alt=""
                      className="size-14 shrink-0 object-cover sm:size-16"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate font-display text-xl italic sm:text-2xl",
                          active ? "text-fg" : "text-muted",
                        )}
                      >
                        {track.title}
                      </span>
                      <span className="mt-0.5 block text-xs tracking-[0.16em] text-subtle uppercase">
                        {track.recorded}
                      </span>
                    </span>
                    {isPlaying ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-fg" />
                    ) : (
                      <Play className="ml-px size-4 shrink-0 text-muted" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs tracking-[0.22em] uppercase" aria-label="Other rooms">
          {ROOMS.map((other) => (
            <a
              key={other.id}
              href={`#room-${other.id}`}
              className={cn(
                "transition-colors duration-150",
                other.id === room.id ? "text-fg" : "text-subtle hover:text-muted",
              )}
            >
              {other.numeral} {other.name}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
