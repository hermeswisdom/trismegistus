import {
  IDLE_ATTEMPT,
  PLAY_BLOCKED_COPY,
  PLAY_BLOCKED_SETTLE_MS,
  PLAY_CONFIRM_MS,
  PLAYLIST_WAIT_MS,
  mediaVolumeIgnored,
  planPlayback,
  playlistCovers,
  reduceAttempt,
  type AttemptEvent,
  type AttemptState,
  type PlayCommand,
  type PlaybackOp,
  type PlaybackSurface,
} from "./playback.ts";

export type SCSound = { id?: number | string; title?: string; waveform_url?: string };

export type SCWidget = {
  bind: (event: string, listener: (...args: unknown[]) => void) => void;
  unbind: (event: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  load: (url: string, options?: { auto_play?: boolean; callback?: () => void }) => void;
  skip?: (index: number) => void;
  getSounds?: (cb: (sounds: SCSound[] | null) => void) => void;
  seekTo: (ms: number) => void;
  getPosition: (cb: (ms: number) => void) => void;
  getDuration: (cb: (ms: number) => void) => void;
  getVolume: (cb: (vol: number) => void) => void;
  setVolume: (vol: number) => void;
  getCurrentSound: (cb: (sound: SCSound | null) => void) => void;
};

type SCEvents = {
  READY: string;
  PLAY: string;
  PAUSE: string;
  FINISH: string;
  PLAY_PROGRESS: string;
  ERROR?: string;
};

type SCApi = {
  Widget: {
    (el: HTMLIFrameElement): SCWidget;
    Events: SCEvents;
  };
};

export type PlaybackNotice =
  | { type: "play" }
  | { type: "pause" }
  | { type: "finish" }
  | { type: "ready" }
  | { type: "pending" }
  | { type: "blocked"; message: string }
  | { type: "progress"; raw: unknown };

declare global {
  interface Window {
    SC?: SCApi;
    __ATMAN_SPIN_MS?: number;
    webkitAudioContext?: typeof AudioContext;
  }
}

const SCRIPT = "https://w.soundcloud.com/player/api.js";
let loading: Promise<SCApi> | null = null;

export function loadSoundCloudApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.SC) return Promise.resolve(window.SC);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.SC) resolve(window.SC);
        else reject(new Error("SC missing"));
      });
      existing.addEventListener("error", () => reject(new Error("SC script failed")));
      if (window.SC) resolve(window.SC);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.SC) resolve(window.SC);
      else reject(new Error("SC missing"));
    };
    script.onerror = () => reject(new Error("SC script failed"));
    document.head.appendChild(script);
  });
  return loading;
}

// ---------------------------------------------------------------------------
// Module state — one widget for the page life.
// ---------------------------------------------------------------------------

let live: SCWidget | null = null;
let iframe: HTMLIFrameElement | null = null;
let widgetReady = false;
/** Sound the widget is cued on (or was last told to cue). */
let liveSoundId: string | null = null;
/** Playlist order from `getSounds`, as string ids. */
let playlist: string[] = [];
let catalogIds: string[] = [];
let soundsComplete = false;
/** A single-track `load` replaced the playlist; later sounds load one by one. */
let singleMode = false;
let playlistTimer: ReturnType<typeof setInterval> | null = null;
let playlistStartedAt = 0;

let gestureNoted = false;
/** Real audio has played this page life, so the media element is unlocked. */
let audioUnlocked = false;
let attempt: AttemptState = IDLE_ATTEMPT;
/** A play that could not run this turn (widget or playlist not ready). */
let queued: PlayCommand | null = null;
/** Silent in-gesture start so a later, gesture-less play is allowed (iOS). */
let priming: { startedAt: number; flowing: boolean } | null = null;
/**
 * A prime that has started flowing is not paused: it keeps running at
 * volume 0 until the real play takes it over (landing, ~4 s later). A
 * pause() while SoundCloud is still fetching its first segments aborts that
 * fetch, and SoundCloud's widget then throws an uncaught "AbortError: signal
 * is aborted without reason" inside its frame. skip() and seekTo() don't.
 * This is only a safety stop if no real play ever comes.
 */
