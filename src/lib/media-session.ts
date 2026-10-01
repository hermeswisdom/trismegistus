/**
 * Lock-screen / notification controls (Media Session API) for the native
 * <audio> player. iOS hides next / previous when seekbackward / seekforward
 * handlers exist, so only play, pause, previoustrack, nexttrack and seekto
 * are registered, and they are (re)registered once audio is playing.
 */
import { debugEvent } from "@/lib/audio-debug";
import { mediaArtwork } from "@/lib/streams";

export type MediaSessionHandlers = {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (seconds: number) => void;
};

let handlers: MediaSessionHandlers | null = null;

function session(): MediaSession | null {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return null;
  return navigator.mediaSession;
}

export function configureMediaSession(next: MediaSessionHandlers) {
  handlers = next;
  registerMediaSessionActions();
}

/** Call again on every native `playing` (iOS only keeps handlers set after playback starts). */
export function registerMediaSessionActions() {
  const ms = session();
  if (!ms || !handlers) return;
  const h = handlers;
  const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      /* action not supported here */
    }
  };
  const log = (action: string) => debugEvent("media-session", action);
  set("play", () => {
    log("play");
    h.play();
  });
  set("pause", () => {
    log("pause");
    h.pause();
  });
  set("stop", () => {
    log("stop");
    h.pause();
  });
  set("nexttrack", () => {
    log("nexttrack");
    h.next();
  });
  set("previoustrack", () => {
    log("previoustrack");
    h.previous();
  });
  set("seekto", (details) => {
    log(`seekto ${details.seekTime}`);
    if (typeof details.seekTime === "number" && Number.isFinite(details.seekTime)) h.seekTo(details.seekTime);
  });
  set("seekbackward", null);
  set("seekforward", null);
}

export function setMediaSessionTrack(track: { title: string; image: string } | null | undefined) {
  const ms = session();
  if (!ms || typeof window === "undefined") return;
  try {
    if (!track) {
      ms.metadata = null;
      return;
    }
    const Ctor = (window as Window & { MediaMetadata?: typeof MediaMetadata }).MediaMetadata;
    if (!Ctor) return;
    ms.metadata = new Ctor({
      title: track.title,
      artist: "Atman",
      album: "Atman Music",
      artwork: mediaArtwork(track.image, window.location.origin),
    });
  } catch {
    /* metadata unsupported */
  }
}

export function setMediaSessionPlaying(playing: boolean) {
  const ms = session();
  if (!ms) return;
  try {
    ms.playbackState = playing ? "playing" : "paused";
  } catch {
    /* ignore */
  }
}

export function setMediaSessionPosition(elapsed: number, duration: number) {
  const ms = session();
  if (!ms || typeof ms.setPositionState !== "function") return;
  if (!(duration > 0) || !Number.isFinite(duration)) return;
  try {
    ms.setPositionState({
      duration,
      position: Math.min(duration, Math.max(0, elapsed)),
      playbackRate: 1,
    });
  } catch {
    /* ignore */
  }
}
