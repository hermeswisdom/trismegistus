import { create } from "zustand";
import { readFirstSpinDone, writeFirstSpinDone } from "@/lib/first-spin";
import { readLastTablet, resolveEnterIntent, writeLastTablet } from "@/lib/last-tablet";
import { FEATURED_ID, TRACKS, getTrack, nextTrack, randomTrack, type Track } from "@/lib/rooms";
import { usePlayBoard } from "@/lib/play-board";
import { recordPlay } from "@/lib/plays";
import { isQcBrowser } from "@/lib/qc-client";
import { PLAY_BLOCKED_COPY, resolvePlayTap } from "@/lib/playback";
import {
  applyPlayback,
  getAttemptPhase,
  getLiveWidget,
  isPriming,
  noteUserGesture,
  primeForLaterPlay,
  quietForSpin,
  subscribePlayback,
} from "@/lib/sc-widget";
import {
  failedStreams,
  nativePause,
  nativePhase,
  nativePlay,
  nativePrime,
  nativeSeek,
  subscribeNative,
} from "@/lib/native-audio";
import {
  configureMediaSession,
  registerMediaSessionActions,
  setMediaSessionPlaying,
  setMediaSessionPosition,
  setMediaSessionTrack,
} from "@/lib/media-session";
import {
  nativeAudioAllowed,
  pickBackend,
  popHistoryTo,
  pushHistory,
  resolvePrevious,
  type PlayerBackend,
} from "@/lib/streams";
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
  /** What plays the current tablet: native <audio> stream, or the SoundCloud widget. */
  backend: PlayerBackend;
  /** Tablets played before the current one (lock-screen "previous"). */
  history: string[];
  enter: () => void;
  play: (id?: string, opts?: { markEntered?: boolean; fromHistory?: boolean }) => void;
  pause: () => void;
  toggle: () => void;
  toggleTrack: (id: string) => void;
  playNext: () => void;
  playPrevious: () => void;
  retryPlay: () => void;
  spinTablet: (opts?: { force?: boolean; markEntered?: boolean }) => void;
  landSpin: (id: string) => void;
  seek: (ratio: number) => void;
  setPlaying: (value: boolean) => void;
  setTiming: (elapsed: number, duration: number) => void;
  setPlayError: (value: string | null) => void;
};

let nativeAllowedCache: boolean | null = null;

function nativeAllowed() {
  if (typeof window === "undefined") return false;
  if (nativeAllowedCache === null) nativeAllowedCache = nativeAudioAllowed(window.location.search);
  return nativeAllowedCache;
}

function backendFor(track: Track): PlayerBackend {
  return pickBackend({ slug: track.slug, allowNative: nativeAllowed(), failed: failedStreams() });
}

/**
 * UI state right after a start: normally pending, but a start the widget
 * already knows will be refused comes back blocked synchronously.
 */
function afterStart(backend: PlayerBackend) {
  const blocked =
    backend === "native" ? nativePhase() === "blocked" : getAttemptPhase() === "blocked";
  return {
    playing: false,
    playPending: !blocked,
    playError: blocked ? PLAY_BLOCKED_COPY : null,
  };
}

/** Stop the SoundCloud widget only if it is (or may be) sounding. */
function hushWidget(track: Track | undefined) {
  const phase = getAttemptPhase();
  if (phase !== "pending" && phase !== "playing" && !isPriming()) return;
  applyPlayback({ intent: "pause", soundId: track?.soundId ?? "", permalink: track?.permalink ?? "" });
}

/**
 * Starts the tablet on its backend in this call stack, so a tap handler (or
 * the native `ended` event) that reaches here synchronously keeps its user
 * gesture / media session. Returns the backend used.
 */
function startTrack(nextId: string): PlayerBackend | null {
  const track = getTrack(nextId);
  if (!track) return null;
  const backend = backendFor(track);
  if (backend === "native") {
    hushWidget(track);
    if (nativePlay(track)) return "native";
  } else {
    nativePause();
  }
  applyPlayback({ intent: "play", soundId: track.soundId, permalink: track.permalink });
  return "sc";
}

const countedAt = new Map<string, number>();

