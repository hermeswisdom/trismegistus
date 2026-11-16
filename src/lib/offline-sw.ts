/**
 * Service worker policy for offline listening.
 *
 * Live network streams, paid masters, auth, admin, Stripe and HTML documents
 * stay network-only. Range on those URLs is never intercepted (the native
 * <audio> element talks to the origin / CDN).
 *
 * Explicitly saved listening copies live in Cache Storage
 * (`SW_AUDIO_CACHE`). Requests for `/api/stream/<slug>` that hit that cache
 * are answered here, including Range → 206, so iOS can seek offline. A cache
 * miss falls through to the network and is not stored (save is explicit).
 *
 * Keep the prefix lists and range helper in sync with public/sw.js.
 */

export const SW_STATIC_CACHE = "atman-offline-static-v2";
export const SW_SHELL_CACHE = "atman-offline-shell-v2";
export const SW_AUDIO_CACHE = "atman-offline-audio-v1";
export const SW_SHELL_URL = "/offline.html";
export const SW_SCRIPT_URL = "/sw.js";

export const SW_LIVE_CACHES = [SW_STATIC_CACHE, SW_SHELL_CACHE, SW_AUDIO_CACHE] as const;

export const SW_PRECACHE = [
  SW_SHELL_URL,
  "/manifest.webmanifest",
  "/brand/mark-192.png",
  "/brand/mark-512.png",
  "/brand/favicon.ico",
  "/apple-touch-icon.png",
] as const;

/** Same-origin paths the SW must not intercept or cache (except saved audio). */
export const SW_BYPASS_PREFIXES = [
  "/api/",
  "/auth/",
  "/admin",
  "/login",
  "/download",
  "/media/streams/",
  "/media/streams-hq/",
  "/masters/",
] as const;

export const SW_STATIC_EXT = /\.(?:js|css|png|svg|jpe?g|webp|woff2?|webmanifest|ico)$/i;