export const PRIME_MAX_SILENT_MS = 12000;
let primeTimer: ReturnType<typeof setTimeout> | null = null;
/** Sound a prime left paused a few hundred ms in (restart it from 0 on play). */
let primedSoundId: string | null = null;
/** The next run() takes over from a prime that may still be sounding (at 0). */
let primeHandoff = false;
/**
 * After skipping away from a running prime, volume comes back only once the
 * new sound reports progress: until then the old one can still be heard.
 */
let restoreVolumeFor: string | null = null;
/**
 * A prime sent inside a tap was refused by the browser (it never flowed and
 * SoundCloud paused itself). Strict autoplay then refuses every start the
 * page sends until a tap lands inside the SoundCloud frame, so later starts
 * go straight to "Tap to play" instead of sending a doomed play(): each
 * refused play over partly loaded media makes SoundCloud's widget throw an
 * uncaught AbortError in its frame.
 */
let primeRefused = false;
/** Last widget event seen while priming. */
let primeLastEvent: "play" | "pause" | null = null;
/** Attempt start time we already moved off a wrong cue for (once only). */
let rescuedAttemptAt: number | null = null;

function restoreVolume() {
  restoreVolumeFor = null;
  try {
    live?.setVolume(100);
  } catch {
    /* iframe gone */
  }
}
/** null = detect on first use; tests override. */
let primeSupported: boolean | null = null;

let settleTimer: ReturnType<typeof setTimeout> | null = null;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
let gestureCtx: AudioContext | null = null;
const listeners = new Set<(notice: PlaybackNotice) => void>();

