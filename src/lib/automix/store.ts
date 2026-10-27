import { create } from "zustand";
import { getTrack } from "@/lib/rooms";
import { hushBowlGraph } from "@/lib/bowl-synth";
import { usePlayer } from "@/lib/player-store";
import {
  setMediaSessionPlaying,
  setMediaSessionPosition,
  setMediaSessionTrack,
} from "@/lib/media-session";
import { automixCatalog } from "./catalog.ts";
import {
  appendAutoMix,
  autoMixEngineState,
  hushAutoMix,
  pauseAutoMix,
  remixAutoMix,
  resumeAutoMix,
  skipAutoMix,
  startAutoMix,
  subscribeAutoMix,
  unlockAutoMix,
} from "./engine.ts";
import { buildMix, mulberry32, pickNext } from "./select.ts";
import { type MixTrack, type Mood } from "./types.ts";

export type AutoMixState = {
  open: boolean;
  mood: Mood | null;
  energy: number;
  endless: boolean;
  playing: boolean;
  pending: boolean;
  error: string | null;
  now: MixTrack | null;
  next: MixTrack | null;
  xfade: number | null;
  queue: MixTrack[];
  seed: number;
  recent: string[];
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setMood: (mood: Mood) => void;
  setEnergy: (energy: number) => void;
  setEndless: (endless: boolean) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  skip: () => void;
  stop: () => void;
};

let bridged = false;

function bindMixMediaSession() {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;
  const mix = () => useAutoMix.getState();
  try {
    navigator.mediaSession.setActionHandler("play", () => mix().play());
    navigator.mediaSession.setActionHandler("pause", () => mix().pause());
    navigator.mediaSession.setActionHandler("stop", () => mix().stop());
    navigator.mediaSession.setActionHandler("nexttrack", () => mix().skip());
    navigator.mediaSession.setActionHandler("previoustrack", () => mix().skip());
  } catch {
    /* older browsers */
  }
}

function remember(recent: string[], slug: string): string[] {
  if (recent[recent.length - 1] === slug) return recent;
  const next = [...recent, slug];
  return next.length > 40 ? next.slice(-40) : next;
}

function extendIfNeeded() {
  const state = useAutoMix.getState();
  if (!state.endless || !state.mood || !state.now) return;
  const idx = state.queue.findIndex((t) => t.slug === state.now?.slug);
  const remaining = idx < 0 ? 0 : state.queue.length - idx - 1;
  if (remaining >= 2) return;
  const previous = state.next ?? state.now;
  const nxt = pickNext({
    catalog: automixCatalog(),
    mood: state.mood,
    energyTarget: state.energy,
    previous,
    recent: state.recent,
    rng: mulberry32(state.seed + state.recent.length + 1),
  });
  if (!nxt) return;
  appendAutoMix([nxt]);
  const queue = [...state.queue, nxt];
  useAutoMix.setState({
    queue,
    next: state.now && queue[idx + 1] ? queue[idx + 1]! : nxt,
  });
}

function ensureBridge() {
  if (bridged) return;
  bridged = true;
  subscribeAutoMix((notice) => {
    const state = useAutoMix.getState();
    switch (notice.type) {
      case "pending":
        useAutoMix.setState({ pending: true, error: null });
        return;
      case "play": {
        const now = state.queue.find((t) => t.slug === notice.slug) ?? state.now;
        const idx = state.queue.findIndex((t) => t.slug === notice.slug);
        const next = idx >= 0 ? (state.queue[idx + 1] ?? null) : state.next;
        const cover = getTrack(notice.slug);
        if (cover) {
          setMediaSessionTrack(cover);
          setMediaSessionPlaying(true);
          bindMixMediaSession();
        }
        useAutoMix.setState({
          playing: true,
          pending: false,
          error: null,
          now: now,
          next,
          xfade: null,
          recent: remember(state.recent, notice.slug),
        });
        extendIfNeeded();
        return;
      }
      case "pause":
        setMediaSessionPlaying(false);
        useAutoMix.setState({ playing: false, pending: false });
        return;
      case "stop":
        setMediaSessionPlaying(false);
        useAutoMix.setState({
          playing: false,
          pending: false,
          now: null,
          next: null,
          xfade: null,
          queue: [],
          ...(notice.yieldPanel ? { open: false } : {}),
        });
        return;
      case "error":
        useAutoMix.setState({
          error: "Couldn’t mix this one",
          pending: false,
        });
        if (state.playing || state.pending) useAutoMix.getState().skip();
        return;
      case "progress":
        if (notice.duration > 0) setMediaSessionPosition(notice.elapsed, notice.duration);
        if (notice.xfade != null) useAutoMix.setState({ xfade: notice.xfade });
        return;
      case "xfade":
        useAutoMix.setState({ xfade: notice.progress });
        return;
      case "need-next":
        extendIfNeeded();
        return;
    }
  });
}

