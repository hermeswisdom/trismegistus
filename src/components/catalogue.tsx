import { ROOMS, SOUNDCLOUD_PROFILE, tracksInRoom } from "@/lib/rooms";

export function Catalogue() {
  return (
    <section id="listen" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium tracking-[0.32em] text-muted uppercase">
              Four doors
            </p>
            <h2 className="mt-3 font-display text-section italic text-fg">Rooms</h2>
          </div>
          <p className="hidden max-w-xs text-right text-sm text-muted sm:block">
            Each style keeps its own room. The full catalog, carried from SoundCloud.
          </p>
        </div>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-5">
          {ROOMS.map((room) => {
            const tracks = tracksInRoom(room);
            return (
              <li key={room.id}>
                <a href={`#room-${room.id}`} className="group block">
                  <div className="relative overflow-hidden">
                    <img
                      src={tracks[0]?.image ?? room.backdrop}
                      alt=""
                      className="aspect-video w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/40 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="text-xs tracking-[0.28em] text-accent uppercase">
                        {room.numeral} · {room.style} · {tracks.length}{" "}
                        {tracks.length === 1 ? "tablet" : "tablets"}
                      </p>
                      <h3 className="mt-1 font-display text-3xl italic text-fg">{room.name}</h3>
                      <p className="mt-1 text-xs tracking-[0.14em] text-muted uppercase">
                        {room.epithet}
                      </p>
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-xs tracking-[0.18em] text-subtle uppercase">
          Source ·{" "}
          <a
            href={SOUNDCLOUD_PROFILE}
            target="_blank"
            rel="noreferrer"
            className="text-muted transition-colors duration-150 hover:text-fg"
          >
            SoundCloud
          </a>
        </p>
      </div>
    </section>
  );
}
