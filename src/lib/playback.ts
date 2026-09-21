export const PLAY_CONFIRM_MS = 2200;

export const PLAY_BLOCKED_COPY = "The tablet did not sound. Tap to try again.";
export const PLAY_PENDING_COPY = "Sounding…";

export type PlayIntent = "play" | "pause" | "select";

export type PlayCommand = {
  intent: PlayIntent;
  soundId: string;
  permalink: string;
  /** Retry: rewrite the iframe src in this turn so iOS can start media. */
  forceEmbed?: boolean;
};

export type PlaybackSurface = {
  widgetReady: boolean;
  hasWidget: boolean;
  hasIframe: boolean;
  liveSoundId: string | null;
  unlocked: boolean;
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

  if (cmd.forceEmbed && surface.hasIframe && autoplay) {
    return {
      widgetOp: surface.hasWidget && surface.widgetReady
        ? sameSound
          ? "play"
          : "load"
        : null,
      loadAutoplay: !sameSound,
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
 * Cover / dock / Enter retries. A pending or blocked play must not look like
 * Pause — that tap would cancel the gesture instead of retrying the widget.
 */
export function resolvePlayTap(state: PlayTapState): PlayTapAction {
  if (state.tapId !== state.currentId) return "play";
  if (state.playError || state.playPending) return "play";
  if (state.playing) return "pause";
  return "play";
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