export function subscribePlayback(listener: (notice: PlaybackNotice) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(notice: PlaybackNotice) {
  listeners.forEach((listener) => listener(notice));
}

function now() {
  return Date.now();
}

/** setTimeout that never keeps a Node test process alive. */
function later(fn: () => void, ms: number) {
  const handle = setTimeout(fn, ms);
  (handle as unknown as { unref?: () => void }).unref?.();
  return handle;
}

function resumeWebAudio() {
  if (typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    if (!gestureCtx) gestureCtx = new Ctor();
    void gestureCtx.resume();
  } catch {
    /* Web Audio is optional; the widget is the source. */
  }
}

/** Mark a user gesture. Never plays by itself. */
export function noteUserGesture() {
  gestureNoted = true;
  resumeWebAudio();
}

/** @deprecated Use noteUserGesture. */
export function primePlayback() {
  noteUserGesture();
}

export function isPlaybackUnlocked() {
  return gestureNoted;
}

export function isAudioUnlocked() {
  return audioUnlocked;
}

export function setLiveIframe(el: HTMLIFrameElement | null) {
  iframe = el;
}

export function getLiveIframe() {
  if (iframe?.isConnected) return iframe;
  if (typeof document === "undefined") return iframe;
  const found = document.querySelector<HTMLIFrameElement>('iframe[title^="SoundCloud"]');
  if (found) iframe = found;
  return iframe;
}

export function getLiveWidget() {
  return live;
}

export function getLiveSoundId() {
  return liveSoundId;
}

/** Catalog sound ids; the playlist is "complete" once it holds all of them. */
export function setCatalogSoundIds(ids: readonly string[]) {
  catalogIds = [...ids];
  refreshCompleteness();
}

export function setLiveWidget(widget: SCWidget | null, soundId?: string | null) {
  live = widget;
  widgetReady = false;
  if (soundId !== undefined) liveSoundId = soundId;
  if (!widget) stopPlaylistPoll();
}

// ---------------------------------------------------------------------------
// Attempt tracking
// ---------------------------------------------------------------------------

function clearTimers() {
  if (settleTimer !== null) clearTimeout(settleTimer);
  if (confirmTimer !== null) clearTimeout(confirmTimer);
  settleTimer = null;
  confirmTimer = null;
}

function dispatch(event: AttemptEvent) {
  const result = reduceAttempt(attempt, event);
  attempt = result.state;
  for (const effect of result.effects) {
    if (effect === "clear-timers") clearTimers();
    if (effect === "arm-settle") {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = later(() => {
        settleTimer = null;
        dispatch({ type: "settle-timeout", now: now() });
      }, PLAY_BLOCKED_SETTLE_MS);
    }
    if (effect === "arm-confirm") {
      if (confirmTimer !== null) clearTimeout(confirmTimer);
      confirmTimer = later(() => {
        confirmTimer = null;
        dispatch({ type: "confirm-timeout" });
      }, PLAY_CONFIRM_MS);
    }
  }
  if (result.notice === "play") audioUnlocked = true;
  if (result.notice === "blocked" && restoreVolumeFor !== null) restoreVolume();
  if (result.notice === "blocked") {
    queued = null;
    emit({ type: "blocked", message: PLAY_BLOCKED_COPY });
  } else if (result.notice) {
    emit({ type: result.notice });
  }
}

export function getAttemptPhase() {
  return attempt.phase;
}

// ---------------------------------------------------------------------------
// Playlist
// ---------------------------------------------------------------------------

function refreshCompleteness() {
  if (singleMode) {
    soundsComplete = true;
    return;
  }
  if (playlist.length > 0 && playlistCovers(playlist, catalogIds)) soundsComplete = true;
}

function stopPlaylistPoll() {
  if (playlistTimer !== null) clearInterval(playlistTimer);
  playlistTimer = null;
}

function readPlaylist() {
  const widget = live;
  if (!widget?.getSounds) return;
  try {
    widget.getSounds((sounds) => {
      if (widget !== live || !Array.isArray(sounds)) return;
      playlist = sounds.map((s) => (s?.id === undefined ? "" : String(s.id)));
      refreshCompleteness();
      if (!soundsComplete && now() - playlistStartedAt > PLAYLIST_WAIT_MS) soundsComplete = true;
      if (soundsComplete) stopPlaylistPoll();
      runQueued();
    });
  } catch {
    /* iframe gone */
  }
}

function startPlaylistPoll() {
  stopPlaylistPoll();
  if (singleMode || typeof window === "undefined") return;
  playlistStartedAt = now();
  readPlaylist();
  playlistTimer = setInterval(readPlaylist, 400);
}

/** Test hook: pretend `getSounds` answered. */
export function setPlaylistForTests(ids: string[], complete?: boolean) {
  playlist = [...ids];
  refreshCompleteness();
  if (complete !== undefined) soundsComplete = complete;
  runQueued();
}

export function getPlaybackSurface(soundId?: string): PlaybackSurface {
  return {
    hasWidget: Boolean(live),
    widgetReady,
    liveSoundId,
    soundIndex: soundId ? playlist.indexOf(soundId) : -1,
    soundsComplete,
    audioUnlocked,
  };
}

// ---------------------------------------------------------------------------
// Priming — a silent start inside a tap so the wheel can sound on landing.
// ---------------------------------------------------------------------------

/**
 * Stop a prime. Only pause: the widget stays at volume 0 until the real
 * play restores it (see `run`). Seeking or restoring volume here made
 * SoundCloud resume for 60–150 ms at full volume (Rivet QC on #26).
 */
function endPriming(opts: { pause: boolean }) {
  if (!priming) return;
  priming = null;
  if (primeTimer !== null) clearTimeout(primeTimer);
  primeTimer = null;
  if (!opts.pause) return;
  try {
    live?.pause();
  } catch {
    /* iframe gone */
  }
}

/**
 * Whether a silent (volume 0) prime is really silent here. iOS ignores
 * media volume, so a prime there would be heard: skip it and rely on
 * skip + play inside the tap ("Tap to play" if a later start is refused).
 */
export function canPrimeSilently() {
  if (primeSupported !== null) return primeSupported;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  let volumeSticks: boolean | null = null;
  try {
    const probe = document.createElement("audio");
    probe.volume = 0.5;
    volumeSticks = Math.abs(probe.volume - 0.5) < 0.01;
  } catch {
    volumeSticks = null;
  }
  let coarsePointer = false;
  try {
    coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  } catch {
    /* ignore */
  }
  primeSupported = !mediaVolumeIgnored({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    coarsePointer,
    volumeSticks,
  });
  return primeSupported;
}

/** Test hook: force the silent-prime capability (null = detect). */
export function setPrimeSupportForTests(value: boolean | null) {
  primeSupported = value;
}

/**
 * Call inside a tap when the sound will start later without a gesture
 * (the wheel lands ~4s after Enter / Spin). iOS only lets a media element
 * play without a gesture once it has played from one, so start the widget
 * muted now and pause it as soon as audio flows. No-op once real audio has
 * been heard this page life.
 */
export function primeForLaterPlay(soundId?: string) {
  if (attempt.phase === "pending" || attempt.phase === "playing") return false;
  return startPrime(soundId);
}

function startPrime(soundId?: string) {
  if (audioUnlocked || priming || !live || !widgetReady) return false;
  if (!canPrimeSilently()) return false;
  try {
    live.setVolume(0);
    const index = soundId ? playlist.indexOf(soundId) : -1;
    if (soundId && soundId !== liveSoundId && index >= 0 && live.skip) {
      live.skip(index);
      liveSoundId = soundId;
    }
    live.play();
  } catch {
    return false;
  }
  primedSoundId = liveSoundId;
  priming = { startedAt: now(), flowing: false };
  primeLastEvent = null;
  primeTimer = later(() => {
    const refused = priming !== null && !priming.flowing && primeLastEvent === "pause";
    if (refused) primeRefused = true;
    // A refused prime is already paused; don't poke it again.
    endPriming({ pause: !refused });
  }, 3000);
  return true;
}

/**
 * Spin while a tablet sounds: hush it instead of pausing. A pause() within
 * the first seconds of a start aborts SoundCloud's segment fetch and its
 * widget throws an uncaught AbortError; volume 0 is silent and the landing
 * takes over with skip() exactly like after a prime (12 s safety stop).
 * Falls back to false (caller pauses) where volume is ignored (iOS).
 */
export function quietForSpin() {
  if (!live || priming || !canPrimeSilently()) return false;
  if (attempt.phase !== "playing" && attempt.phase !== "pending") return false;
  try {
    live.setVolume(0);
  } catch {
    return false;
  }
  queued = null;
  dispatch({ type: "stop" });
  // Resume, not restart, if the same tablet is played again.
  primedSoundId = null;
  priming = { startedAt: now(), flowing: true };
  if (primeTimer !== null) clearTimeout(primeTimer);
  primeTimer = later(() => endPriming({ pause: true }), PRIME_MAX_SILENT_MS);
  return true;
}

export function isPriming() {
  return priming !== null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function run(cmd: PlayCommand, op: PlaybackOp) {
  const widget = live;
  const handoff = primeHandoff;
  primeHandoff = false;
  if (!widget) return;
  if (op.op !== "skip-play") restoreVolumeFor = null;
  try {
    if (op.op === "pause") {
      widget.pause();
    } else if (op.op === "play") {
      // Volume back up only now, right before the real play (a prime left
      // it at 0, possibly still running). A primed sound restarts from 0.
      if (primedSoundId !== null && primedSoundId === cmd.soundId) widget.seekTo(0);
      widget.setVolume(100);
      primedSoundId = null;
      widget.play();
    } else if (op.op === "skip-play") {
      primedSoundId = null;
      widget.skip?.(op.index);
      liveSoundId = cmd.soundId;
      if (handoff) {
        // A prime may still be running silently on another sound, which keeps
        // playing for a few ms after skip(). Volume returns on the new
        // sound's first progress (or if the start is refused).
        restoreVolumeFor = cmd.soundId;
      } else {
        widget.setVolume(100);
      }
      widget.play();
    } else if (op.op === "load") {
      // Not in the profile playlist (removed / private on SoundCloud).
      // This reloads the widget; it can need a second tap on iOS.
      singleMode = true;
      soundsComplete = true;
      playlist = [];
      stopPlaylistPoll();
      liveSoundId = cmd.soundId;
      widgetReady = false;
      primedSoundId = null;
      widget.load(cmd.permalink, { auto_play: true });
    }
  } catch {
    /* Widget methods can throw if the iframe is gone. */
  }
}

function runQueued() {
  if (!queued || !live || !widgetReady) return;
  const cmd = queued;
  const op = planPlayback(cmd, getPlaybackSurface(cmd.soundId));
  if (op.op === "wait") return;
  queued = null;
  if (priming) {
    primeHandoff = true;
    endPriming({ pause: false });
  }
  run(cmd, op);
}

/**
 * Start or stop a tablet. Call it synchronously from the tap handler: the
 * `skip` + `play` postMessage must leave in the same turn as the gesture.
 */
export function applyPlayback(cmd: PlayCommand): PlaybackOp {
  if (cmd.intent === "pause") {
    queued = null;
    endPriming({ pause: false });
    dispatch({ type: "stop" });
    const op = planPlayback(cmd, getPlaybackSurface());
    run(cmd, op);
    return op;
  }

  const op = planPlayback(cmd, getPlaybackSurface(cmd.soundId));

  if (primeRefused && !audioUnlocked && (op.op === "play" || op.op === "skip-play")) {
    queued = null;
    if (priming) endPriming({ pause: false });
    restoreVolumeFor = null;
    dispatch({ type: "start", soundId: cmd.soundId, now: now() });
    dispatch({ type: "widget-error" });
    // The overlay tap plays whatever is cued, so cue the target now. skip()
    // alone is refused like any start, but nothing has loaded yet, so
    // SoundCloud has no fetch to abort. Then volume up for that tap.
    try {
      if (op.op === "skip-play") {
        live?.skip?.(op.index);
        liveSoundId = cmd.soundId;
      }
    } catch {
      /* iframe gone */
    }
    restoreVolume();
    return { op: "none" };
  }

  dispatch({ type: "start", soundId: cmd.soundId, now: now() });

  if (op.op === "wait") {
    queued = cmd;
    if (op.prime) startPrime();
    return op;
  }

  queued = null;
  if (priming) {
    primeHandoff = true;
    endPriming({ pause: false });
  }
  run(cmd, op);
  return op;
}

// ---------------------------------------------------------------------------
// Widget binding
// ---------------------------------------------------------------------------

type RawEvent = { soundId?: number | string; currentPosition?: number } | undefined;

function eventSound(raw: unknown) {
  const id = (raw as RawEvent)?.soundId;
  return id === undefined || id === null ? null : String(id);
}

function eventPosition(raw: unknown) {
  const pos = (raw as RawEvent)?.currentPosition;
  return typeof pos === "number" && Number.isFinite(pos) ? pos : 0;
}

/**
 * Bind the one widget. The playlist iframe cues its own first sound, so the
 * cued id comes from `getCurrentSound` on READY, never from the caller.
 */
export function bindLiveWidget(widget: SCWidget, events: SCEvents) {
  live = widget;
  widgetReady = false;

  try {
    widget.unbind(events.READY);
    widget.unbind(events.PLAY);
    widget.unbind(events.PAUSE);
    widget.unbind(events.FINISH);
    widget.unbind(events.PLAY_PROGRESS);
    if (events.ERROR) widget.unbind(events.ERROR);
  } catch {
    /* a fresh widget has nothing to unbind */
  }

  widget.bind(events.READY, () => {
    widgetReady = true;
    if (singleMode) {
      // A single-track load starts itself; make sure it is not left muted.
      try {
        widget.setVolume(100);
      } catch {
        /* ignore */
      }
    }
    try {
      widget.getCurrentSound((sound) => {
        if (sound?.id !== undefined && liveSoundId === null) {
          liveSoundId = String(sound.id);
        }
      });
    } catch {
      /* optional */
    }
    emit({ type: "ready" });
    startPlaylistPoll();
    runQueued();
  });

  widget.bind(events.PLAY, (raw) => {
    const sid = eventSound(raw);
    if (sid) liveSoundId = sid;
    if (priming) {
      primeLastEvent = "play";
      return;
    }
    if (
      attempt.phase === "blocked" &&
      sid &&
      attempt.soundId &&
      sid !== attempt.soundId &&
      rescuedAttemptAt !== attempt.startedAt
    ) {
      // SoundCloud fires several PLAY events per start; skip only once, or the
      // repeated skips abort the new sound's fetch.
      rescuedAttemptAt = attempt.startedAt;
      // A tap on SoundCloud's own button (the "Tap to play" overlay) started
      // whatever it had cued; that tap unlocked the frame, so move it on.
      const index = playlist.indexOf(attempt.soundId);
      if (index >= 0 && widget.skip) {
        try {
          // Hush the wrong sound, move on, and bring volume back once the
          // right one flows.
          widget.setVolume(0);
          widget.skip(index);
          widget.play();
          liveSoundId = attempt.soundId;
          restoreVolumeFor = attempt.soundId;
        } catch {
          /* ignore */
        }
      }
    }
    dispatch({ type: "widget-play", soundId: sid, now: now() });
  });

  widget.bind(events.PAUSE, (raw) => {
    if (priming) {
      primeLastEvent = "pause";
      return;
    }
    dispatch({
      type: "widget-pause",
      soundId: eventSound(raw),
      position: eventPosition(raw),
      now: now(),
    });
  });

  widget.bind(events.FINISH, (raw) => {
    if (priming) return;
    dispatch({ type: "widget-finish", soundId: eventSound(raw) });
  });

  widget.bind(events.PLAY_PROGRESS, (raw) => {
    const sid = eventSound(raw);
    const position = eventPosition(raw);
    if (priming) {
      if (position > 0 && !priming.flowing) {
        audioUnlocked = true;
        primeRefused = false;
        priming.flowing = true;
        if (primeTimer !== null) clearTimeout(primeTimer);
        primeTimer = later(() => endPriming({ pause: true }), PRIME_MAX_SILENT_MS);
      }
      return;
    }
    if (restoreVolumeFor !== null && sid === restoreVolumeFor && position > 0) restoreVolume();
    if (attempt.soundId && sid && sid !== attempt.soundId) return;
    dispatch({ type: "widget-progress", soundId: sid, position });
    if (attempt.phase === "playing") emit({ type: "progress", raw });
  });

  if (events.ERROR) {
    try {
      widget.bind(events.ERROR, () => {
        if (priming) {
          endPriming({ pause: false });
          return;
        }
        dispatch({ type: "widget-error" });
      });
    } catch {
      /* older widget builds omit ERROR */
    }
  }
}

export function resetPlaybackForTests() {
  live = null;
  iframe = null;
  widgetReady = false;
  liveSoundId = null;
  playlist = [];
  catalogIds = [];
  soundsComplete = false;
  singleMode = false;
  stopPlaylistPoll();
  gestureNoted = false;
  audioUnlocked = false;
  attempt = IDLE_ATTEMPT;
  queued = null;
  priming = null;
  if (primeTimer !== null) clearTimeout(primeTimer);
  primeTimer = null;
  primedSoundId = null;
  primeHandoff = false;
  restoreVolumeFor = null;
  primeRefused = false;
  primeLastEvent = null;
  rescuedAttemptAt = null;
  primeSupported = null;
  clearTimers();
  listeners.clear();
  if (gestureCtx) {
    try {
      void gestureCtx.close();
    } catch {
      /* ignore */
    }
    gestureCtx = null;
  }
}
