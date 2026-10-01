/**
 * The native player: one top-level <audio> element for the page life, playing
 * the 128 kbps streams (/api/stream/<slug>). Unlike the cross-origin
 * SoundCloud iframe, a top-level media element keeps playing when the phone
 * locks, and drives the lock-screen controls through the Media Session API.
 *
 * Same honest-UI contract as sc-widget.ts: "pending" until audio really
 * flows, "play" on the element's first real progress, "blocked" (Tap to
 * play) when the browser refuses play(), "finish" on ended (the store starts
 * the next tablet synchronously inside that event, which iOS allows while
 * locked). A stream that cannot load falls back to SoundCloud ("fallback").
 */
import { classifyPlayRejection, streamUrl, type NativePhase } from "./streams.ts";
import { streamVia } from "./stream-proxy.ts";
import {
  classifyPause,
  debugEvent,
  recordPause,
  stackSnippet,
  type PauseCall,
} from "./audio-debug.ts";

export type NativeNotice =
  | { type: "pending"; id: string }
  | { type: "play"; id: string }
  | { type: "pause"; id: string }
  | { type: "finish"; id: string }
  | { type: "blocked"; id: string }
  | { type: "fallback"; id: string }
  | { type: "progress"; id: string; elapsed: number; duration: number };

/** A start that never produces audio is shown as blocked after this long. */
export const NATIVE_CONFIRM_MS = 15000;
/** A muted in-tap prime stops by itself after this long. */
export const NATIVE_PRIME_MAX_MS = 12000;

type NativeTrack = { id: string; slug: string };

let el: HTMLAudioElement | null = null;
let activeId: string | null = null;
let activeSlug: string | null = null;
let phase: NativePhase = "idle";
let priming = false;
/** Tablet a muted prime ran on: the real play restarts it from 0. */
let primedFor: string | null = null;
let unlocked = false;
let seq = 0;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
let primeTimer: ReturnType<typeof setTimeout> | null = null;
/** One silent reload per tablet when its signed URL lapses / the network drops. */
let reloadedFor: string | null = null;
const failed = new Set<string>();

/** The element's src for a tablet: /api/stream/<slug>, plus ?via=direct for the A/B. */
function srcFor(slug: string, extra?: Record<string, string>): string | null {
  const base = streamUrl(slug);
  if (!base) return null;
  const q = new URLSearchParams(extra);
  if (typeof window !== "undefined" && streamVia(window.location.search) === "direct") q.set("via", "direct");
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}
/** Last time our code paused the element or swapped its src, and why. */
let pauseCall: PauseCall | null = null;

function notePauseCall(reason: string) {
  pauseCall = { at: Date.now(), reason, stack: stackSnippet(3) };
}

function visibility() {
  return typeof document === "undefined" ? "unknown" : document.visibilityState;
}

/**
 * Declare this page's audio as media playback (Safari 16.4+ Audio Session
 * API). The page's category is then MediaPlayback for its whole life, so it
 * keeps playing when the phone locks, between tracks (ended -> next src) and
 * with the ringer switch on silent, instead of WebKit's automatic choice,
 * which drops to "ambient" (silenced on lock) or "none" whenever no element
 * is audibly playing for a moment.
 */
export function claimPlaybackAudioSession() {
  try {
    const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (s && s.type !== "playback") {
      s.type = "playback";
      debugEvent("audioSession", `type=${s.type}`);
    }
  } catch {
    /* unsupported */
  }
}
const listeners = new Set<(n: NativeNotice) => void>();

