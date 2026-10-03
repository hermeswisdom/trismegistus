import { create } from "zustand";
import { endsAtFromTimer, getBowl, remainingSeconds } from "./bowls.ts";
import {
  getBowlEngine,
  hushBowlGraph,
  onBowlGraphStopped,
} from "./bowl-synth.ts";
import { usePlayer } from "./player-store.ts";

export const DEFAULT_BOWL_VOLUME = 0.48;
export const DEFAULT_BOWL_TIMER = 20;

type BowlPlayerState = {
  currentId: string | null;
  playing: boolean;
  volume: number;
  timerMin: number;
  endsAt: number | null;
  remainingSec: number | null;
  play: (id: string) => void;
  pause: (fadeSec?: number) => void;
  toggle: (id: string) => void;
  setVolume: (value: number) => void;
  setTimer: (minutes: number) => void;
  tick: (now?: number) => void;
};

let ticking = 0;

function startTick() {
  if (ticking || typeof window === "undefined") return;
  ticking = window.setInterval(() => {
    useBowlPlayer.getState().tick();
  }, 400);
}

function stopTick() {
  if (!ticking) return;
  window.clearInterval(ticking);
  ticking = 0;
}

export const useBowlPlayer = create<BowlPlayerState>((set, get) => ({
  currentId: null,
  playing: false,
  volume: DEFAULT_BOWL_VOLUME,
  timerMin: DEFAULT_BOWL_TIMER,
  endsAt: null,
  remainingSec: null,

  play: (id) => {
    const bowl = getBowl(id);
    const engine = getBowlEngine();
    if (!bowl || !engine) return;
    usePlayer.getState().pause();
    engine.setVolume(get().volume);
    engine.play(bowl);
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: bowl.name,
        artist: "Atman Music · Sound bowls",
        album: `${bowl.hzLabel} · Healing sounds`,
      });
      navigator.mediaSession.playbackState = "playing";
      try {
        navigator.mediaSession.setActionHandler("play", () => get().play(id));
        navigator.mediaSession.setActionHandler("pause", () => get().pause());
        navigator.mediaSession.setActionHandler("stop", () => get().pause());
      } catch {
        /* older browsers */
      }
    }
    const now = Date.now();
    const endsAt = endsAtFromTimer(get().timerMin, now);
    set({
      currentId: id,
      playing: true,
      endsAt,
      remainingSec: remainingSeconds(endsAt, now),
    });
    startTick();
  },

  pause: (fadeSec = 0.45) => {
    hushBowlGraph(fadeSec);
    stopTick();
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      navigator.mediaSession.playbackState = "paused";
    }
    set({ playing: false, endsAt: null, remainingSec: null });
  },

  toggle: (id) => {
    const state = get();
    if (state.playing && state.currentId === id) state.pause();
    else state.play(id);
  },

  setVolume: (value) => {
    const volume = Math.min(1, Math.max(0, value));
    getBowlEngine()?.setVolume(volume);
    set({ volume });
  },

  setTimer: (minutes) => {
    const now = Date.now();
    const endsAt = get().playing ? endsAtFromTimer(minutes, now) : null;
    set({
      timerMin: minutes,
      endsAt,
      remainingSec: remainingSeconds(endsAt, now),
    });
    if (get().playing) startTick();
  },

  tick: (now = Date.now()) => {
    const { playing, endsAt } = get();
    if (!playing) {
      stopTick();
      return;
    }
    const remaining = remainingSeconds(endsAt, now);
    if (endsAt !== null && remaining === 0) {
      get().pause(2.6);
      return;
    }
    set({ remainingSec: remaining });
  },
}));

if (typeof window !== "undefined") {
  onBowlGraphStopped(() => {
    const state = useBowlPlayer.getState();
    if (!state.playing) return;
    stopTick();
    useBowlPlayer.setState({
      playing: false,
      endsAt: null,
      remainingSec: null,
    });
  });
}