/** Listening-copy route the page writes into SW_AUDIO_CACHE. Never HQ. */
export const SW_SAVED_AUDIO_PATH = /^\/api\/stream\/[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export type SwRequestKind = "bypass" | "navigate" | "static" | "ignore" | "saved-audio";

export function swPathIsSavedAudio(pathname: string, search = ""): boolean {
  if (!SW_SAVED_AUDIO_PATH.test(pathname)) return false;
  const q = search.startsWith("?") ? search.slice(1) : search;
  if (!q) return true;
  const params = new URLSearchParams(q);
  if (params.get("hq") === "1") return false;
  return true;
}

export function savedAudioCacheKey(slug: string, origin: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${base}/api/stream/${slug}`;
}

export function slugFromSavedAudioPath(pathname: string): string | null {
  const m = pathname.match(/^\/api\/stream\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i);
  return m?.[1] ? m[1].toLowerCase() : null;
}

export function swPathIsBypassed(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (p === SW_SCRIPT_URL) return true;
  for (const prefix of SW_BYPASS_PREFIXES) {
    if (p === prefix || p.startsWith(prefix)) return true;
    // /admin is a route (not only a prefix with slash): /admin and /admin/
    if (prefix === "/admin" && (p === "/admin" || p.startsWith("/admin/"))) return true;
    if (prefix === "/login" && (p === "/login" || p.startsWith("/login/"))) return true;
    if (prefix === "/download" && (p === "/download" || p.startsWith("/download/"))) return true;
  }
  return false;
}

export function swClassifyRequest(input: {
  method: string;
  url: string;
  origin: string;
  hasRange: boolean;
  mode?: string;
  destination?: string;
}): SwRequestKind {
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return "ignore";
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return "ignore";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "bypass";
  if (url.origin !== input.origin) return "bypass";
  // Saved listening copies: intercept Range so we can answer 206 from cache.
  // A miss is fetched through, never stored here (explicit Save only).
  if (swPathIsSavedAudio(url.pathname, url.search)) return "saved-audio";
  if (input.hasRange) return "bypass";
  if (swPathIsBypassed(url.pathname)) return "bypass";
  if (input.mode === "navigate" || input.destination === "document") return "navigate";
  if (SW_STATIC_EXT.test(url.pathname)) return "static";
  return "ignore";
}

/** True when this SW cache name belongs to an older generation we may delete. */
export function swCacheIsStale(name: string, live: readonly string[] = SW_LIVE_CACHES): boolean {
  if (!name.startsWith("atman-offline-")) return false;
  return !live.includes(name);
}

export function isOpaqueResponse(res: { type?: string; status?: number } | null | undefined): boolean {
  if (!res) return true;
  if (res.type === "opaque" || res.type === "opaqueredirect") return true;
  if (res.status === 0) return true;
  return false;
}

export function isCacheableResponse(res: { ok?: boolean; type?: string; status?: number } | null | undefined): boolean {
  if (!res) return false;
  if (isOpaqueResponse(res)) return false;
  return res.ok === true;
}

export type ParsedByteRange = { start: number; end: number };

/**
 * Parse a single `Range: bytes=` header against a known body size.
 * Multiple ranges, malformed values, or a missing header → null (full 200).
 * A well-formed range that cannot be satisfied → "unsatisfiable" (416).
 */
export function parseByteRange(
  header: string | null | undefined,
  size: number,
): ParsedByteRange | "unsatisfiable" | null {
  if (!(size > 0)) return null;
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  // iOS sends `bytes=0-1` then `bytes=start-`. Refuse multipart; Safari
  // audio does not send it.
  const m = /^bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(trimmed);
  if (!m) return null;
  const startRaw = m[1] ?? "";
  const endRaw = m[2] ?? "";
  if (startRaw === "" && endRaw === "") return "unsatisfiable";
  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) return "unsatisfiable";
    if (suffix >= size) return { start: 0, end: size - 1 };
    return { start: size - suffix, end: size - 1 };
  }
  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 0) return "unsatisfiable";
  if (start >= size) return "unsatisfiable";
  const end = endRaw === "" ? size - 1 : Number(endRaw);
  if (!Number.isInteger(end) || end < start) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}

export function rangeResponseHeaders(opts: {
  size: number;
  contentType?: string;
  start?: number;
  end?: number;
  partial: boolean;
}): Record<string, string> {
  const type = opts.contentType || "audio/mpeg";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (opts.partial && opts.start != null && opts.end != null) {
    headers["Content-Range"] = `bytes ${opts.start}-${opts.end}/${opts.size}`;
    headers["Content-Length"] = String(opts.end - opts.start + 1);
  } else {
    headers["Content-Length"] = String(opts.size);
  }
  return headers;
}

/**
 * Build a 200 / 206 / 416 Response from a cached full-file body.
 * The 206 body is sliced: iOS <audio> seeking fails if a 206 still carries
 * the whole file.
 */
export function buildCachedAudioRangeResponse(opts: {
  bytes: Uint8Array;
  contentType?: string;
  rangeHeader?: string | null;
  method?: string;
}): Response {
  const size = opts.bytes.byteLength;
  const method = (opts.method || "GET").toUpperCase();
  const head = method === "HEAD";
  const range = parseByteRange(opts.rangeHeader, size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }
  if (range) {
    const slice = opts.bytes.subarray(range.start, range.end + 1);
    const body = head ? null : slice.slice();
    return new Response(body, {
      status: 206,
      headers: rangeResponseHeaders({
        size,
        start: range.start,
        end: range.end,
        contentType: opts.contentType,
        partial: true,
      }),
    });
  }
  const body = head ? null : opts.bytes.slice();
  return new Response(body, {
    status: 200,
    headers: rangeResponseHeaders({ size, contentType: opts.contentType, partial: false }),
  });
}

export async function cachedAudioToRangeResponse(
  cached: Response,
  request: { headers: { get(name: string): string | null }; method?: string },
): Promise<Response> {
  if (isOpaqueResponse(cached) || !cached.ok) {
    return new Response(null, { status: 504, statusText: "saved audio missing" });
  }
  const buf = await cached.arrayBuffer();
  if (!buf.byteLength) {
    return new Response(null, { status: 504, statusText: "saved audio empty" });
  }
  const bytes = new Uint8Array(buf);
  return buildCachedAudioRangeResponse({
    bytes,
    contentType: cached.headers.get("content-type") || "audio/mpeg",
    rangeHeader: request.headers.get("range") || request.headers.get("Range"),
    method: request.method,
  });
}
