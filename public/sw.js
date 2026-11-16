/* Atman Music service worker — offline listening.
 *
 * Isolated from live lock-screen audio:
 *  - live Range on /media/streams, masters, HQ, auth, admin stays on the
 *    network (never intercepted)
 *  - saved listening copies in atman-offline-audio-v1 answer Range with 206
 *    so iOS <audio> can seek offline
 *  - never cache opaque responses, HTML documents, paid masters, or HQ
 *  - skipWaiting + clients.claim so a first visit can reopen offline; the
 *    page never reloads on controllerchange (that would interrupt playback)
 *
 * Keep bypass prefixes and the range helper in sync with src/lib/offline-sw.ts.
 */
const STATIC_CACHE = "atman-offline-static-v2";
const SHELL_CACHE = "atman-offline-shell-v2";
const AUDIO_CACHE = "atman-offline-audio-v1";
const SHELL_URL = "/offline.html";
const PRECACHE = [
  SHELL_URL,
  "/manifest.webmanifest",
  "/brand/mark-192.png",
  "/brand/mark-512.png",
  "/brand/favicon.ico",
  "/apple-touch-icon.png",
];
const LIVE_CACHES = [STATIC_CACHE, SHELL_CACHE, AUDIO_CACHE];
const BYPASS_PREFIXES = [
  "/api/",
  "/auth/",
  "/admin",
  "/login",
  "/download",
  "/media/streams/",
  "/media/streams-hq/",
  "/masters/",
];
const STATIC_EXT = /\.(?:js|css|png|svg|jpe?g|webp|woff2?|webmanifest|ico)$/i;
const SAVED_AUDIO_PATH = /^\/api\/stream\/[a-z0-9]+(?:-[a-z0-9]+)*$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("atman-offline-") && !LIVE_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

function pathIsBypassed(pathname) {
  const p = String(pathname || "").toLowerCase();
  if (p === "/sw.js") return true;
  for (const prefix of BYPASS_PREFIXES) {
    if (p === prefix || p.startsWith(prefix)) return true;
    if (prefix === "/admin" && (p === "/admin" || p.startsWith("/admin/"))) return true;
    if (prefix === "/login" && (p === "/login" || p.startsWith("/login/"))) return true;
    if (prefix === "/download" && (p === "/download" || p.startsWith("/download/"))) return true;
  }
  return false;
}

function pathIsSavedAudio(pathname, search) {
  if (!SAVED_AUDIO_PATH.test(pathname || "")) return false;
  const q = String(search || "").replace(/^\?/, "");
  if (!q) return true;
  try {
    if (new URLSearchParams(q).get("hq") === "1") return false;
  } catch {
    return true;
  }
  return true;
}

function isOpaque(res) {
  return !res || res.type === "opaque" || res.type === "opaqueredirect" || res.status === 0;
}

function classify(request) {
  const method = (request.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return "ignore";
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return "ignore";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "bypass";
  if (url.origin !== self.location.origin) return "bypass";
  if (pathIsSavedAudio(url.pathname, url.search)) return "saved-audio";
  if (request.headers && request.headers.has("range")) return "bypass";
  if (pathIsBypassed(url.pathname)) return "bypass";
  if (request.mode === "navigate" || request.destination === "document") return "navigate";
  if (STATIC_EXT.test(url.pathname)) return "static";
  return "ignore";
}

function parseByteRange(header, size) {
  if (!(size > 0) || !header) return null;
  const trimmed = String(header).trim();
  const m = /^bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(trimmed);
  if (!m) return null;
  const startRaw = m[1];
  const endRaw = m[2];
  if (startRaw === "" && endRaw === "") return "unsatisfiable";
  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) return "unsatisfiable";
    if (suffix >= size) return { start: 0, end: size - 1 };
    return { start: size - suffix, end: size - 1 };
  }
  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 0 || start >= size) return "unsatisfiable";
  const end = endRaw === "" ? size - 1 : Number(endRaw);
  if (!Number.isInteger(end) || end < start) return "unsatisfiable";
  return { start: start, end: Math.min(end, size - 1) };
}

function rangeHeaders(size, contentType, partial, start, end) {
  const headers = {
    "Content-Type": contentType || "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (partial) {
    headers["Content-Range"] = "bytes " + start + "-" + end + "/" + size;
    headers["Content-Length"] = String(end - start + 1);
  } else {
    headers["Content-Length"] = String(size);
  }
  return headers;
}

function rangeResponseFromBytes(bytes, request, contentType) {
  const size = bytes.byteLength;
  const method = (request.method || "GET").toUpperCase();
  const head = method === "HEAD";
  const header = request.headers && (request.headers.get("range") || request.headers.get("Range"));
  const range = parseByteRange(header, size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": "bytes */" + size, "Accept-Ranges": "bytes" },
    });
  }
  if (range) {
    const slice = bytes.subarray(range.start, range.end + 1);
    return new Response(head ? null : slice.slice(), {
      status: 206,
      headers: rangeHeaders(size, contentType, true, range.start, range.end),
    });
  }
  return new Response(head ? null : bytes.slice(), {
    status: 200,
    headers: rangeHeaders(size, contentType, false),
  });
}

function respondSavedAudio(request) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return fetch(request);
  }
  const key = new Request(new URL(url.pathname, self.location.origin).href, { method: "GET" });
  return caches.open(AUDIO_CACHE).then((cache) =>
    cache.match(key).then((hit) => {
      if (!hit || isOpaque(hit) || !hit.ok) return fetch(request);
      return hit.arrayBuffer().then((buf) => {
        if (!buf || !buf.byteLength) return fetch(request);
        return rangeResponseFromBytes(
          new Uint8Array(buf),
          request,
          hit.headers.get("content-type") || "audio/mpeg",
        );
      });
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const kind = classify(event.request);
  if (kind === "ignore" || kind === "bypass") return;

  if (kind === "saved-audio") {
    event.respondWith(respondSavedAudio(event.request));
    return;
  }

  if (kind === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(SHELL_URL, { cacheName: SHELL_CACHE }).then((hit) => {
          if (hit) return hit;
          return caches.match(SHELL_URL).then((fallback) => fallback || Response.error());
        }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.match(event.request).then((hit) => {
        const fetched = fetch(event.request)
          .then((response) => {
            if (response && response.ok && !isOpaque(response)) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => hit);
        return hit || fetched;
      }),
    ),
  );
});