export function subscribeNative(fn: (n: NativeNotice) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(n: NativeNotice) {
  listeners.forEach((fn) => fn(n));
}

export function failedStreams(): ReadonlySet<string> {
  return failed;
}

export function nativePhase(): NativePhase {
  return phase;
}

export function nativeActiveId() {
  return activeId;
}

export function isNativeUnlocked() {
  return unlocked;
}

export function getNativeElement() {
  return el;
}

function clearConfirm() {
  if (confirmTimer !== null) clearTimeout(confirmTimer);
  confirmTimer = null;
}

function stopPrime() {
  priming = false;
  if (primeTimer !== null) clearTimeout(primeTimer);
  primeTimer = null;
}

function fallback(id: string, slug: string) {
  failed.add(slug);
  clearConfirm();
  phase = "idle";
  emit({ type: "fallback", id });
}

function ensureEl(): HTMLAudioElement | null {
  if (el) return el;
  if (typeof document === "undefined") return null;
  const a = document.createElement("audio");
  a.preload = "auto";
  a.setAttribute("playsinline", "");
  a.setAttribute("x-webkit-airplay", "allow");
  a.dataset.atmanNativeAudio = "";
  a.style.display = "none";
  document.body.appendChild(a);

  // Any pause() on this element, from anywhere, leaves a reason + call site
  // (shown by ?debug=audio). Our own calls set a specific reason first.
  const elementPause = a.pause;
  a.pause = function pauseTraced(this: HTMLAudioElement) {
    if (!pauseCall || Date.now() - pauseCall.at > 50) notePauseCall("unlabelled pause() call");
    return elementPause.call(this);
  };
  for (const type of ["loadstart", "play", "playing", "waiting", "stalled", "ended", "error", "emptied", "abort"]) {
    a.addEventListener(type, () => {
      const slug = activeSlug ?? "-";
      const err = type === "error" && a.error ? ` code=${a.error.code}` : "";
      debugEvent(`audio:${type}`, `${slug} t=${(a.currentTime || 0).toFixed(1)}${priming ? " (muted prime)" : ""}${err} [${visibility()}]`);
    });
  }

  a.addEventListener("playing", () => {
    unlocked = true;
    if (priming || !activeId) return;
    clearConfirm();
    if (phase !== "playing") {
      phase = "playing";
      emit({ type: "play", id: activeId });
    }
  });
  a.addEventListener("timeupdate", () => {
    if (priming || !activeId) return;
    if (phase === "pending" && a.currentTime > 0 && !a.paused) {
      clearConfirm();
      phase = "playing";
      emit({ type: "play", id: activeId });
    }
    if (phase === "playing") {
      emit({ type: "progress", id: activeId, elapsed: a.currentTime, duration: Number.isFinite(a.duration) ? a.duration : 0 });
    }
  });
  a.addEventListener("pause", () => {
    const why = classifyPause({ now: Date.now(), call: pauseCall, visibility: visibility(), ended: a.ended });
    let buffered = "";
    try {
      buffered = a.buffered && a.buffered.length ? ` buf=${a.buffered.end(a.buffered.length - 1).toFixed(0)}s` : " buf=0";
    } catch {
      /* ignore */
    }
    recordPause({
      at: Date.now(),
      reason: priming ? `${why.reason} (muted prime)` : why.reason,
      media: `rs=${a.readyState} ns=${a.networkState}${buffered}`,
      ours: why.ours,
      visibility: visibility(),
      time: a.currentTime || 0,
      stack: why.stack,
    });
    // Only a pause of real playback (lock screen, headphones out, another
    // app taking audio). Our own pause() already set idle; a src change
    // during a pending start must not cancel it.
    if (priming || !activeId || phase !== "playing" || a.ended) return;
    phase = "idle";
    emit({ type: "pause", id: activeId });
  });
  a.addEventListener("ended", () => {
    if (priming) {
      stopPrime();
      return;
    }
    if (!activeId) return;
    clearConfirm();
    phase = "idle";
    emit({ type: "finish", id: activeId });
  });
  a.addEventListener("error", () => {
    const id = activeId;
    const slug = activeSlug;
    if (!id || !slug) return;
    if (priming) {
      stopPrime();
      return;
    }
    if (phase === "idle" || phase === "blocked") return;
    const at = a.currentTime;
    if (reloadedFor !== slug) {
      // Expired signed URL / dropped connection: fetch a fresh redirect once.
      reloadedFor = slug;
      const url = srcFor(slug, { r: String(Date.now()) });
      if (url) {
        notePauseCall(`stream reload after load error (${slug})`);
        a.src = url;
        try {
          if (at > 0) a.currentTime = at;
        } catch {
          /* seek after metadata */
        }
        void a.play()?.catch(() => fallback(id, slug));
        return;
      }
    }
    fallback(id, slug);
  });
  el = a;
  return a;
}

function cue(a: HTMLAudioElement, track: NativeTrack): boolean {
  if (activeId === track.id && a.getAttribute("src")) return false;
  const url = srcFor(track.slug);
  if (!url) return false;
  notePauseCall(`src change to ${track.slug}`);
  a.src = url;
  activeId = track.id;
  activeSlug = track.slug;
  reloadedFor = null;
  return true;
}

/**
 * Start a tablet. Call synchronously from the tap (or the `ended` event): src
 * and play() run in this turn so the gesture / iOS media session carries.
 */
export function nativePlay(track: NativeTrack): boolean {
  const a = ensureEl();
  if (!a || !streamUrl(track.slug)) return false;
  stopPrime();
  const fresh = cue(a, track);
  const restart = !fresh && primedFor === track.id;
  primedFor = null;
  if (restart) {
    try {
      a.currentTime = 0;
    } catch {
      /* not seekable yet */
    }
  }
  a.muted = false;
  claimPlaybackAudioSession();
  const mine = ++seq;
  const id = track.id;
  const slug = track.slug;
  phase = "pending";
  emit({ type: "pending", id });
  clearConfirm();
  confirmTimer = setTimeout(() => {
    confirmTimer = null;
    if (mine === seq && phase === "pending") {
      phase = "blocked";
      emit({ type: "blocked", id });
    }
  }, NATIVE_CONFIRM_MS);
  const onReject = (err: unknown) => {
    if (mine !== seq) return;
    const kind = classifyPlayRejection((err as { name?: string } | null)?.name);
    if (kind === "ignore") return;
    if (kind === "blocked") {
      clearConfirm();
      phase = "blocked";
      emit({ type: "blocked", id });
      return;
    }
    fallback(id, slug);
  };
  try {
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(onReject);
  } catch (err) {
    onReject(err);
  }
  return true;
}

export function nativePause(reason = "app pause()") {
  seq += 1;
  stopPrime();
  clearConfirm();
  phase = "idle";
  try {
    if (el && !el.paused) notePauseCall(reason);
    el?.pause();
  } catch {
    /* ignore */
  }
}

export function nativeSeek(seconds: number) {
  if (!el) return;
  try {
    el.currentTime = Math.max(0, seconds);
  } catch {
    /* not seekable yet */
  }
}

/**
 * Inside a tap whose sound starts later (the wheel lands ~4 s after the
 * press): start the winner muted now so the element is allowed to play
 * without a gesture on landing (iOS). No-op once the element has played.
 */
export function nativePrime(track: NativeTrack): boolean {
  if (unlocked || priming) return false;
  const a = ensureEl();
  if (!a || !streamUrl(track.slug)) return false;
  seq += 1;
  clearConfirm();
  phase = "idle";
  cue(a, track);
  a.muted = true;
  claimPlaybackAudioSession();
  priming = true;
  primedFor = track.id;
  try {
    const p = a.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        stopPrime();
      });
    }
  } catch {
    stopPrime();
    return false;
  }
  primeTimer = setTimeout(() => {
    primeTimer = null;
    if (!priming) return;
    stopPrime();
    try {
      notePauseCall("muted prime 12s safety stop (wheel never landed)");
      a.pause();
    } catch {
      /* ignore */
    }
  }, NATIVE_PRIME_MAX_MS);
  return true;
}

export function isNativePriming() {
  return priming;
}

export function resetNativeForTests() {
  el = null;
  activeId = null;
  activeSlug = null;
  phase = "idle";
  stopPrime();
  primedFor = null;
  unlocked = false;
  seq = 0;
  clearConfirm();
  reloadedFor = null;
  pauseCall = null;
  failed.clear();
  listeners.clear();
}

// Declare playback audio before any tap (and again right before each play()).
if (typeof window !== "undefined") claimPlaybackAudioSession();
