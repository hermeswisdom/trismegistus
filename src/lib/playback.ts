/**
 * Pure playback rules for the single SoundCloud widget.
 *
 * The wall used to reload the SoundCloud iframe for every tablet. A reloaded
 * iframe is a new document with no user gesture, so iOS Safari (and Chromium
 * with a strict autoplay policy) rejected its `play()` while the dock already
 * showed Pause. Now one widget hosts Atman's whole SoundCloud profile as a
 * playlist, and a tap calls `skip(index)` + `play()` in the same turn.
 * The UI only claims "playing" once the widget reports real progress.
 */

/** SoundCloud user behind esoteric_vibrations — the widget playlist source. */
export const SC_USER_ID = "190466185";

/** Safety net: an attempt that never reports progress is shown as blocked. */
export const PLAY_CONFIRM_MS = 9000;
/** A PAUSE at ~0 with no PLAY right behind it means the browser refused play(). */
export const PLAY_BLOCKED_SETTLE_MS = 650;
/** "About zero" for a refused start, in widget milliseconds. */
export const PLAY_BLOCKED_POSITION_MS = 300;
/** Give up waiting for the profile playlist and fall back to a single-track load. */
export const PLAYLIST_WAIT_MS = 15000;

export const PLAY_BLOCKED_COPY = "Tap to play";
export const PLAY_PENDING_COPY = "Sounding…";

export type PlayIntent = "play" | "pause";

export type PlayCommand = {
  intent: PlayIntent;
  soundId: string;
  permalink: string;
};

export type PlaybackSurface = {
  hasWidget: boolean;
  widgetReady: boolean;
  /** Sound the widget is cued on (or was last told to cue). */
  liveSoundId: string | null;
  /** Index of the requested sound in the widget playlist, -1 when unknown. */
  soundIndex: number;
  /** The playlist has every catalog sound (or we stopped waiting). */
  soundsComplete: boolean;
  /** Real audio has been heard this page life (the media element is unlocked). */
  audioUnlocked: boolean;
};

export type PlaybackOp =
  /** `widget.pause()` */
  | { op: "pause" }
  /** Same sound already cued: `widget.play()` */
  | { op: "play" }
  /** Different sound in the playlist: `widget.skip(index)` + `widget.play()` */
  | { op: "skip-play"; index: number }
  /**
   * Cannot start this turn (widget not ready or playlist still loading).
   * Queue it; `prime` asks for a silent in-gesture start so the element is
   * unlocked by the time the queued play runs.
   */
  | { op: "wait"; prime: boolean }
  /** Sound is not in the profile playlist: single-track `widget.load`. */
  | { op: "load" }
  | { op: "none" };

export function planPlayback(cmd: PlayCommand, surface: PlaybackSurface): PlaybackOp {
  if (cmd.intent === "pause") {
    return surface.hasWidget ? { op: "pause" } : { op: "none" };
  }
  if (!surface.hasWidget || !surface.widgetReady) {
    return { op: "wait", prime: false };
  }
  if (surface.liveSoundId === cmd.soundId) return { op: "play" };
  if (surface.soundIndex >= 0) return { op: "skip-play", index: surface.soundIndex };
  if (!surface.soundsComplete) return { op: "wait", prime: !surface.audioUnlocked };
  return { op: "load" };
}

/** True once every catalog sound id is in the widget playlist. */
export function playlistCovers(playlistIds: readonly string[], catalogIds: readonly string[]) {
  if (catalogIds.length === 0) return playlistIds.length > 0;
  const have = new Set(playlistIds);
  return catalogIds.every((id) => have.has(id));
}

// ---------------------------------------------------------------------------
// Attempt tracker: turns raw widget events into honest UI notices.
// ---------------------------------------------------------------------------

export type AttemptPhase = "idle" | "pending" | "playing" | "blocked";

export type AttemptState = {
  phase: AttemptPhase;
  soundId: string | null;
  startedAt: number;
  /** A PAUSE at ~0 arrived while pending; blocked unless a PLAY follows. */
  suspectSince: number | null;
};

export type AttemptEvent =
  | { type: "start"; soundId: string; now: number }
  | { type: "stop" }
  | { type: "widget-play"; soundId: string | null; now: number }
  | { type: "widget-pause"; soundId: string | null; position: number; now: number }
  | { type: "widget-progress"; soundId: string | null; position: number }
  | { type: "widget-finish"; soundId: string | null }
  | { type: "widget-error" }
  | { type: "settle-timeout"; now: number }
  | { type: "confirm-timeout" };

export type AttemptNotice = "pending" | "play" | "pause" | "finish" | "blocked";

export type AttemptEffect = "arm-settle" | "arm-confirm" | "clear-timers";

export type AttemptResult = {
  state: AttemptState;
  notice: AttemptNotice | null;
  effects: AttemptEffect[];
};

