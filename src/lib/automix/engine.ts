/**
 * Two-deck Auto Mix engine: HTMLAudioElement → MediaElementSource → GainNode.
 * Plays the 128k streams at /api/stream/<slug>. Unlock the AudioContext and
 * call play() in the same tap as the UI (iOS one-tap), matching native-audio.ts.
 */
import { claimPlaybackAudioSession } from "../native-audio.ts";
import { streamVia } from "../stream-proxy.ts";
import { streamUrl } from "../streams.ts";
import { equalPowerCurve, mixHandoff } from "./crossfade.ts";
import { type MixTrack } from "./types.ts";

export type AutoMixNotice =
  | { type: "pending"; slug: string }
  | { type: "play"; slug: string }
  | { type: "pause"; slug: string }
  | { type: "stop"; yieldPanel?: boolean }
  | { type: "error"; slug: string; message: string }
  | {
      type: "progress";
      slug: string;
      elapsed: number;
      duration: number;
      xfade: number | null;
      nextSlug: string | null;
    }
  | { type: "xfade"; slug: string; nextSlug: string; progress: number }
  | { type: "need-next"; slug: string };

type Deck = {
  el: HTMLAudioElement;
  gain: GainNode;
  source: MediaElementAudioSourceNode | null;
  slug: string | null;
};

export type AutoMixEngineState = {
  playing: boolean;
  pending: boolean;
  current: MixTrack | null;
  next: MixTrack | null;
  xfade: number | null;
};

type Run = {
  queue: MixTrack[];
  index: number;
  currentDeck: 0 | 1;
  xfading: boolean;
  xfadeStarted: number;
  xfadeOverlap: number;
  playing: boolean;
  pending: boolean;
};

const listeners = new Set<(n: AutoMixNotice) => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let decks: [Deck, Deck] | null = null;
let useWebAudio = true;
let run: Run | null = null;
let raf = 0;
let xfadeTimer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

function emit(n: AutoMixNotice) {
  listeners.forEach((fn) => fn(n));
}

export function subscribeAutoMix(fn: (n: AutoMixNotice) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function AudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function mixStreamUrl(slug: string): string | null {
  const base = streamUrl(slug);
  if (!base) return null;
  if (typeof window !== "undefined" && streamVia(window.location.search) === "direct") {
    return `${base}?via=direct`;
  }
  return base;
}

function makeDeck(audioCtx: AudioContext, output: GainNode): Deck {
  const el = document.createElement("audio");
  el.preload = "auto";
  el.crossOrigin = "anonymous";
  el.setAttribute("playsinline", "");
  el.setAttribute("x-webkit-airplay", "allow");
  el.dataset.atmanAutomix = "";
  el.style.display = "none";
  document.body.appendChild(el);
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.connect(output);
  let source: MediaElementAudioSourceNode | null = null;
  try {
    source = audioCtx.createMediaElementSource(el);
    source.connect(gain);
  } catch {
    useWebAudio = false;
    gain.disconnect();
  }
  el.addEventListener("error", () => {
    const slug = run?.queue[run.index]?.slug;
    if (slug) emit({ type: "error", slug, message: "stream failed" });
  });
  return { el, gain, source, slug: null };
}

/**
 * Create (or resume) the AudioContext and both decks. Call from a tap.
 */
export function unlockAutoMix() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  claimPlaybackAudioSession();
  const Ctor = AudioContextCtor();
  if (!Ctor) return;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    useWebAudio = true;
    decks = [makeDeck(ctx, master), makeDeck(ctx, master)];
  }
  void ctx.resume();
}

function setGain(deck: Deck, value: number, at?: number) {
  if (useWebAudio && ctx) {
    const t = at ?? ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setValueAtTime(value, t);
  } else {
    deck.el.volume = Math.min(1, Math.max(0, value));
  }
}

function curveGain(deck: Deck, outgoing: boolean, start: number, duration: number) {
  if (duration <= 0) {
    setGain(deck, outgoing ? 0 : 1, start);
    return;
  }
  if (useWebAudio && ctx) {
    deck.gain.gain.cancelScheduledValues(start);
    deck.gain.gain.setValueCurveAtTime(equalPowerCurve(outgoing), start, duration);
    return;
  }
  const begun = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - begun) / (duration * 1000));
    const { out, inn } = equalPowerGainsLocal(t);
    deck.el.volume = outgoing ? out : inn;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function equalPowerGainsLocal(t: number) {
  const x = Math.min(1, Math.max(0, t));
  const angle = x * (Math.PI / 2);
  return { out: Math.cos(angle), inn: Math.sin(angle) };
}

function load(deck: Deck, track: MixTrack) {
  const url = mixStreamUrl(track.slug);
  if (!url) return false;
  if (deck.slug === track.slug && deck.el.getAttribute("src")) return true;
  deck.el.src = url;
  deck.slug = track.slug;
  return true;
}

function playEl(el: HTMLAudioElement) {
  claimPlaybackAudioSession();
  try {
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  } catch {
    /* autoplay refused — UI shows retry via pending timeout */
  }
}

