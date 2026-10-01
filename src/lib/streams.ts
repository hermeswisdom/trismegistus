/**
 * Lock-screen playback: which tablets have a native stream, and the rules the
 * native <audio> player follows. Pure (no DOM), so node tests can load it.
 *
 * Streams are 128 kbps MP3 transcodes at streams/<slug>.mp3 in the private
 * Blob store, reached through /api/stream/<slug> (a short-lived presigned
 * redirect). The paid raw masters (masters/<slug>.mp3) are never streamed.
 */
import { STREAM_SLUGS } from "./stream-manifest.ts";

const STREAMS = new Set(STREAM_SLUGS);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Player backend for one tablet. */
export type PlayerBackend = "native" | "sc";

export function hasStream(slug: string | null | undefined): boolean {
  return typeof slug === "string" && STREAMS.has(slug);
}

/** Same-origin URL the <audio> element loads; null when there is no stream. */
export function streamUrl(slug: string | null | undefined): string | null {
  if (!hasStream(slug)) return null;
  return `/api/stream/${slug}`;
}

/** Blob pathname of a stream (server side), or null for an unknown slug. */
export function streamBlobPath(slug: string | null | undefined): string | null {
  if (typeof slug !== "string" || !SLUG_RE.test(slug) || !hasStream(slug)) return null;
  return `streams/${slug}.mp3`;
}

/** `?player=sc` forces the SoundCloud widget (comparison / escape hatch). */
export function nativeAudioAllowed(search: string | null | undefined): boolean {
  try {
    return new URLSearchParams(search ?? "").get("player") !== "sc";
  } catch {
    return true;
  }
}

/** Which backend plays this tablet. A stream that failed this page life falls back. */
export function pickBackend(opts: {
  slug: string;
  allowNative: boolean;
  failed?: ReadonlySet<string>;
}): PlayerBackend {
  if (!opts.allowNative) return "sc";
  if (opts.failed?.has(opts.slug)) return "sc";
  return hasStream(opts.slug) ? "native" : "sc";
}

/** Lock-screen "previous": restart the tablet if it is past this many seconds. */
export const PREV_RESTART_AFTER_S = 3;

/**
 * Lock-screen / Media Session "previous track": restart the current tablet
 * when it is a few seconds in, else go back through what was played (wheel
 * landings included), else one step back in the tracklist.
 */
export function resolvePrevious(opts: {
  elapsed: number;
  history: readonly string[];
  currentId: string;
  order: readonly string[];
}): { action: "restart" } | { action: "play"; id: string } {
  if (opts.elapsed > PREV_RESTART_AFTER_S) return { action: "restart" };
  for (let i = opts.history.length - 1; i >= 0; i -= 1) {
    const id = opts.history[i];
    if (id && id !== opts.currentId) return { action: "play", id };
  }
  const n = opts.order.length;
  const at = opts.order.indexOf(opts.currentId);
  if (n === 0) return { action: "restart" };
  const prev = opts.order[at <= 0 ? n - 1 : at - 1];
  return prev ? { action: "play", id: prev } : { action: "restart" };
}

/** Keep the last few tablets for "previous" (no consecutive duplicates). */
export function pushHistory(history: readonly string[], id: string, max = 30): string[] {
  if (history[history.length - 1] === id) return [...history];
  const next = [...history, id];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** "previous" consumed an entry: drop everything from that entry on. */
export function popHistoryTo(history: readonly string[], id: string): string[] {
  const at = history.lastIndexOf(id);
  return at < 0 ? [...history] : history.slice(0, at);
}

export type NativePhase = "idle" | "pending" | "playing" | "blocked";

/**
 * How a rejected `audio.play()` is shown. NotAllowedError = the browser wants
 * a tap ("Tap to play"); AbortError = we changed src / paused, ignore; any
 * other error (source failed) falls back to SoundCloud for that tablet.
 */
export function classifyPlayRejection(name: string | null | undefined): "blocked" | "ignore" | "fallback" {
  if (name === "NotAllowedError") return "blocked";
  if (name === "AbortError") return "ignore";
  return "fallback";
}

/** Media Session artwork for a tablet cover (absolute URL; covers are 500×500 JPEG). */
export function mediaArtwork(image: string, origin: string) {
  const src = /^https?:\/\//.test(image) ? image : `${origin.replace(/\/$/, "")}${image.startsWith("/") ? "" : "/"}${image}`;
  return [
    { src, sizes: "500x500", type: "image/jpeg" },
    { src, sizes: "512x512", type: "image/jpeg" },
  ];
}
