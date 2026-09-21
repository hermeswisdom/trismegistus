import { create } from "zustand";
import { writeFirstSpinDone } from "@/lib/first-spin";
import { FEATURED_ID, getTrack, nextTrack, randomTrack } from "@/lib/rooms";
import { usePlayBoard } from "@/lib/play-board";
import { recordPlay } from "@/lib/plays";
import {
  applyPlayback,
  getLiveWidget,
  noteUserGesture,
  subscribePlayback,
} from "@/lib/sc-widget";
import { resolvePlayTap } from "@/lib/playback";
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
  playPending: boolean;
  elapsed: number;
  duration: number;
  playError: string | null;
  enter: () => void;
  play: (id?: string, opts?: { forceEmbed?: boolean; markEntered?: boolean }) => void;
  pause: () => void;
  toggle: () => void;
  toggleTrack: (id: string) => void;
  playNext: () => void;
  retryPlay: () => void;
  spinTablet: (opts?: { force?: boolean; markEntered?: boolean }) => void;
  seek: (ratio: number) => void;
  setPlaying: (value: boolean) => void;
  setTiming: (elapsed: number, duration: number) => void;
  setPlayError: (value: string | null) => void;
};

function startWidget(
  nextId: string,
  autoplay: boolean,
  opts: { forceEmbed?: boolean; retry?: boolean } = {},
) {
  const track = getTrack(nextId);
  if (!track) return;
  applyPlayback({
    intent: autoplay ? "play" : "select",
    soundId: track.soundId,
    permalink: track.permalink,
    forceEmbed: opts.forceEmbed,
    retry: opts.retry,
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
    if (notice.type === "pending") {
      usePlayer.setState({ playPending: true, playError: null });
      return;
    }
    if (notice.type === "play") {
      usePlayer.setState({ playing: true, playPending: false, playError: null });
      return;
    }
    if (notice.type === "pause") {
      usePlayer.setState({ playing: false, playPending: false });
      return;
    }
    if (notice.type === "finish") {
      usePlayer.setState({ playing: false, playPending: false });
      usePlayer.getState().playNext();
      return;
    }
    if (notice.type === "blocked") {
      usePlayer.setState({
        playing: false,
        playPending: false,
        playError: notice.message,
      });
    }
  });
}

export const usePlayer = create<PlayerState>((set, get) => ({
  entered: false,
  currentId: FEATURED_ID,
  playing: false,
  playPending: false,
  elapsed: 0,
  duration: 0,
  playError: null,

  enter: () => {
    ensurePlaybackBridge();
    const first = shouldAutoSpinOnEnter(get().entered, pageHasDeepLink());
    if (!first && get().entered) return;
    noteUserGesture();
    if (first) {
      get().spinTablet({ force: true, markEntered: true });
      writeFirstSpinDone();
      if (typeof window !== "undefined") {
        document.getElementById("wheel")?.scrollIntoView({
          behavior: "auto",
          block: "center",
        });
      }
      return;
    }
    get().play(get().currentId, { forceEmbed: true, markEntered: true });
  },

  spinTablet: (opts) => {
    ensurePlaybackBridge();
    noteUserGesture();
    const winner = randomTrack(get().currentId);
    if (!useWheelSpin.getState().begin(winner.id, { force: opts?.force ?? true })) {
      if (opts?.markEntered) set({ entered: true, playError: null });
      return;
    }
    get().play(winner.id, { forceEmbed: true, markEntered: opts?.markEntered });
  },

  play: (id, opts) => {
    ensurePlaybackBridge();
    const nextId = id ?? get().currentId;
    const track = getTrack(nextId);
    if (!track) return;
    const prevId = get().currentId;
    const wasPlaying = get().playing;
    const reset = nextId !== prevId;
    const forceEmbed = opts?.forceEmbed ?? true;
    set({
      ...(opts?.markEntered ? { entered: true } : {}),
      currentId: nextId,
      playing: true,
      playPending: true,
      playError: null,
      elapsed: reset ? 0 : get().elapsed,
      duration: reset ? 0 : get().duration,
    });
    startWidget(nextId, true, { forceEmbed });
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
    set({ playing: false, playPending: false });
  },

  toggle: () => {
    get().toggleTrack(get().currentId);
  },

  toggleTrack: (id) => {
    const state = get();
    const action = resolvePlayTap({
      currentId: state.currentId,
      tapId: id,
      playing: state.playing,
      playPending: state.playPending,
      playError: state.playError,
    });
    if (action === "pause") state.pause();
    else state.play(id, { forceEmbed: true });
  },

  playNext: () => {
    const next = nextTrack(get().currentId);
    if (next) get().play(next, { forceEmbed: false });
  },

  retryPlay: () => {
    ensurePlaybackBridge();
    noteUserGesture();
    const id = get().currentId;
    const track = getTrack(id);
    if (!track) return;
    set({ playing: true, playPending: true, playError: null });
    startWidget(id, true, { forceEmbed: true, retry: true });
  },

  seek: (ratio) => {
    const { duration } = get();
    if (duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * duration;
    getLiveWidget()?.seekTo(next * 1000);
    set({ elapsed: next });
  },

  setPlaying: (value) => set({ playing: value, playPending: value ? get().playPending : false }),
  setTiming: (elapsed, duration) => set({ elapsed, duration }),
  setPlayError: (value) => set({ playError: value, playPending: false }),
}));