export const IDLE_ATTEMPT: AttemptState = {
  phase: "idle",
  soundId: null,
  startedAt: 0,
  suspectSince: null,
};

function matches(state: AttemptState, soundId: string | null) {
  // Widget events without a sound id are trusted; ids that differ belong to a
  // sound we are skipping away from (or SoundCloud's own auto-advance).
  return soundId === null || state.soundId === null || soundId === state.soundId;
}

export function reduceAttempt(state: AttemptState, event: AttemptEvent): AttemptResult {
  const same = (notice: AttemptNotice | null = null, effects: AttemptEffect[] = []) => ({
    state,
    notice,
    effects,
  });

  switch (event.type) {
    case "start":
      return {
        state: { phase: "pending", soundId: event.soundId, startedAt: event.now, suspectSince: null },
        notice: "pending",
        effects: ["arm-confirm"],
      };
    case "stop":
      return { state: { ...IDLE_ATTEMPT, soundId: state.soundId }, notice: null, effects: ["clear-timers"] };
    case "widget-play":
      if (state.phase === "pending" && matches(state, event.soundId) && state.suspectSince !== null) {
        return { state: { ...state, suspectSince: null }, notice: null, effects: [] };
      }
      return same();
    case "widget-progress":
      if (!matches(state, event.soundId) || event.position <= 0) return same();
      if (state.phase === "pending" || state.phase === "blocked") {
        return {
          state: { ...state, phase: "playing", suspectSince: null },
          notice: "play",
          effects: ["clear-timers"],
        };
      }
      return same();
    case "widget-pause":
      if (!matches(state, event.soundId)) return same();
      if (state.phase === "pending") {
        if (event.position <= PLAY_BLOCKED_POSITION_MS) {
          return { state: { ...state, suspectSince: event.now }, notice: null, effects: ["arm-settle"] };
        }
        return same();
      }
      if (state.phase === "playing") {
        return { state: { ...state, phase: "idle" }, notice: "pause", effects: ["clear-timers"] };
      }
      return same();
    case "widget-finish":
      if (!matches(state, event.soundId)) return same();
      if (state.phase === "playing" || state.phase === "pending") {
        return { state: { ...state, phase: "idle", suspectSince: null }, notice: "finish", effects: ["clear-timers"] };
      }
      return same();
    case "widget-error":
      if (state.phase === "pending") {
        return { state: { ...state, phase: "blocked", suspectSince: null }, notice: "blocked", effects: ["clear-timers"] };
      }
      return same();
    case "settle-timeout":
      if (
        state.phase === "pending" &&
        state.suspectSince !== null &&
        event.now - state.suspectSince >= PLAY_BLOCKED_SETTLE_MS - 5
      ) {
        return { state: { ...state, phase: "blocked", suspectSince: null }, notice: "blocked", effects: ["clear-timers"] };
      }
      return same();
    case "confirm-timeout":
      if (state.phase === "pending") {
        return { state: { ...state, phase: "blocked", suspectSince: null }, notice: "blocked", effects: ["clear-timers"] };
      }
      return same();
  }
}

// ---------------------------------------------------------------------------
// Embed URLs
// ---------------------------------------------------------------------------

const EMBED_PARAMS = {
  color: "#d6e24a",
  hide_related: "true",
  show_comments: "false",
  show_user: "false",
  show_reposts: "false",
  show_teaser: "false",
  show_artwork: "false",
  visual: "false",
  buying: "false",
  sharing: "false",
  download: "false",
} as const;