function clearXfadeTimer() {
  if (xfadeTimer !== null) clearTimeout(xfadeTimer);
  xfadeTimer = null;
}

function stopRaf() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function currentTrack(): MixTrack | null {
  if (!run) return null;
  return run.queue[run.index] ?? null;
}

function nextTrack(): MixTrack | null {
  if (!run) return null;
  return run.queue[run.index + 1] ?? null;
}

function startWatch() {
  stopRaf();
  const loop = () => {
    raf = 0;
    const r = run;
    const dks = decks;
    if (!r || !dks || !r.playing) return;
    const deck = dks[r.currentDeck];
    const track = r.queue[r.index];
    if (!track) return;
    const elapsed = deck.el.currentTime || 0;
    const duration = Number.isFinite(deck.el.duration) ? deck.el.duration : track.duration;
    let xfade: number | null = null;
    if (r.xfading && r.xfadeOverlap > 0 && ctx) {
      xfade = Math.min(1, Math.max(0, (ctx.currentTime - r.xfadeStarted) / r.xfadeOverlap));
    } else if (r.xfading && r.xfadeOverlap > 0) {
      xfade = 0;
    }
    const nxt = r.queue[r.index + 1] ?? null;
    emit({
      type: "progress",
      slug: track.slug,
      elapsed,
      duration,
      xfade,
      nextSlug: nxt?.slug ?? null,
    });
    if (r.xfading && xfade !== null) {
      emit({
        type: "xfade",
        slug: track.slug,
        nextSlug: nxt?.slug ?? track.slug,
        progress: xfade,
      });
    }
    if (!r.xfading && nxt) {
      const plan = mixHandoff({ ...track, currentTime: elapsed }, "auto");
      if (elapsed >= plan.startAt - 0.04 && plan.overlap > 0) beginXfade("auto");
      else if (elapsed >= plan.startAt && plan.overlap <= 0) finishXfade();
    } else if (!r.xfading && !nxt && duration > 0 && elapsed >= duration - 0.25) {
      emit({ type: "need-next", slug: track.slug });
    }
    if (!r.xfading && deck.el.ended) {
      if (r.queue[r.index + 1]) beginXfade("skip");
      else emit({ type: "need-next", slug: track.slug });
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function beginXfade(kind: "auto" | "skip") {
  const r = run;
  const dks = decks;
  if (!r || !dks || r.xfading) return;
  const incoming = r.queue[r.index + 1];
  if (!incoming) {
    emit({ type: "need-next", slug: r.queue[r.index]?.slug ?? "" });
    return;
  }
  const outDeck = dks[r.currentDeck];
  const inDeck = dks[r.currentDeck === 0 ? 1 : 0];
  const current = r.queue[r.index]!;
  const plan = mixHandoff({ ...current, currentTime: outDeck.el.currentTime || 0 }, kind);
  const overlap = Math.max(0.05, plan.overlap);
  if (!load(inDeck, incoming)) {
    emit({ type: "error", slug: incoming.slug, message: "no stream" });
    return;
  }
  try {
    inDeck.el.currentTime = 0;
  } catch {
    /* not seekable yet */
  }
  inDeck.el.muted = false;
  setGain(inDeck, 0);
  playEl(inDeck.el);
  r.xfading = true;
  r.xfadeOverlap = overlap;
  const t0 = ctx?.currentTime ?? 0;
  r.xfadeStarted = t0;
  curveGain(outDeck, true, t0, overlap);
  curveGain(inDeck, false, t0, overlap);
  emit({ type: "xfade", slug: current.slug, nextSlug: incoming.slug, progress: 0 });
  clearXfadeTimer();
  xfadeTimer = setTimeout(() => finishXfade(), overlap * 1000 + 30);
}

function finishXfade() {
  const r = run;
  const dks = decks;
  if (!r || !dks || !r.xfading) {
    if (r && !r.queue[r.index + 1]) emit({ type: "need-next", slug: r.queue[r.index]?.slug ?? "" });
    return;
  }
  clearXfadeTimer();
  const outDeck = dks[r.currentDeck];
  try {
    outDeck.el.pause();
  } catch {
    /* ignore */
  }
  setGain(outDeck, 0);
  r.currentDeck = r.currentDeck === 0 ? 1 : 0;
  r.index += 1;
  r.xfading = false;
  r.xfadeOverlap = 0;
  setGain(dks[r.currentDeck], 1);
  const now = r.queue[r.index];
  if (now) {
    emit({ type: "play", slug: now.slug });
    preloadNext();
    if (!r.queue[r.index + 1]) emit({ type: "need-next", slug: now.slug });
  }
}

function preloadNext() {
  const r = run;
  const dks = decks;
  if (!r || !dks) return;
  const nxt = r.queue[r.index + 1];
  if (!nxt) return;
  const idle = dks[r.currentDeck === 0 ? 1 : 0];
  load(idle, nxt);
}

/**
 * Start a mix. `play()` on the first deck runs in this turn so the tap's
 * user gesture carries (iOS).
 */
export function startAutoMix(queue: MixTrack[]) {
  unlockAutoMix();
  if (!decks || !ctx || !queue.length) return false;
  stopAutoMix({ silent: true });
  const mine = ++seq;
  const first = queue[0]!;
  run = {
    queue: [...queue],
    index: 0,
    currentDeck: 0,
    xfading: false,
    xfadeStarted: 0,
    xfadeOverlap: 0,
    playing: true,
    pending: true,
  };
  const deck = decks[0];
  const other = decks[1];
  if (!load(deck, first)) {
    emit({ type: "error", slug: first.slug, message: "no stream" });
    return false;
  }
  setGain(deck, 1);
  setGain(other, 0);
  deck.el.muted = false;
  void ctx.resume();
  emit({ type: "pending", slug: first.slug });
  const onPlaying = () => {
    if (!run || mine !== seq) return;
    run.pending = false;
    emit({ type: "play", slug: first.slug });
  };
  deck.el.addEventListener("playing", onPlaying, { once: true });
  playEl(deck.el);
  preloadNext();
  startWatch();
  return true;
}

export function pauseAutoMix() {
  const r = run;
  const dks = decks;
  if (!r || !dks) return;
  r.playing = false;
  r.pending = false;
  stopRaf();
  try {
    dks[0].el.pause();
    dks[1].el.pause();
  } catch {
    /* ignore */
  }
  const slug = currentTrack()?.slug;
  if (slug) emit({ type: "pause", slug });
}

export function resumeAutoMix() {
  unlockAutoMix();
  const r = run;
  const dks = decks;
  if (!r || !dks || !ctx) return;
  r.playing = true;
  r.pending = true;
  void ctx.resume();
  const live = dks[r.currentDeck];
  live.el.muted = false;
  const slug = currentTrack()?.slug;
  const mine = seq;
  const onPlaying = () => {
    if (!run || mine !== seq) return;
    run.pending = false;
    if (slug) emit({ type: "play", slug });
  };
  live.el.addEventListener("playing", onPlaying, { once: true });
  playEl(live.el);
  if (r.xfading) playEl(dks[r.currentDeck === 0 ? 1 : 0].el);
  if (slug) emit({ type: "pending", slug });
  startWatch();
}

/**
 * Keep the current track, replace what comes next, and skip-fade into the
 * first of `nextQueue`. Used when the listener picks a new mood mid-mix.
 */
export function remixAutoMix(nextQueue: MixTrack[]) {
  const r = run;
  const dks = decks;
  if (!r || !dks || !nextQueue.length) return false;
  if (r.xfading) finishXfade();
  const current = r.queue[r.index];
  const rest = nextQueue.filter((t) => t.slug !== current?.slug);
  if (!rest.length) return false;
  r.queue = current ? [current, ...rest] : [...rest];
  r.index = 0;
  preloadNext();
  if (r.playing) beginXfade("skip");
  return true;
}

export function skipAutoMix() {
  const r = run;
  if (!r || !r.playing) return;
  if (!r.queue[r.index + 1]) {
    emit({ type: "need-next", slug: r.queue[r.index]?.slug ?? "" });
    return;
  }
  beginXfade("skip");
}

export function appendAutoMix(tracks: MixTrack[]) {
  if (!run || !tracks.length) return;
  for (const t of tracks) run.queue.push(t);
  preloadNext();
}

export function stopAutoMix(opts?: { silent?: boolean; yieldPanel?: boolean }) {
  seq += 1;
  clearXfadeTimer();
  stopRaf();
  if (decks) {
    for (const d of decks) {
      try {
        d.el.pause();
      } catch {
        /* ignore */
      }
      setGain(d, 0);
    }
  }
  if (ctx && ctx.state !== "closed") {
    try {
      void ctx.suspend();
    } catch {
      /* ignore */
    }
  }
  run = null;
  if (!opts?.silent) emit({ type: "stop", yieldPanel: opts?.yieldPanel });
}

/**
 * Tear down the graph so the wall's native <audio> player is not competing
 * with a leftover Web Audio session on iOS.
 */
export function hushAutoMix(opts?: { yieldPanel?: boolean }) {
  stopAutoMix({ yieldPanel: opts?.yieldPanel });
  stopRaf();
  clearXfadeTimer();
  if (decks) {
    for (const d of decks) {
      try {
        d.el.pause();
        d.el.removeAttribute("src");
        d.el.load();
        d.el.remove();
      } catch {
        /* ignore */
      }
    }
    decks = null;
  }
  if (master) {
    try {
      master.disconnect();
    } catch {
      /* ignore */
    }
    master = null;
  }
  if (ctx) {
    const closing = ctx;
    ctx = null;
    try {
      void closing.close();
    } catch {
      /* ignore */
    }
  }
}

export function autoMixEngineState(): AutoMixEngineState {
  return {
    playing: Boolean(run?.playing),
    pending: Boolean(run?.pending),
    current: currentTrack(),
    next: nextTrack(),
    xfade: run?.xfading ? 0 : null,
  };
}

export function resetAutoMixForTests() {
  hushAutoMix();
  listeners.clear();
  useWebAudio = true;
  seq = 0;
}
