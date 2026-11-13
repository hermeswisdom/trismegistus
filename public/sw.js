/* Atman Music service worker — offline listening test.
 *
 * Isolated from native lock-screen audio:
 *  - never intercept Range requests (the <audio> element needs them)
 *  - never touch /api/stream, /media/streams, /media/streams-hq, masters/
 *  - never cache HTML documents (auth/session pages stay network-only)
 *  - saved songs live in IndexedDB and play as blob: URLs, not from Cache Storage
 *
 * Navigation that fails while offline gets the public /offline.html shell.
 * skipWaiting + clients.claim so the first visit can reopen offline; the
 * page never reloads on controllerchange (that would interrupt playback).
 *
 * Keep bypass prefixes in sync with src/lib/offline-sw.ts.
 */
const STATIC_CACHE = "atman-offline-static-v2";
const SHELL_CACHE = "atman-offline-shell-v2";
const SHELL_URL = "/offline.html";
const PRECACHE = [
  SHELL_URL,
  "/manifest.webmanifest",
  "/brand/mark-192.png",
  "/brand/mark-512.png",
  "/brand/favicon.ico",
  "/apple-touch-icon.png",
];
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
            .filter((key) => key.startsWith("atman-offline-") && key !== STATIC_CACHE && key !== SHELL_CACHE)
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

function classify(request) {
  const method = (request.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return "ignore";
  if (request.headers && request.headers.has("range")) return "bypass";
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return "ignore";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "bypass";
  if (url.origin !== self.location.origin) return "bypass";
  if (pathIsBypassed(url.pathname)) return "bypass";
  if (request.mode === "navigate" || request.destination === "document") return "navigate";
  if (STATIC_EXT.test(url.pathname)) return "static";
  return "ignore";
}

self.addEventListener("fetch", (event) => {
  const kind = classify(event.request);
  if (kind === "ignore" || kind === "bypass") return;

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
            if (response && response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit || fetched;
      }),
    ),
  );
});
