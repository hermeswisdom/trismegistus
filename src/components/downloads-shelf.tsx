import { Pause, Play, Trash2 } from "lucide-react";
import {
  formatOfflineBytes,
  formatStorageLine,
  OFFLINE_DEVICE_NOTE,
  saveErrorCopy,
} from "@/lib/offline-library";
import { useOfflineSaves } from "@/lib/offline-store";
import { useHydrated } from "@/lib/use-hydrated";
import { getTrack } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { noteUserGesture } from "@/lib/sc-widget";
import { cn } from "@/lib/utils";

export function DownloadsShelf() {
  const hydrated = useHydrated();
  const items = useOfflineSaves((s) => s.items);
  const missing = useOfflineSaves((s) => s.missing);
  const usage = useOfflineSaves((s) => s.usage);
  const supported = useOfflineSaves((s) => s.supported);
  const ready = useOfflineSaves((s) => s.ready);
  const remove = useOfflineSaves((s) => s.remove);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const toggleTrack = usePlayer((s) => s.toggleTrack);

  const showItems = hydrated && ready ? items : [];
  const storageLine =
    hydrated && ready && showItems.length > 0
      ? formatStorageLine({ used: usage.used, quota: usage.quota, count: showItems.length })
      : null;

  return (
    <section id="downloads" className="border-t border-border bg-elevated/20">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">Downloads</p>
        <h2 className="mt-3 font-display text-section text-fg">On this device.</h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
          Save a listening copy of a tablet, then play it with the screen off the network.
          Not Auto Mix, and not the £0.99 master.
        </p>
        <p className="mt-3 max-w-lg text-xs leading-relaxed text-subtle">{OFFLINE_DEVICE_NOTE}</p>
        {storageLine ? (
          <p className="mt-3 text-xs tracking-[0.14em] text-subtle uppercase" data-offline-storage="">
            {storageLine}
          </p>
        ) : null}
        {hydrated && ready && !supported ? (
          <p className="mt-8 border border-border px-5 py-8 text-sm text-muted">
            {saveErrorCopy("unsupported")}
          </p>
        ) : showItems.length === 0 ? (
          <p data-downloads-empty="" className="mt-8 border border-border px-5 py-8 text-sm text-muted">
            No downloads yet. Play a tablet and tap Save offline — they gather here.
          </p>
        ) : (
          <ul data-downloads-shelf="" className="mt-8 divide-y divide-border border border-border">
            {showItems.map((row) => {
              const track = getTrack(row.id) ?? getTrack(row.slug);
              const active = track?.id === currentId;
              const isPlaying = Boolean(active && playing);
              return (
                <li
                  key={row.slug}
                  data-download-slug={row.slug}
                  className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4"
                >
                  <button
                    type="button"
                    onPointerDown={noteUserGesture}
                    onClick={() => track && toggleTrack(track.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-label={isPlaying ? `Pause ${row.title}` : `Play ${row.title}`}
                  >
                    <img
                      src={row.image}
                      alt=""
                      className="size-14 shrink-0 object-cover sm:size-16"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-base leading-tight text-fg">
                        {row.title}
                      </span>
                      <span className="mt-1 block text-[0.65rem] tracking-[0.14em] text-subtle uppercase">
                        {formatOfflineBytes(row.bytes)} · {row.bitrateKbps} kbps
                        {active ? (isPlaying ? " · playing" : " · paused") : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center",
                        isPlaying ? "bg-accent text-bg" : "bg-elevated text-fg",
                      )}
                    >
                      {isPlaying ? (
                        <Pause className="size-4" fill="currentColor" />
                      ) : (
                        <Play className="ml-px size-4" fill="currentColor" />
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-remove-download={row.slug}
                    aria-label={`Remove ${row.title} from this device`}
                    onClick={() => void remove(row.slug)}
                    className="flex size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hydrated && ready && missing.length > 0 ? (
          <p className="mt-4 text-xs leading-relaxed text-accent" data-downloads-missing="">
            {saveErrorCopy("evicted")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