export const useAutoMix = create<AutoMixState>((set, get) => ({
  open: false,
  mood: null,
  energy: 0.55,
  endless: true,
  playing: false,
  pending: false,
  error: null,
  now: null,
  next: null,
  xfade: null,
  queue: [],
  seed: 1,
  recent: [],

  openPanel: () => {
    ensureBridge();
    set({ open: true });
  },
  closePanel: () => set({ open: false }),
  togglePanel: () => {
    ensureBridge();
    set({ open: !get().open });
  },
  setMood: (mood) => {
    const state = get();
    if (mood === state.mood && (state.playing || state.pending)) return;
    if (!state.playing && !state.pending) {
      set({ mood, error: null });
      return;
    }
    ensureBridge();
    unlockAutoMix();
    const seed = (Date.now() ^ (Math.floor(Math.random() * 0x7fffffff) || 1)) >>> 0;
    const recent = state.now ? remember(state.recent, state.now.slug) : state.recent;
    const built = buildMix({
      catalog: automixCatalog(),
      mood,
      energyTarget: state.energy,
      seed,
      endless: state.endless,
      recent,
    });
    const incoming = state.now
      ? built.filter((t) => t.slug !== state.now!.slug)
      : built;
    if (!incoming.length) {
      set({ mood, error: "No streams for that mood" });
      return;
    }
    if (remixAutoMix(incoming)) {
      const live = autoMixEngineState();
      const current = live.current ?? state.now;
      const rest = incoming.filter((t) => t.slug !== current?.slug);
      set({
        mood,
        seed,
        queue: current ? [current, ...rest] : rest,
        now: current,
        next: live.next ?? rest[0] ?? null,
        error: null,
      });
      return;
    }
    set({
      mood,
      seed,
      queue: incoming,
      now: incoming[0] ?? null,
      next: incoming[1] ?? null,
      error: null,
      pending: true,
      playing: false,
      xfade: null,
    });
    startAutoMix(incoming);
  },
  setEnergy: (energy) => set({ energy: Math.min(1, Math.max(0, energy)) }),
  setEndless: (endless) => set({ endless }),

  play: () => {
    ensureBridge();
    unlockAutoMix();
    const state = get();
    if (state.now && !state.playing && !state.pending) {
      usePlayer.getState().pause();
      hushBowlGraph();
      bindMixMediaSession();
      resumeAutoMix();
      return;
    }
    if (state.playing || state.pending) return;
    if (!state.mood) {
      set({ error: "Pick a mood" });
      return;
    }
    usePlayer.getState().pause();
    hushBowlGraph();
    bindMixMediaSession();
    const seed = (Date.now() ^ (Math.floor(Math.random() * 0x7fffffff) || 1)) >>> 0;
    const queue = buildMix({
      catalog: automixCatalog(),
      mood: state.mood,
      energyTarget: state.energy,
      seed,
      endless: state.endless,
      recent: state.recent,
    });
    if (!queue.length) {
      set({ error: "No streams for that mood" });
      return;
    }
    set({
      seed,
      queue,
      now: queue[0] ?? null,
      next: queue[1] ?? null,
      error: null,
      pending: true,
      playing: false,
      xfade: null,
      open: true,
    });
    const cover = getTrack(queue[0]!.slug);
    if (cover) setMediaSessionTrack(cover);
    startAutoMix(queue);
  },

  pause: () => {
    pauseAutoMix();
    set({ playing: false, pending: false });
  },

  toggle: () => {
    const state = get();
    if (state.playing || state.pending) state.pause();
    else state.play();
  },

  skip: () => {
    ensureBridge();
    const state = get();
    if (!state.playing && !state.pending) return;
    if (state.endless) extendIfNeeded();
    skipAutoMix();
  },

  stop: () => {
    hushAutoMix();
    set({
      playing: false,
      pending: false,
      now: null,
      next: null,
      xfade: null,
      queue: [],
      error: null,
    });
  },
}));

/** Wall / native player is taking over: stop the mix and hide the dock. */
export function yieldAutoMixPanel() {
  hushAutoMix({ yieldPanel: true });
  useAutoMix.setState({
    open: false,
    playing: false,
    pending: false,
    now: null,
    next: null,
    xfade: null,
    queue: [],
  });
}

export { unlockAutoMix };