function countPlay(id: string) {
  const now = Date.now();
  if ((countedAt.get(id) ?? 0) > now - 8000) return;
  // Automated QC (?qc=1, headless / emulated test browsers) never counts.
  if (isQcBrowser()) return;
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
    // The widget can report on a sound we already moved off to the native player.
    if (usePlayer.getState().backend !== "sc") return;
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
  subscribeNative((notice) => {
    const state = usePlayer.getState();
    if (state.backend !== "native" || notice.id !== state.currentId) return;
    switch (notice.type) {
      case "pending":
        usePlayer.setState({ playPending: true, playError: null });
        return;
      case "play":
        usePlayer.setState({ playing: true, playPending: false, playError: null });
        setMediaSessionPlaying(true);
        registerMediaSessionActions();
        return;
      case "pause":
        usePlayer.setState({ playing: false, playPending: false });
        setMediaSessionPlaying(false);
        return;
      case "progress":
        usePlayer.setState({ elapsed: notice.elapsed, duration: notice.duration });
        setMediaSessionPosition(notice.elapsed, notice.duration);
        return;
      case "finish":
        // Synchronously, inside the element's `ended` event: iOS lets the
        // same element start the next src here even with the screen locked.
        usePlayer.setState({ playing: false, playPending: false });
        usePlayer.getState().playNext();
        return;
      case "blocked":
        usePlayer.setState({ playing: false, playPending: false, playError: PLAY_BLOCKED_COPY });
        setMediaSessionPlaying(false);
        return;
      case "fallback": {
        // Stream missing / unplayable: this tablet plays through SoundCloud.
        const id = notice.id;
        const track = getTrack(id);
        if (!track) return;
        usePlayer.setState({ backend: "sc" });
        applyPlayback({ intent: "play", soundId: track.soundId, permalink: track.permalink });
        usePlayer.setState(afterStart("sc"));
        return;
      }
    }
  });
  configureMediaSession({
    play: () => {
      const s = usePlayer.getState();
      if (!s.playing) s.play();
    },
    pause: () => usePlayer.getState().pause(),
    next: () => usePlayer.getState().playNext(),
    previous: () => usePlayer.getState().playPrevious(),
    seekTo: (seconds) => {
      const { duration } = usePlayer.getState();
      if (duration > 0) usePlayer.getState().seek(seconds / duration);
    },
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
  backend: "sc",
  history: [],

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
      // SoundCloud: hush (volume 0) rather than pause where that is silent:
      // an early pause() makes SoundCloud throw an AbortError. iOS still
      // pauses. The native element just pauses.
      if (get().backend === "sc" && quietForSpin()) set({ playing: false, playPending: false });
      else get().pause();
    }
    // The winner sounds on landing, ~4s after this tap and outside it. Start
    // it silently now (inside the tap) so iOS allows that later play.
    // No-op once real audio has been heard this page life.
    if (backendFor(winner) === "native") nativePrime(winner);
    else primeForLaterPlay(winner.soundId);
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
    // The start (native play() or the widget's skip + play postMessage)
    // leaves first, before any state update or re-render, so it rides the
    // tap's user activation.
    const backend = startTrack(nextId) ?? get().backend;
    // Honest UI: pending until audio really flows (see reduceAttempt and
    // native-audio.ts). `playing` flips on the first real progress.
    set({
      ...(opts?.markEntered || get().entered ? { entered: true } : {}),
      currentId: nextId,
      backend,
      ...afterStart(backend),
      elapsed: reset ? 0 : get().elapsed,
      duration: reset ? 0 : get().duration,
      ...(reset && get().entered && !opts?.fromHistory
        ? { history: pushHistory(get().history, prevId) }
        : {}),
    });
    setMediaSessionTrack(track);
    writeLastTablet(nextId);
    if (reset || !wasPlaying) {
      countPlay(nextId);
    }
  },

  pause: () => {
    const track = getTrack(get().currentId);
    if (get().backend === "native") {
      nativePause();
      set({ playing: false, playPending: false });
      setMediaSessionPlaying(false);
      return;
    }
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

  playPrevious: () => {
    const state = get();
    const step = resolvePrevious({
      elapsed: state.elapsed,
      history: state.history,
      currentId: state.currentId,
      order: TRACKS.map((t) => t.id),
    });
    if (step.action === "restart") {
      state.seek(0);
      if (!state.playing) state.play();
      return;
    }
    set({ history: popHistoryTo(state.history, step.id) });
    state.play(step.id, { fromHistory: true });
  },

  retryPlay: () => {
    const id = get().currentId;
    const track = getTrack(id);
    if (!track) return;
    // Same turn as the tap, and before anything else: native play(), or for
    // the widget a plain play() / skip + play. No await, no state update and
    // no iframe rewrite ahead of it.
    const backend = startTrack(id) ?? get().backend;
    ensurePlaybackBridge();
    noteUserGesture();
    set({ backend, ...afterStart(backend) });
  },

  seek: (ratio) => {
    const { duration } = get();
    if (duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * duration;
    if (get().backend === "native") nativeSeek(next);
    else getLiveWidget()?.seekTo(next * 1000);
    set({ elapsed: next });
  },

  setPlaying: (value) => set({ playing: value, playPending: value ? get().playPending : false }),
  setTiming: (elapsed, duration) => set({ elapsed, duration }),
  setPlayError: (value) => set({ playError: value, playPending: false }),
}));
