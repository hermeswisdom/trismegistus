import {
  PLAY_BLOCKED_COPY,
  PLAY_CONFIRM_MS,
  embedNeedsRewrite,
  planPlayback,
  soundcloudPlayerSrc,
  type PlayCommand,
  type PlaybackSurface,
} from "./playback.ts";

export type SCWidget = {
  bind: (event: string, listener: (...args: unknown[]) => void) => void;
  unbind: (event: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  load: (url: string, options?: { auto_play?: boolean }) => void;
  seekTo: (ms: number) => void;
  getPosition: (cb: (ms: number) => void) => void;
  getDuration: (cb: (ms: number) => void) => void;
  getVolume: (cb: (vol: number) => void) => void;
  setVolume: (vol: number) => void;
  getCurrentSound: (
    cb: (sound: { id?: number; waveform_url?: string } | null) => void,
  ) => void;
};

type SCApi = {
  Widget: {
    (el: HTMLIFrameElement): SCWidget;
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
      PLAY_PROGRESS: string;
      ERROR?: string;
    };
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

let live: SCWidget | null = null;
let iframe: HTMLIFrameElement | null = null;
let liveSoundId: string | null = null;
let widgetReady = false;
let unlocked = false;
let heardPlay = false;
let wantPlay = false;
let pending: PlayCommand | null = null;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
let playGeneration = 0;
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

/**
 * Mark a user gesture. Does not call `widget.play()` — that raced with
 * click-to-toggle and paused the tablet on mobile.
 */
export function noteUserGesture() {
  unlocked = true;
  resumeWebAudio();
}

/** @deprecated Use noteUserGesture — kept so older call sites still unlock. */
export function primePlayback() {
  noteUserGesture();
}

export function isPlaybackUnlocked() {
  return unlocked;
}

export function setLiveIframe(el: HTMLIFrameElement | null) {
  iframe = el;
}

function resolveIframe() {
  if (iframe?.isConnected) return iframe;
  if (typeof document === "undefined") return iframe;
  const found = document.querySelector<HTMLIFrameElement>('iframe[title^="SoundCloud"]');
  if (found) iframe = found;
  return iframe;
}

export function getLiveIframe() {
  return resolveIframe();
}

export function setLiveWidget(widget: SCWidget | null, soundId?: string | null) {
  live = widget;
  widgetReady = false;
  if (soundId !== undefined) liveSoundId = soundId;
}

export function bindLiveWidget(
  widget: SCWidget,
  events: SCApi["Widget"]["Events"],
  soundId?: string | null,
) {
  live = widget;
  widgetReady = false;
  if (pending?.soundId) {
    liveSoundId = pending.soundId;
  } else if (soundId !== undefined && soundId !== null) {
    liveSoundId = soundId;
  }

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
    emit({ type: "ready" });
    if (pending?.intent === "play") armConfirm();
    if (pending && pending.intent !== "pause") {
      applyPlayback(pending);
    }
  });
  widget.bind(events.PLAY, () => {
    unlocked = true;
    heardPlay = true;
    wantPlay = true;
    clearConfirm();
    if (pending?.intent === "play") {
      pending = { ...pending, intent: "select" };
    }
    emit({ type: "play" });
  });
  widget.bind(events.PAUSE, () => {
    if (wantPlay || pending?.intent === "play") return;
    emit({ type: "pause" });
  });
  widget.bind(events.FINISH, () => emit({ type: "finish" }));
  widget.bind(events.PLAY_PROGRESS, (raw) => emit({ type: "progress", raw }));
  if (events.ERROR) {
    try {
      widget.bind(events.ERROR, () => {
        if (heardPlay) return;
        if (!wantPlay && pending?.intent !== "play") return;
        wantPlay = false;
        clearConfirm();
        emit({ type: "blocked", message: PLAY_BLOCKED_COPY });
      });
    } catch {
      /* older widget builds omit ERROR */
    }
  }
}

export function getLiveWidget() {
  return live;
}

export function getLiveSoundId() {
  return liveSoundId;
}

export function setLiveSoundId(id: string) {
  liveSoundId = id;
}

export function getPlaybackSurface(): PlaybackSurface {
  return {
    hasWidget: Boolean(live),
    widgetReady,
    hasIframe: Boolean(resolveIframe()),
    liveSoundId,
    unlocked,
    heardPlay,
  };
}

function clearConfirm() {
  if (confirmTimer !== null) {
    clearTimeout(confirmTimer);
    confirmTimer = null;
  }
}

function armConfirm() {
  const gen = ++playGeneration;
  clearConfirm();
  if (typeof window === "undefined") return;
  confirmTimer = setTimeout(() => {
    if (gen !== playGeneration) return;
    if (pending?.intent !== "play") return;
    wantPlay = false;
    emit({ type: "blocked", message: PLAY_BLOCKED_COPY });
  }, PLAY_CONFIRM_MS);
}

function applyIframeSrc(soundId: string, autoplay: boolean) {
  const target = resolveIframe();
  if (!target) return;
  const next = soundcloudPlayerSrc(soundId, autoplay);
  const current = target.getAttribute("src") ?? target.src ?? "";
  if (!embedNeedsRewrite(current, next)) {
    if (autoplay) {
      try {
        live?.play();
      } catch {
        /* not bound yet */
      }
    }
    return;
  }
  target.setAttribute("allow", "autoplay; encrypted-media");
  target.src = next;
  liveSoundId = soundId;
  widgetReady = false;
  live = null;
}

function executePlan(cmd: PlayCommand) {
  const plan = planPlayback(cmd, getPlaybackSurface());

  if (plan.iframeSoundId) {
    applyIframeSrc(plan.iframeSoundId, Boolean(plan.iframeAutoplay));
  }

  if (!live) {
    return plan;
  }

  try {
    if (plan.widgetOp === "pause") {
      live.pause();
    } else if (plan.widgetOp === "play") {
      live.play();
    } else if (plan.widgetOp === "load") {
      liveSoundId = cmd.soundId;
      live.load(cmd.permalink, { auto_play: plan.loadAutoplay });
    }
  } catch {
    /* Widget methods can throw if the iframe is gone. */
  }

  return plan;
}

export function applyPlayback(cmd: PlayCommand) {
  if (cmd.intent === "pause") {
    pending = null;
    wantPlay = false;
    clearConfirm();
  } else {
    pending = cmd;
    if (cmd.intent === "play") wantPlay = true;
  }
  const plan = executePlan(cmd);
  if (plan.iframeSoundId && pending) {
    pending = { ...pending, retry: false, forceEmbed: false };
  }
  if (cmd.intent === "play") emit({ type: "pending" });
  if (plan.expectPlayEvent) armConfirm();
  return plan;
}

export function markWidgetReady() {
  widgetReady = true;
  emit({ type: "ready" });
  if (pending && pending.intent !== "pause") applyPlayback(pending);
}

export function resetPlaybackForTests() {
  live = null;
  iframe = null;
  liveSoundId = null;
  widgetReady = false;
  unlocked = false;
  heardPlay = false;
  wantPlay = false;
  pending = null;
  playGeneration += 1;
  clearConfirm();
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
