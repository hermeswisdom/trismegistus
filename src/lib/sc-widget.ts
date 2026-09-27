import {
  IDLE_ATTEMPT,
  PLAY_BLOCKED_COPY,
  PLAY_BLOCKED_SETTLE_MS,
  PLAY_CONFIRM_MS,
  PLAYLIST_WAIT_MS,
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
let priming: { startedAt: number } | null = null;
let primeTimer: ReturnType<typeof setTimeout> | null = null;

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

function endPriming(opts: { pause: boolean }) {
  if (!priming) return;
  priming = null;
  if (primeTimer !== null) clearTimeout(primeTimer);
  primeTimer = null;
  try {
    if (opts.pause) {
      live?.pause();
      live?.seekTo(0);
    }
    live?.setVolume(100);
  } catch {
    /* iframe gone */
  }
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
  priming = { startedAt: now() };
  primeTimer = later(() => endPriming({ pause: true }), 3000);
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
  if (!widget) return;
  try {
    if (op.op === "pause") {
      widget.pause();
    } else if (op.op === "play") {
      widget.play();
    } else if (op.op === "skip-play") {
      widget.skip?.(op.index);
      liveSoundId = cmd.soundId;
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
  if (priming) endPriming({ pause: false });
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
  dispatch({ type: "start", soundId: cmd.soundId, now: now() });

  if (op.op === "wait") {
    queued = cmd;
    if (op.prime) startPrime();
    return op;
  }

  queued = null;
  const wasPriming = priming !== null;
  if (wasPriming) endPriming({ pause: false });
  run(cmd, op);
  if (wasPriming && op.op === "play") {
    try {
      live?.seekTo(0);
    } catch {
      /* ignore */
    }
  }
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
    if (priming) return;
    dispatch({ type: "widget-play", soundId: sid, now: now() });
  });

  widget.bind(events.PAUSE, (raw) => {
    if (priming) return;
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
      if (position > 0) {
        audioUnlocked = true;
        endPriming({ pause: true });
      }
      return;
    }
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
