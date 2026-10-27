/**
 * Lock-screen playback: which tablets have a native stream, and the rules the
 * native <audio> player follows. Pure (no DOM), so node tests can load it.
 *
 * Streams are MP3 transcodes in the private Blob store, reached through
 * /api/stream/<slug> (a short-lived presigned redirect). The wall player uses
 * the 128 kbps copy at streams/<slug>.mp3. Auto Mix asks for the 320 kbps
 * copy with ?hq=1 (streams-hq/<slug>.mp3), and the route falls back to the
 * 128k file when the HQ object is not there yet. The paid raw masters
 * (masters/<slug>.mp3) are never streamed.
 */
import { STREAM_SLUGS } from "./stream-manifest.ts";

const STREAMS = new Set(STREAM_SLUGS);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 128 kbps transcodes the wall player uses. */
export const STREAM_BLOB_PREFIX = "streams/";
/** 320 kbps transcodes Auto Mix prefers. Uploaded separately; may be absent. */
export const STREAM_HQ_BLOB_PREFIX = "streams-hq/";
/** Query flag /api/stream/<slug> accepts for the HQ copy. */
export const STREAM_HQ_PARAM = "hq";

/** Player backend for one tablet. */
export type PlayerBackend = "native" | "sc";

export type StreamUrlOpts = {
  /** Auto Mix: ask the route for streams-hq/, with a 128k fallback. */
  hq?: boolean;
};

export function hasStream(slug: string | null | undefined): boolean {
  return typeof slug === "string" && STREAMS.has(slug);
}

function isStreamSlug(slug: string | null | undefined): slug is string {
  return typeof slug === "string" && SLUG_RE.test(slug) && STREAMS.has(slug);
}

/** Same-origin URL the <audio> element loads; null when there is no stream. */
export function streamUrl(
  slug: string | null | undefined,
  opts?: StreamUrlOpts,
): string | null {
  if (!hasStream(slug)) return null;
  const path = `/api/stream/${slug}`;
  return opts?.hq ? `${path}?${STREAM_HQ_PARAM}=1` : path;
}

/** Blob pathname of a stream (server side), or null for an unknown slug. */
export function streamBlobPath(
  slug: string | null | undefined,
  opts?: StreamUrlOpts,
): string | null {
  if (!isStreamSlug(slug)) return null;
  const prefix = opts?.hq ? STREAM_HQ_BLOB_PREFIX : STREAM_BLOB_PREFIX;
  return `${prefix}${slug}.mp3`;
}

/**
 * Pathname to sign for a stream request. HQ is used only when the caller
 * asked for it *and* the HQ object is known to exist; otherwise the 128k
 * file. Never returns masters/.
 */
export function pickStreamBlobPath(opts: {
  slug: string | null | undefined;
  preferHq?: boolean;
  hqAvailable?: boolean;
}): string | null {
  const std = streamBlobPath(opts.slug);
  if (!std) return null;
  if (opts.preferHq && opts.hqAvailable) return streamBlobPath(opts.slug, { hq: true });
  return std;
}

/** True when /api/stream should try the 320k copy (`?hq=1` or `?hq=true`). */
export function wantsHqStream(
  search: string | URLSearchParams | null | undefined,
): boolean {
  let params: URLSearchParams;
  try {
    if (search instanceof URLSearchParams) params = search;
    else if (!search) params = new URLSearchParams();
    else if (/^https?:\/\//i.test(search)) params = new URL(search).searchParams;
    else params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return false;
  }
  const hq = params.get(STREAM_HQ_PARAM);
  return hq === "1" || hq === "true";
}

/** `?player=sc` forces the SoundCloud widget (comparison / escape hatch). */
export function nativeAudioAllowed(search: string | null | undefined): boolean {
  try {
    return new URLSearchParams(search ?? "").get("player") !== "sc";
  } catch {
    return true;
  }
}

/**
 * SoundCloud can play this tablet: it has a published sound id. A tablet
 * SoundCloud is still processing has none yet, and loading its permalink in
 * the widget 404s and drops the profile playlist.
 */
export function canUseSoundCloud(track: { soundId?: string | null }): boolean {
  return Boolean(track.soundId?.trim());
}

/**
 * The native stream failed: hand the tablet to SoundCloud, or, with no sound
 * id, stay native and show the can't-play / Try again state.
 */
export function streamFailureAction(track: { soundId?: string | null }): "sc" | "error" {
  return canUseSoundCloud(track) ? "sc" : "error";
}

/**
 * Which backend plays this tablet. A stream that failed this page life falls
 * back to SoundCloud, except for a tablet with no SoundCloud sound
 * (`soundCloud: false`), which only the stream can play.
 */
export function pickBackend(opts: {
  slug: string;
  allowNative: boolean;
  failed?: ReadonlySet<string>;
  soundCloud?: boolean;
}): PlayerBackend {
  if (opts.soundCloud === false && hasStream(opts.slug)) return "native";
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

/**
 * Next tablet in catalogue order that `playable` accepts (auto-advance and
 * lock-screen "next" while the native player is in use skip tablets without a
 * stream: a SoundCloud start there would end lock-screen playback). Falls back
 * to the plain next tablet when nothing else is playable.
 */
export function nextPlayable(
  order: readonly { id: string; slug: string }[],
  currentId: string,
  playable: (slug: string) => boolean,
): string | undefined {
  if (order.length === 0) return undefined;
  const i = order.findIndex((t) => t.id === currentId);
  for (let step = 1; step <= order.length; step++) {
    const t = order[(Math.max(i, -1) + step + order.length) % order.length];
    if (t && t.id !== currentId && playable(t.slug)) return t.id;
  }
  return order[(i + 1 + order.length) % order.length]?.id;
}

/**
 * Random tablet for the wheel, optionally limited to `playable` ones (see
 * `wheelWinnerFilter`). Never the current tablet when there is another;
 * falls back to the whole pool when nothing else fits.
 */
export function pickRandomPlayable<T extends { id: string }>(
  pool: readonly T[],
  opts: { except?: string; playable?: (item: T) => boolean; random?: () => number } = {},
): T | undefined {
  const random = opts.random ?? Math.random;
  const others = opts.except && pool.length > 1 ? pool.filter((t) => t.id !== opts.except) : [...pool];
  const playable = opts.playable ? others.filter(opts.playable) : others;
  const from = playable.length > 0 ? playable : others;
  if (from.length === 0) return undefined;
  return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
}

/**
 * Which tablets may win a wheel spin.
 *
 * Only the automatic first-visit landing (Enter → wheel, `spinTablet({
 * markEntered })`, or the wheel's own mount-time auto spin) is limited to
 * tablets with a native stream while the native player is in use: there the
 * start can be refused by autoplay rules, and a SoundCloud-fallback winner
 * would then need the iframe "Tap to play" overlay (the WebKit first-tap race,
 * #34). Every other spin is a tap on the wheel or dice, so any tablet can win,
 * including the ones without a stream (lift-me-up, remember-who-you-are-mp3-1),
 * which play through SoundCloud inside that tap.
 */
export function wheelWinnerFilter<T>(opts: {
  landing: boolean;
  nativeInUse: boolean;
  isNative: (item: T) => boolean;
}): ((item: T) => boolean) | undefined {
  return opts.landing && opts.nativeInUse ? opts.isNative : undefined;
}
