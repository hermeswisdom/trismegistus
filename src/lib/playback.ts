export const PLAY_CONFIRM_MS = 2200;

export const PLAY_BLOCKED_COPY = "The tablet did not sound. Tap to try again.";
export const PLAY_PENDING_COPY = "Sounding…";

export type PlayIntent = "play" | "pause" | "select";

export type PlayCommand = {
  intent: PlayIntent;
  soundId: string;
  permalink: string;
  /** Prefer a same-turn start. Rewrite only if the widget cannot play yet. */
  forceEmbed?: boolean;
  /** Blocked retry: always rewrite the iframe in this gesture. */
  retry?: boolean;
};

export type PlaybackSurface = {
  widgetReady: boolean;
  hasWidget: boolean;
  hasIframe: boolean;
  liveSoundId: string | null;
  unlocked: boolean;
  heardPlay: boolean;
};

export type PlaybackPlan = {
  widgetOp: "play" | "pause" | "load" | null;
  loadAutoplay: boolean;
  iframeSoundId: string | null;
  iframeAutoplay: boolean | null;
  expectPlayEvent: boolean;
};

/**
 * Decide how to start or stop a tablet on this turn.
 *
 * `widget.play()` / `load()` go through postMessage. That is fine on modern
 * iOS only when the call is made from a user gesture. If the widget is not
 * READY yet, rewrite the iframe `src` with `auto_play` in the same turn —
 * React state updates are too late for Safari's gesture token.
 */
export function planPlayback(
  cmd: PlayCommand,
  surface: PlaybackSurface,
): PlaybackPlan {
  if (cmd.intent === "pause") {
    return {
      widgetOp: surface.hasWidget ? "pause" : null,
      loadAutoplay: false,
      iframeSoundId: null,
      iframeAutoplay: null,
      expectPlayEvent: false,
    };
  }

  const autoplay = cmd.intent === "play";
  const sameSound = surface.liveSoundId === cmd.soundId;

  if (shouldRewriteEmbed(cmd, surface)) {
    return {
      widgetOp: null,
      loadAutoplay: false,
      iframeSoundId: cmd.soundId,
      iframeAutoplay: true,
      expectPlayEvent: true,
    };
  }

  if (surface.hasWidget && surface.widgetReady) {
    if (sameSound) {
      return {
        widgetOp: autoplay ? "play" : null,
        loadAutoplay: false,
        iframeSoundId: null,
        iframeAutoplay: null,
        expectPlayEvent: autoplay,
      };
    }
    return {
      widgetOp: "load",
      loadAutoplay: autoplay,
      iframeSoundId: null,
      iframeAutoplay: null,
      expectPlayEvent: autoplay,
    };
  }

  if (surface.hasIframe) {
    return {
      widgetOp: null,
      loadAutoplay: false,
      iframeSoundId: cmd.soundId,
      iframeAutoplay: autoplay,
      expectPlayEvent: autoplay,
    };
  }

  return {
    widgetOp: autoplay ? "play" : null,
    loadAutoplay: false,
    iframeSoundId: null,
    iframeAutoplay: null,
    expectPlayEvent: autoplay,
  };
}

/**
 * Rewrite the iframe only when the widget cannot take this gesture.
 * A ready widget `play()` / `load()` is faster than a full player reload.
 */
export function shouldRewriteEmbed(cmd: PlayCommand, surface: PlaybackSurface) {
  if (cmd.intent !== "play") return false;
  if (!surface.hasIframe) return false;
  if (cmd.retry) return true;
  if (!surface.hasWidget || !surface.widgetReady) return true;
  return false;
}

export function soundcloudPlayerSrc(soundId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    url: `https://api.soundcloud.com/tracks/${soundId}`,
    color: "#d6e24a",
    auto_play: autoplay ? "true" : "false",
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
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export type PlayTapState = {
  currentId: string;
  tapId: string;
  playing: boolean;
  playPending: boolean;
  playError: string | null;
};

export type PlayTapAction = "pause" | "play";

/**
 * Cover / dock / Enter retries. Pending still retries rather than pause,
 * so a second tap does not cancel a tablet that has not sounded yet.
 */
export function resolvePlayTap(state: PlayTapState): PlayTapAction {
  if (state.tapId !== state.currentId) return "play";
  if (state.playError || state.playPending) return "play";
  if (state.playing) return "pause";
  return "play";
}

export type PlayControlFace = "play" | "pause" | "pending" | "retry";

/**
 * Dock / wall face. Pending still looks like Pause so the tap is not a
 * no-op, while `resolvePlayTap` retries instead of cancelling.
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

export function embedNeedsRewrite(currentSrc: string, nextSrc: string) {
  return normalizeEmbedSrc(currentSrc) !== normalizeEmbedSrc(nextSrc);
}

function normalizeEmbedSrc(src: string) {
  try {
    const url = new URL(src, "https://w.soundcloud.com");
    url.searchParams.sort();
    return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return src;
  }
}
