import { Crown } from "lucide-react";
import { MarksPulse } from "@/components/marks-pulse";
import { usePlayBoard } from "@/lib/play-board";
import { getMeaning, getTrack } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { cn } from "@/lib/utils";

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function Leaderboard() {
  const rows = usePlayBoard((s) => s.rows);
  const recent = usePlayBoard((s) => s.recent);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const play = usePlayer((s) => s.play);
  const pause = usePlayer((s) => s.pause);

  return (
    <section id="board" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
          Played the most
        </p>
        <h2 className="mt-3 font-display text-section text-fg">
          The board.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          Every listen writes a mark. Rank is the count. No names. No accounts.
        </p>

        {recent.length > 0 ? (
          <div className="mt-10">
            <MarksPulse recent={recent} />
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="mt-12 border border-border px-5 py-8 text-sm text-muted">
            No marks yet. Press play. The first tablet takes the crown.
          </p>
        ) : (
          <ol className="mt-12 divide-y divide-border border-y border-border">
            {rows.map((row, index) => {
              const track = getTrack(row.trackId);
              if (!track) return null;
              const active = track.id === currentId;
              const isPlaying = active && playing;
              const crowned = index === 0;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() =>
                      isPlaying ? pause() : play(track.id)
                    }
                    className="group flex w-full items-center gap-4 py-4 text-left transition-colors duration-150 hover:bg-elevated/60 sm:gap-6 sm:py-5"
                  >
                    <span className="relative w-10 shrink-0 font-display text-xl text-accent sm:w-12 sm:text-2xl">
                      {NUMERALS[index] ?? index + 1}
                      {crowned ? (
                        <Crown
                          className="absolute -top-2 left-1/2 size-3.5 -translate-x-1/2 text-accent sm:size-4"
                          aria-label="Crown"
                        />
                      ) : null}
                    </span>
                    <img
                      src={track.image}
                      alt=""
                      className={cn(
                        "size-14 shrink-0 object-cover sm:size-16",
                        active && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
                        crowned && !active && "ring-1 ring-accent/70",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg leading-tight text-fg sm:text-xl">
                        {track.title}
                      </span>
                      <span className="mt-1 block truncate text-xs leading-relaxed text-subtle">
                        {getMeaning(track.id)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-2xl text-accent sm:text-3xl">
                        {row.plays}
                      </span>
                      <span className="block text-xs tracking-[0.16em] text-subtle uppercase">
                        {row.plays === 1 ? "mark" : "marks"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
