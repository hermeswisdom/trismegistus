import { useEffect, useRef } from "react";
import { Pause, Play, SkipForward, Dices } from "lucide-react";
import { HeartButton, ShareButton } from "@/components/track-actions";
import { MarkButton } from "@/components/mark-button";
import { ReadButton } from "@/components/read-button";
import { FEATURED_ID, embedSrc, getMeaning, getTrack } from "@/lib/rooms";
import { useHearts } from "@/lib/hearts";
import { usePlayer } from "@/lib/player-store";
import { useWheelSpin } from "@/lib/wheel-spin";
import {
  getLiveSoundId,
  loadSoundCloudApi,
  primePlayback,
  setLiveSoundId,
  setLiveWidget,
} from "@/lib/sc-widget";
import { hydrateWaveform } from "@/lib/waveform";
import { cn } from "@/lib/utils";

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
        const pullWave = () => hydrateWaveform(widget);
        widget.bind(SC.Widget.Events.READY, () => {
          const state = usePlayer.getState();
          const track = getTrack(state.currentId);
          if (!track) return;
          if (getLiveSoundId() !== track.soundId) {
            setLiveSoundId(track.soundId);
            widget.load(track.permalink, { auto_play: state.playing });
            return;
          }
          pullWave();
          if (state.playing) widget.play();
        });
        widget.bind(SC.Widget.Events.PLAY, () => {
          setPlaying(true);
          pullWave();
        });
        widget.bind(SC.Widget.Events.PAUSE, () => setPlaying(false));
        widget.bind(SC.Widget.Events.FINISH, () => {
          setPlaying(false);
          usePlayer.getState().playNext();
        });
        widget.bind(SC.Widget.Events.PLAY_PROGRESS, (raw) => {
          const pos = ((raw as { currentPosition?: number }).currentPosition ?? 0) / 1000;
          const dur = usePlayer.getState().duration;
          if (dur > 0) {
            setTiming(pos, dur);
            return;
          }
          widget.getDuration((ms) => setTiming(pos, ms / 1000));
        });
        pullWave();
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

  function spinFromDock() {
    primePlayback();
    document.getElementById("wheel")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    requestSpin();
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        entered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <button
        type="button"
        onPointerUp={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - rect.left) / rect.width);
        }}
        className="block h-2 w-full touch-manipulation bg-elevated sm:h-1.5"
        aria-label="Seek"
      >
        <span
          className="block h-full origin-left bg-accent transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </button>
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-8">
        <img
          src={current.image}
          alt=""
          className="size-11 shrink-0 object-cover sm:size-14"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.95rem] italic text-fg sm:text-lg">
            {current.title}
          </p>
          <p className="truncate text-[0.7rem] tracking-wider text-subtle sm:text-xs">
            {getMeaning(current.id)}
          </p>
        </div>
        <ReadButton
          trackId={current.id}
          className="text-muted hover:text-fg"
        />
        <HeartButton id={current.id} className="text-muted hover:text-fg" />
        <ShareButton
          track={current}
          className="hidden text-muted hover:text-fg sm:flex"
        />
        <MarkButton
          trackId={current.id}
          className="text-muted hover:text-fg"
        />
        <button
          type="button"
          onPointerDown={primePlayback}
          onClick={spinFromDock}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
          aria-label="Random song"
        >
          <Dices className="size-4" />
        </button>
        <button
          type="button"
          onPointerDown={primePlayback}
          onClick={toggle}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center bg-accent text-bg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
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
          onPointerDown={primePlayback}
          onClick={playNext}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
          aria-label="Next tablet"
        >
          <SkipForward className="size-4" />
        </button>
      </div>
      <div className="relative mx-auto h-5 max-w-6xl overflow-hidden px-3 sm:px-8">
        <iframe
          ref={iframeRef}
          title={`SoundCloud — ${current.title}`}
          src={embedSrc(featured.soundId, false)}
          allow="autoplay; encrypted-media"
          className="pointer-events-none absolute inset-x-3 top-0 h-5 w-[calc(100%-1.5rem)] max-w-full border-0 sm:inset-x-8 sm:w-[calc(100%-4rem)]"
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
