import { create } from "zustand";
import { readFirstSpinDone, shouldRunFirstSpin } from "@/lib/first-spin";
import { FEATURED_ID, getTrack, nextTrack } from "@/lib/rooms";
import { usePlayBoard } from "@/lib/play-board";
import { recordPlay } from "@/lib/plays";
import {
  getLiveSoundId,
  getLiveWidget,
  primePlayback,
  setLiveSoundId,
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
  enter: () => void;
  play: (id?: string) => void;
  pause: () => void;
  toggle: () => void;
  playNext: () => void;
  seek: (ratio: number) => void;
  setPlaying: (value: boolean) => void;
  setTiming: (elapsed: number, duration: number) => void;
};

function startWidget(nextId: string, prevId: string) {
  const widget = getLiveWidget();
  const track = getTrack(nextId);
  if (!widget || !track) return;
  if (nextId === prevId && getLiveSoundId() === track.soundId) {
    widget.play();
    return;
  }
  setLiveSoundId(track.soundId);
  widget.load(track.permalink, { auto_play: true });
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

export const usePlayer = create<PlayerState>((set, get) => ({
  entered: false,
  currentId: FEATURED_ID,
  playing: false,
  elapsed: 0,
  duration: 0,

  enter: () => {
    const first = shouldAutoSpinOnEnter(get().entered);
    if (!first && get().entered) return;
    set({ entered: true });
    primePlayback();
    get().play();
    if (
      first &&
      shouldRunFirstSpin({
        alreadyDone: readFirstSpinDone(),
        hasDeepLink: pageHasDeepLink(),
      })
    ) {
      useWheelSpin.getState().requestSpin();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          document.getElementById("wheel")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 280);
      }
    }
  },

  play: (id) => {
    const nextId = id ?? get().currentId;
    const track = getTrack(nextId);
    if (!track) return;
    const prevId = get().currentId;
    const wasPlaying = get().playing;
    const reset = nextId !== prevId;
    set({
      currentId: nextId,
      playing: true,
      elapsed: reset ? 0 : get().elapsed,
      duration: reset ? 0 : get().duration,
    });
    startWidget(nextId, prevId);
    if (reset || !wasPlaying) {
      countPlay(nextId);
    }
  },

  pause: () => {
    getLiveWidget()?.pause();
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

  seek: (ratio) => {
    const { duration } = get();
    if (duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * duration;
    getLiveWidget()?.seekTo(next * 1000);
    set({ elapsed: next });
  },

  setPlaying: (value) => set({ playing: value }),

  setTiming: (elapsed, duration) => set({ elapsed, duration }),
}));