export function soundcloudPlayerSrc(soundId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    url: `https://api.soundcloud.com/tracks/${soundId}`,
    auto_play: autoplay ? "true" : "false",
    ...EMBED_PARAMS,
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

/** The one widget: Atman's whole profile as a playlist, never auto-playing. */
export function soundcloudPlaylistSrc(userId = SC_USER_ID) {
  const params = new URLSearchParams({
    url: `https://api.soundcloud.com/users/${userId}`,
    auto_play: "false",
    ...EMBED_PARAMS,
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export type PlayTapState = {
  currentId: string;
  tapId: string;
  playing: boolean;
  playPending: boolean;
  playError: string | null;
};

export type PlayTapAction = "pause" | "play";

/**
 * Cover / dock / Enter taps. Pending and blocked both retry (inside the tap)
 * rather than pause, so a tablet that has not sounded yet is not cancelled.
 */
export function resolvePlayTap(state: PlayTapState): PlayTapAction {
  if (state.tapId !== state.currentId) return "play";
  if (state.playError || state.playPending) return "play";
  if (state.playing) return "pause";
  return "play";
}

export type PlayControlFace = "play" | "pause" | "pending" | "retry";

/**
 * Dock / wall face. `pause` only after the widget reported real progress.
 * Pending keeps a Pause glyph with "Sounding…" beside it; a refused start
 * becomes `retry` ("Tap to play").
 */
export function playControlFace(state: {
  playing: boolean;
  playPending: boolean;
  playError: string | null;
}): PlayControlFace {
  if (state.playError) return "retry";
  if (state.playPending) return "pending";
  if (state.playing) return "pause";
  return "play";
}

export function playControlShowsPause(face: PlayControlFace) {
  return face === "pause" || face === "pending";
}

export function playControlAria(face: PlayControlFace) {
  if (face === "retry") return "Retry play";
  if (face === "pending" || face === "pause") return "Pause";
  return "Play";
}

// ---------------------------------------------------------------------------
// Device capability
// ---------------------------------------------------------------------------

export type MediaVolumeProbe = {
  userAgent: string;
  platform?: string;
  maxTouchPoints: number;
  coarsePointer: boolean;
  /** An <audio> element kept a volume of 0.5 (null = could not test). */
  volumeSticks: boolean | null;
};

/**
 * True where `HTMLMediaElement.volume` is ignored (iOS / iPadOS), so a
 * volume-0 "silent prime" would be heard.
 */
export function mediaVolumeIgnored(probe: MediaVolumeProbe) {
  if (probe.volumeSticks === false) return true;
  if (/\b(iPhone|iPad|iPod)\b/.test(probe.userAgent)) return true;
  // iPadOS 13+ reports a desktop Mac UA; touch gives it away.
  const macLike = /Macintosh|MacIntel/.test(`${probe.userAgent} ${probe.platform ?? ""}`);
  if (macLike && probe.maxTouchPoints > 1) return true;
  if (macLike && probe.coarsePointer) return true;
  return false;
}

// ---------------------------------------------------------------------------
// "Tap to play" overlay
// ---------------------------------------------------------------------------

/**
 * SoundCloud's own play button inside the 320×166 classic widget
 * (visual=false, show_artwork=false): a ~42px circle centred here.
 */
export const SC_PLAY_BUTTON = { x: 29, y: 32, radius: 20 } as const;

export type TapTargetRect = { left: number; top: number; width: number; height: number };

/**
 * Where to put the widget iframe so SoundCloud's play button sits over a
 * "Tap to play" control. Strict autoplay (Chrome with a user-gesture policy,
 * Android) only lets a cross-origin iframe start audio from a tap inside
 * that iframe; a tap on our button is not enough.
 */
export function tapOverlayPlacement(target: TapTargetRect) {
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const radius = Math.max(
    12,
    Math.min(SC_PLAY_BUTTON.radius, Math.floor(Math.min(target.width, target.height) / 2)),
  );
  return {
    left: Math.round(cx - SC_PLAY_BUTTON.x),
    top: Math.round(cy - SC_PLAY_BUTTON.y),
    clipPath: `circle(${radius}px at ${SC_PLAY_BUTTON.x}px ${SC_PLAY_BUTTON.y}px)`,
  };
}

export type TapTargetCandidate = {
  kind: "wheel" | "dock";
  rect: TapTargetRect;
};

/**
 * Pick the control to cover: the one the pointer is on, else the wheel's
 * "Tap to play" when it is fully on screen above the dock, else the dock.
 */
export function pickTapTarget(
  candidates: TapTargetCandidate[],
  viewport: { width: number; height: number; dockTop: number },
  hovered?: "wheel" | "dock" | null,
): TapTargetCandidate | null {
  const visible = candidates.filter(
    (c) =>
      c.rect.width > 0 &&
      c.rect.height > 0 &&
      c.rect.left >= 0 &&
      c.rect.top >= 0 &&
      c.rect.left + c.rect.width <= viewport.width &&
      c.rect.top + c.rect.height <= viewport.height,
  );
  if (hovered) {
    const h = visible.find((c) => c.kind === hovered);
    if (h) return h;
  }
  const wheel = visible.find(
    (c) => c.kind === "wheel" && c.rect.top + c.rect.height <= viewport.dockTop,
  );
  if (wheel) return wheel;
  return visible.find((c) => c.kind === "dock") ?? null;
}

/**
 * Scroll delta that brings the wheel's Tap to play fully on screen above the
 * dock when it landed just behind it (long meanings push it down on phones).
 * 0 when it is already clear or too far away to be what the user is on.
 */
export function tapTargetNudge(
  rect: TapTargetRect,
  viewport: { height: number; dockTop: number },
  margin = 16,
  reach = 320,
) {
  const bottom = rect.top + rect.height;
  if (rect.top >= 0 && bottom <= viewport.dockTop) return 0;
  if (rect.top > viewport.height + reach || bottom < -reach) return 0;
  if (bottom > viewport.dockTop) return Math.ceil(bottom - (viewport.dockTop - margin));
  return Math.floor(rect.top - margin);
}
