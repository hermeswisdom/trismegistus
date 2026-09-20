import { useEffect, useRef } from "react";
import { Pause, Play, SkipForward, Dices } from "lucide-react";
import { HeartButton, ShareButton } from "@/components/track-actions";
import { MarkButton } from "@/components/mark-button";
import { FEATURED_ID, embedSrc, getTrack, roomForTrack } from "@/lib/rooms";
import { useHearts } from "@/lib/hearts";
import { usePlayer } from "@/lib/player-store";
import { useWheelSpin } from "@/lib/wheel-spin";
import {
  getLiveSoundId,
  loadSoundCloudApi,
  setLiveSoundId,
  setLiveWidget,
} from "@/lib/sc-widget";
import { cn, formatElapsed } from "@/lib/utils";

export function NowPlaying() {
  const entered = usePlayer((s) => s.entered);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = usePlayer((s) => s.duration);
  const toggle = usePlayer((s) => s.toggle);
  const playNext = usePlayer((s) => s.playNext);
  const requestSpin = useWheelSpin((s) => s.requestSpin);
  const seek = usePlayer((s) => s.seek);
  const setPlaying = usePlayer((s) => s.setPlaying);
  const setTiming = usePlayer((s) => s.setTiming);
  const hydrateHearts = useHearts((s) => s.hydrate);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const current = getTrack(currentId);
  const featured = getTrack(FEATURED_ID);
  const room = roomForTrack(currentId);
  const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  useEffect(() => {
    hydrateHearts();
  }, [hydrateHearts]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    void loadSoundCloudApi()
      .then((SC) => {
        if (cancelled || !iframeRef.current) return;
        const widget = SC.Widget(iframeRef.current);
        setLiveWidget(widget, featured?.soundId ?? null);
        widget.bind(SC.Widget.Events.READY, () => {
          const state = usePlayer.getState();
          const track = getTrack(state.currentId);
          if (!track) return;
          if (getLiveSoundId() !== track.soundId) {
            setLiveSoundId(track.soundId);
            widget.load(track.permalink, { auto_play: state.playing });
            return;
          }
          if (state.playing) widget.play();
        });
        widget.bind(SC.Widget.Events.PLAY, () => setPlaying(true));
        widget.bind(SC.Widget.Events.PAUSE, () => setPlaying(false));
        widget.bind(SC.Widget.Events.FINISH, () => {
          setPlaying(false);
          usePlayer.getState().playNext();
        });
      })
      .catch(() => {
        /* iframe still plays without the API */
      });
    return () => {
      cancelled = true;
      setLiveWidget(null, null);
    };
  }, [featured?.soundId, setPlaying]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const iframe = iframeRef.current;
      const SC = window.SC;
      if (!iframe || !SC) return;
      try {
        const widget = SC.Widget(iframe);
        widget.getPosition((pos) => {
          widget.getDuration((dur) => {
            setTiming(pos / 1000, dur / 1000);
          });
        });
      } catch {
        /* ignore */
      }
    }, 800);
    return () => window.clearInterval(id);
  }, [playing, setTiming]);

  if (!current || !featured) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        entered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          seek(x);
        }}
        className="block h-1.5 w-full bg-elevated"
        aria-label="Seek"
      >
        <span
          className="block h-full origin-left bg-accent transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </button>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:px-8">
        <img
          src={current.image}
          alt=""
          className="size-12 shrink-0 object-cover sm:size-14"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base italic text-fg sm:text-lg">
            {current.title}
          </p>
          <p className="truncate text-xs tracking-wider text-subtle uppercase">
            {room?.name ?? current.recorded} · {formatElapsed(elapsed)}
            {duration > 0 ? ` / ${formatElapsed(duration)}` : ""}
          </p>
        </div>
        <HeartButton id={current.id} className="text-muted hover:text-fg" />
        <ShareButton track={current} className="text-muted hover:text-fg" />
        <MarkButton trackId={current.id} className="text-muted hover:text-fg" />
        <button
          type="button"
          onClick={() => {
            document.getElementById("wheel")?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            requestSpin();
          }}
          className="flex size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
          aria-label="Random song"
        >
          <Dices className="size-4" />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex size-11 shrink-0 items-center justify-center bg-accent text-bg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="ml-px size-4" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          onClick={playNext}
          className="hidden size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-fg sm:flex"
          aria-label="Next tablet"
        >
          <SkipForward className="size-4" />
        </button>
      </div>
      <div className="mx-auto max-w-6xl px-3 pb-2 sm:px-8">
        <iframe
          ref={iframeRef}
          title={`SoundCloud — ${current.title}`}
          src={embedSrc(featured.soundId, false)}
          allow="autoplay; encrypted-media"
          className="h-5 w-full border-0"
          loading="eager"
        />
        <a
          href={current.permalink}
          target="_blank"
          rel="noreferrer"
          className="mt-1 hidden text-xs tracking-[0.18em] text-subtle uppercase hover:text-muted sm:inline-block"
        >
          SoundCloud · esoteric_vibrations
        </a>
      </div>
    </div>
  );
}
