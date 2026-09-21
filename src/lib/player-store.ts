import { create } from "zustand";
import { readFirstSpinDone, shouldRunFirstSpin } from "@/lib/first-spin";
import { FEATURED_ID, getTrack, nextTrack, randomTrack } from "@/lib/rooms";
import { usePlayBoard } from "@/lib/play-board";
import { recordPlay } from "@/lib/plays";
import {
  applyPlayback,
  getLiveWidget,
  noteUserGesture,
  subscribePlayback,
} from "@/lib/sc-widget";
import { shouldAutoSpinOnEnter } from "@/lib/wheel-rite";
import { useWheelSpin } from "@/lib/wheel-spin";

function pageHasDeepLink() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("daily") || params.has("tablet");
}

type PlayerState = {
  entered: boolean;
  currentId: string;
  playing: boolean;
  elapsed: number;
  duration: number;
  playError: string | null;
  enter: () => void;
  play: (id?: string) => void;
  pause: () => void;
  toggle: () => void;
  playNext: () => void;
  retryPlay: () => void;
  spinTablet: () => void;
  seek: (ratio: number) => void;
  setPlaying: (value: boolean) => void;
  setTiming: (elapsed: number, duration: number) => void;
  setPlayError: (value: string | null) => void;
};

function startWidget(nextId: string, autoplay: boolean, forceEmbed = false) {
  const track = getTrack(nextId);
  if (!track) return;
  applyPlayback({
    intent: autoplay ? "play" : "select",
    soundId: track.soundId,
    permalink: track.permalink,
    forceEmbed,
  });
}

const countedAt = new Map<string, number>();

function countPlay(id: string) {
  const now = Date.now();
  if ((countedAt.get(id) ?? 0) > now - 8000) return;
  countedAt.set(id, now);
  void recordPlay({ data: id })
    .then((board) => {
      if (board) usePlayBoard.getState().setBoard(board.rows, board.recent);
    })
    .catch(() => {
      /* board still loads on its own */
    });
}

let bridged = false;

function ensurePlaybackBridge() {
  if (bridged) return;
  bridged = true;
  subscribePlayback((notice) => {
    if (notice.type === "play") {
      usePlayer.setState({ playing: true, playError: null });
      return;
    }
    if (notice.type === "pause") {
      usePlayer.setState({ playing: false });
      return;
    }
    if (notice.type === "finish") {
      usePlayer.setState({ playing: false });
      usePlayer.getState().playNext();
      return;
    }
    if (notice.type === "blocked") {
      usePlayer.setState({ playing: false, playError: notice.message });
    }
  });
}

export const usePlayer = create<PlayerState>((set, get) => ({
  entered: false,
  currentId: FEATURED_ID,
  playing: false,
  elapsed: 0,
  duration: 0,
  playError: null,

  enter: () => {
    ensurePlaybackBridge();
    const first = shouldAutoSpinOnEnter(get().entered);
    if (!first && get().entered) return;
    noteUserGesture();
    set({ entered: true, playError: null });
    const autoSpin =
      first &&
      shouldRunFirstSpin({
        alreadyDone: readFirstSpinDone(),
        hasDeepLink: pageHasDeepLink(),
      });
    if (autoSpin) {
      get().spinTablet();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          document.getElementById("wheel")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 280);
      }
      return;
    }
    get().play();
  },

  spinTablet: () => {
    ensurePlaybackBridge();
    noteUserGesture();
    const winner = randomTrack(get().currentId);
    if (!useWheelSpin.getState().begin(winner.id)) return;
    get().play(winner.id);
  },

  play: (id) => {
    ensurePlaybackBridge();
    const nextId = id ?? get().currentId;
    const track = getTrack(nextId);
    if (!track) return;
    const prevId = get().currentId;
    const wasPlaying = get().playing;
    const reset = nextId !== prevId;
    set({
      currentId: nextId,
      playing: true,
      playError: null,
      elapsed: reset ? 0 : get().elapsed,
      duration: reset ? 0 : get().duration,
    });
    startWidget(nextId, true);
    if (reset || !wasPlaying) {
      countPlay(nextId);
    }
  },

  pause: () => {
    const track = getTrack(get().currentId);
    applyPlayback({
      intent: "pause",
      soundId: track?.soundId ?? "",
      permalink: track?.permalink ?? "",
    });
    set({ playing: false });
  },

  toggle: () => {
    if (get().playing) get().pause();
    else get().play();
  },

  playNext: () => {
    const next = nextTrack(get().currentId);
    if (next) get().play(next);
  },

  retryPlay: () => {
    ensurePlaybackBridge();
    noteUserGesture();
    const id = get().currentId;
    const track = getTrack(id);
    if (!track) return;
    set({ playing: true, playError: null });
    startWidget(id, true, true);
  },

  seek: (ratio) => {
    const { duration } = get();
    if (duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * duration;
    getLiveWidget()?.seekTo(next * 1000);
    set({ elapsed: next });
  },

  setPlaying: (value) => set({ playing: value }),
  setTiming: (elapsed, duration) => set({ elapsed, duration }),
  setPlayError: (value) => set({ playError: value }),
}));
