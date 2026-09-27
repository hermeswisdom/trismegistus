import { create } from "zustand";
import { readFirstSpinDone, writeFirstSpinDone } from "@/lib/first-spin";
import { readLastTablet, resolveEnterIntent, writeLastTablet } from "@/lib/last-tablet";
import { FEATURED_ID, getTrack, nextTrack, randomTrack } from "@/lib/rooms";
import { usePlayBoard } from "@/lib/play-board";
import { recordPlay } from "@/lib/plays";
import { resolvePlayTap } from "@/lib/playback";
import {
  applyPlayback,
  getLiveWidget,
  noteUserGesture,
  primeForLaterPlay,
  subscribePlayback,
} from "@/lib/sc-widget";
import { wheelPlayOn } from "@/lib/wheel-rite";
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
  /** Enter resumed the last tablet, so the wheel skips its automatic first spin. */
  resumedOnEnter: boolean;
  enter: () => void;
  play: (id?: string, opts?: { markEntered?: boolean }) => void;
  pause: () => void;
  toggle: () => void;
  toggleTrack: (id: string) => void;
  playNext: () => void;
  retryPlay: () => void;
  spinTablet: (opts?: { force?: boolean; markEntered?: boolean }) => void;
  landSpin: (id: string) => void;
  seek: (ratio: number) => void;
  setPlaying: (value: boolean) => void;
  setTiming: (elapsed: number, duration: number) => void;
  setPlayError: (value: string | null) => void;
};

/**
 * Sends skip + play to the one widget in this call stack, so a tap handler
 * that reaches here synchronously keeps its user gesture.
 */
function startWidget(nextId: string) {
  const track = getTrack(nextId);
  if (!track) return;
  applyPlayback({ intent: "play", soundId: track.soundId, permalink: track.permalink });
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
  resumedOnEnter: false,

  enter: () => {
    ensurePlaybackBridge();
    const last = readLastTablet();
    const lastOk = Boolean(last && getTrack(last));
    const intent = resolveEnterIntent({
      alreadyEntered: get().entered,
      hasDeepLink: pageHasDeepLink(),
      firstSpinDone: readFirstSpinDone(),
      lastTrackId: lastOk ? last : null,
    });
    if (intent === "play" && get().entered) return;
    noteUserGesture();
    writeFirstSpinDone();
    if (intent === "spin") {
      get().spinTablet({ force: true, markEntered: true });
      if (typeof window !== "undefined") {
        document.getElementById("wheel")?.scrollIntoView({
          behavior: "auto",
          block: "center",
        });
      }
      return;
    }
    const resume = pageHasDeepLink()
      ? get().currentId
      : (lastOk && last ? last : get().currentId);
    set({ resumedOnEnter: true });
    get().play(resume, { markEntered: true });
  },

  spinTablet: (opts) => {
    ensurePlaybackBridge();
    noteUserGesture();
    if (opts?.markEntered) set({ entered: true, playError: null });
    const winner = randomTrack(get().currentId);
    if (!useWheelSpin.getState().begin(winner.id, { force: opts?.force ?? true })) {
      return;
    }
    // Keep the rite silent until the pointer rests on the winner.
    // Play is committed in `landSpin` after the disc animation finishes.
    if (wheelPlayOn("begin")) {
      get().play(winner.id, { markEntered: opts?.markEntered });
      return;
    }
    if (get().playing || get().playPending) {
      get().pause();
    }
    // The winner sounds on landing, ~4s after this tap and outside it. Start
    // the widget silently now (inside the tap) so iOS allows that later play.
    // No-op once real audio has been heard this page life.
    primeForLaterPlay(winner.soundId);
  },

  landSpin: (id) => {
    useWheelSpin.getState().finish(id);
    if (useWheelSpin.getState().busy) return;
    if (useWheelSpin.getState().landedId !== id) return;
    if (wheelPlayOn("land")) {
      get().play(id);
    }
  },

  play: (id, opts) => {
    ensurePlaybackBridge();
    const nextId = id ?? get().currentId;
    const track = getTrack(nextId);
    if (!track) return;
    const prevId = get().currentId;
    const wasPlaying = get().playing;
    const reset = nextId !== prevId;
    // Honest UI: pending until the widget reports real progress (see
    // reduceAttempt). `playing` flips on the first PLAY_PROGRESS > 0.
    set({
      ...(opts?.markEntered || get().entered ? { entered: true } : {}),
      currentId: nextId,
      playing: false,
      playPending: true,
      playError: null,
      elapsed: reset ? 0 : get().elapsed,
      duration: reset ? 0 : get().duration,
    });
    startWidget(nextId);
    writeLastTablet(nextId);
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
    else state.play(id);
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
    // Same one widget, same turn as the tap: a cued tablet gets a plain
    // play(), anything else skip + play. No iframe rewrite.
    set({ playing: false, playPending: true, playError: null });
    startWidget(id);
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
