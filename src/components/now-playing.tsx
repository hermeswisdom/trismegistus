import { useEffect, useLayoutEffect, useRef } from "react";
import { Pause, Play, SkipForward, Dices } from "lucide-react";
import { HeartButton, ShareButton } from "@/components/track-actions";
import { MarkButton } from "@/components/mark-button";
import { ReadButton } from "@/components/read-button";
import { FEATURED_ID, embedSrc, getMeaning, getTrack } from "@/lib/rooms";
import { useHearts } from "@/lib/hearts";
import { usePlayer } from "@/lib/player-store";
import {
  bindLiveWidget,
  getLiveWidget,
  loadSoundCloudApi,
  noteUserGesture,
  setLiveIframe,
  setLiveWidget,
  subscribePlayback,
} from "@/lib/sc-widget";
import { hydrateWaveform } from "@/lib/waveform";
import { cn } from "@/lib/utils";

export function NowPlaying() {
  const entered = usePlayer((s) => s.entered);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const playError = usePlayer((s) => s.playError);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = usePlayer((s) => s.duration);
  const toggle = usePlayer((s) => s.toggle);
  const playNext = usePlayer((s) => s.playNext);
  const retryPlay = usePlayer((s) => s.retryPlay);
  const spinTablet = usePlayer((s) => s.spinTablet);
  const seek = usePlayer((s) => s.seek);
  const setTiming = usePlayer((s) => s.setTiming);
  const hydrateHearts = useHearts((s) => s.hydrate);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialSrc = useRef(embedSrc(getTrack(FEATURED_ID)?.soundId ?? "", false));
  const current = getTrack(currentId);
  const featured = getTrack(FEATURED_ID);
  const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  useEffect(() => {
    hydrateHearts();
  }, [hydrateHearts]);

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setLiveIframe(iframe);
    let cancelled = false;

    const attach = () => {
      void loadSoundCloudApi()
        .then((SC) => {
          if (cancelled || !iframeRef.current) return;
          const widget = SC.Widget(iframeRef.current);
          bindLiveWidget(
            widget,
            SC.Widget.Events,
            getTrack(usePlayer.getState().currentId)?.soundId ?? null,
          );
          hydrateWaveform(widget);
        })
        .catch(() => {
          /* iframe src fallback still starts playback without the API */
        });
    };

    attach();
    iframe.addEventListener("load", attach);
    const off = subscribePlayback((notice) => {
      if (notice.type === "play" || notice.type === "ready") {
        const widget = getLiveWidget();
        if (widget) hydrateWaveform(widget);
      }
      if (notice.type === "progress") {
        const pos =
          ((notice.raw as { currentPosition?: number } | undefined)?.currentPosition ?? 0) /
          1000;
        const dur = usePlayer.getState().duration;
        if (dur > 0) {
          setTiming(pos, dur);
          return;
        }
        getLiveWidget()?.getDuration((ms) => setTiming(pos, ms / 1000));
      }
    });

    return () => {
      cancelled = true;
      off();
      iframe.removeEventListener("load", attach);
      setLiveWidget(null, null);
      setLiveIframe(null);
    };
  }, [featured?.soundId, setTiming]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const widget = getLiveWidget();
      if (!widget) return;
      try {
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
    noteUserGesture();
    document.getElementById("wheel")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    spinTablet();
  }

  function onPlayToggle() {
    noteUserGesture();
    if (playError) retryPlay();
    else toggle();
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        entered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
      data-player-current={current.id}
      data-player-playing={playing ? "true" : "false"}
      data-player-blocked={playError ? "true" : "false"}
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
      {playError ? (
        <p className="mx-auto max-w-6xl px-3 pt-2 text-[0.7rem] tracking-[0.16em] text-accent uppercase sm:px-8">
          {playError}
        </p>
      ) : null}
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
          onPointerDown={noteUserGesture}
          onClick={spinFromDock}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
          aria-label="Random song"
        >
          <Dices className="size-4" />
        </button>
        <button
          type="button"
          onPointerDown={noteUserGesture}
          onClick={onPlayToggle}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center bg-accent text-bg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
          aria-label={playError ? "Retry play" : playing ? "Pause" : "Play"}
        >
          {playing && !playError ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="ml-px size-4" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          onPointerDown={noteUserGesture}
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
          src={initialSrc.current}
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
