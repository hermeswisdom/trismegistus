import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { Pause, Play, SkipForward, Dices } from "lucide-react";
import { HeartButton, ShareButton } from "@/components/track-actions";
import { MarkButton } from "@/components/mark-button";
import { ReadButton } from "@/components/read-button";
import {
  PLAY_PENDING_COPY,
  playControlAria,
  playControlFace,
  playControlShowsPause,
  pickTapTarget,
  soundcloudPlaylistSrc,
  tapOverlayPlacement,
  tapTargetNudge,
  type TapTargetCandidate,
} from "@/lib/playback";
import { TRACKS, getMeaning, getTrack } from "@/lib/rooms";
import { useHearts } from "@/lib/hearts";
import { usePlayer } from "@/lib/player-store";
import {
  bindLiveWidget,
  getLiveWidget,
  getPlaybackSurface,
  loadSoundCloudApi,
  noteUserGesture,
  setCatalogSoundIds,
  setLiveIframe,
  setLiveWidget,
  subscribePlayback,
} from "@/lib/sc-widget";
import { hydrateWaveform } from "@/lib/waveform";
import { cn } from "@/lib/utils";

/**
 * While a start is refused ("Tap to play"), lift the widget iframe over the
 * visible Tap to play / Retry control, clipped to SoundCloud's own play
 * button and invisible. The user's tap then lands inside the SoundCloud
 * frame, which is the only tap strict autoplay (Chrome's user-gesture
 * policy, Android) accepts for a cross-origin player; the widget is already
 * cued on the right tablet. Mouse users get the control under the pointer.
 */
function useTapOverlay(
  active: boolean,
  iframeRef: RefObject<HTMLIFrameElement | null>,
) {
  // Layout effect: the overlay is placed in the same commit that shows the
  // Tap to play face, before the browser paints it.
  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!active || !iframe) return;
    const root = document.documentElement;
    let hovered: "wheel" | "dock" | null = null;
    let frame = 0;
    let nudged = false;

    const place = () => {
      frame = 0;
      const els = document.querySelectorAll<HTMLElement>("[data-sc-tap-target]");
      const candidates: TapTargetCandidate[] = [];
      els.forEach((el) => {
        const kind = el.dataset.scTapTarget === "wheel" ? "wheel" : "dock";
        const r = el.getBoundingClientRect();
        candidates.push({ kind, rect: { left: r.left, top: r.top, width: r.width, height: r.height } });
      });
      const dock = document.querySelector<HTMLElement>("[data-player-current]");
      const dockTop = dock?.getBoundingClientRect().top ?? window.innerHeight;
      const wheel = candidates.find((c) => c.kind === "wheel");
      if (wheel && !nudged) {
        // Once per refusal: if the wheel's Tap to play landed just behind the
        // dock (phones, long meanings), bring it clear so it can be covered.
        nudged = true;
        const delta = tapTargetNudge(wheel.rect, { height: window.innerHeight, dockTop });
        if (delta !== 0) {
          window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
          place();
          return;
        }
      }
      const target = pickTapTarget(
        candidates,
        { width: window.innerWidth, height: window.innerHeight, dockTop },
        hovered,
      );
      if (!target) {
        iframe.removeAttribute("data-sc-tap-overlay");
        delete root.dataset.scTapReady;
        return;
      }
      const spot = tapOverlayPlacement(target.rect);
      iframe.setAttribute("data-sc-tap-overlay", target.kind);
      iframe.style.left = `${spot.left}px`;
      iframe.style.top = `${spot.top}px`;
      iframe.style.clipPath = spot.clipPath;
      // The wheel's Tap to play face stays hidden (styles.css) until the
      // overlay really sits on it, so a tap can't beat the overlay.
      root.dataset.scTapReady = target.kind;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(place);
    };
    const onMove = (e: PointerEvent) => {
      // Mouse only. On touch, pointerover fires on touchstart; moving the
      // iframe then made WebKit drop the tap's click entirely.
      if (e.pointerType !== "mouse") return;
      const hit = (e.target as Element | null)?.closest?.("[data-sc-tap-target]") as HTMLElement | null;
      const next = hit ? (hit.dataset.scTapTarget === "wheel" ? "wheel" : "dock") : hovered;
      if (next !== hovered) {
        hovered = next;
        // Synchronously, so the press that follows this move hits the frame.
        place();
      }
    };

    place();
    const poll = window.setInterval(schedule, 250);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("pointermove", onMove, { capture: true, passive: true });
    document.addEventListener("pointerover", onMove, { capture: true, passive: true });
    return () => {
      window.clearInterval(poll);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("pointermove", onMove, { capture: true });
      document.removeEventListener("pointerover", onMove, { capture: true });
      iframe.removeAttribute("data-sc-tap-overlay");
      delete root.dataset.scTapReady;
      iframe.style.left = "";
      iframe.style.top = "";
      iframe.style.clipPath = "";
    };
  }, [active, iframeRef]);
}

export function NowPlaying() {
  const entered = usePlayer((s) => s.entered);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const playError = usePlayer((s) => s.playError);
  const playPending = usePlayer((s) => s.playPending);
  const backend = usePlayer((s) => s.backend);
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
  // One widget for the page life: the whole profile as a playlist. Never
  // rewritten per tablet (a reloaded iframe has no gesture, so iOS refused it).
  const initialSrc = useRef(soundcloudPlaylistSrc());
  const current = getTrack(currentId);
  const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const face = playControlFace({ playing, playPending, playError });
  const showPause = playControlShowsPause(face);
  // The iframe overlay is only for a refused SoundCloud start. A refused
  // native start is retried by a plain tap on our own button.
  useTapOverlay(Boolean(playError) && entered && backend === "sc", iframeRef);

  useEffect(() => {
    document.documentElement.dataset.playerBackend = backend;
  }, [backend]);

  useEffect(() => {
    hydrateHearts();
  }, [hydrateHearts]);

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setLiveIframe(iframe);
    setCatalogSoundIds(TRACKS.map((track) => track.soundId));
    let cancelled = false;
    let readyCheck = 0;

    // api.js is loaded async from <head> so it is listening before the
    // player posts READY. This iframe is never reloaded per tablet any more,
    // so if READY was still missed, reload the idle widget once.
    void loadSoundCloudApi()
      .then((SC) => {
        const el = iframeRef.current;
        if (cancelled || !el) return;
        const widget = SC.Widget(el);
        bindLiveWidget(widget, SC.Widget.Events);
        hydrateWaveform(widget);
        readyCheck = window.setTimeout(() => {
          if (!cancelled && !getPlaybackSurface().widgetReady) {
            el.setAttribute("src", initialSrc.current);
          }
        }, 8000);
      })
      .catch(() => {
        /* no SoundCloud API: a play shows "Tap to play" after the timeout */
      });

    const off = subscribePlayback((notice) => {
      if (notice.type === "play" || notice.type === "ready") {
        const widget = getLiveWidget();
        if (widget) hydrateWaveform(widget);
      }
      if (notice.type === "progress" && usePlayer.getState().backend === "sc") {
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
      window.clearTimeout(readyCheck);
      off();
      setLiveWidget(null, null);
      setLiveIframe(null);
    };
  }, [setTiming]);

  useEffect(() => {
    // The native player reports its own timing (native-audio.ts progress).
    if (!playing || backend !== "sc") return;
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
  }, [playing, backend, setTiming]);

  if (!current) return null;

  function spinFromDock() {
    noteUserGesture();
    document.getElementById("wheel")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    spinTablet();
  }

  function onPlayToggle() {
    // Widget command first, in the click's own turn; bookkeeping after.
    if (playError) retryPlay();
    else toggle();
    noteUserGesture();
  }

  return (
    <>
    {/*
      The SoundCloud widget draws its waveform on a canvas sized from the
      iframe's layout box. At 20×20 that canvas is 0 wide and the widget's own
      draw() throws "createPattern … width or height of 0" (~10× per load),
      which we cannot catch across origins. So the iframe gets the widget's
      natural 320×166 layout, and clip-path paints only the same 20×20
      bottom-right corner as before. The visible footprint (kept on screen at
      full opacity for iOS Safari autoplay) and z-order behind the dock are
      unchanged.
    */}
    <iframe
      ref={iframeRef}
      title="SoundCloud"
      src={initialSrc.current}
      allow="autoplay; encrypted-media"
      className="sc-host-frame pointer-events-none fixed right-0 bottom-0 z-30 opacity-100"
      loading="eager"
    />
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        entered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
      data-player-current={current.id}
      data-player-playing={playing ? "true" : "false"}
      data-player-pending={playPending ? "true" : "false"}
      data-player-blocked={playError ? "true" : "false"}
      data-player-face={face}
      data-player-backend={backend}
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
      ) : playPending ? (
        <p className="mx-auto max-w-6xl px-3 pt-2 text-[0.7rem] tracking-[0.16em] text-subtle uppercase sm:px-8">
          {PLAY_PENDING_COPY}
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
          className="text-muted hover:text-fg"
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
          aria-label={playControlAria(face)}
          data-sc-tap-target={playError && backend === "sc" ? "dock" : undefined}
        >
          {showPause ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="ml-px size-4" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          onPointerDown={noteUserGesture}
          onClick={() => playNext()}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
          aria-label="Next tablet"
        >
          <SkipForward className="size-4" />
        </button>
      </div>
      <div className="relative mx-auto h-5 max-w-6xl overflow-hidden px-3 sm:px-8">
        <a
          href={current.permalink}
          target="_blank"
          rel="noreferrer"
          className="mt-1 hidden text-xs tracking-[0.18em] text-subtle uppercase hover:text-muted sm:inline-block"
        >
          SoundCloud
        </a>
      </div>
    </div>
    </>
  );
}
