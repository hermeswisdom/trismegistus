/* Atman Music service worker.
 * Cache-first for same-origin static assets only.
 * Network-only for HTML, /api, /auth, and every cross-origin call
 * (SoundCloud widget, covers, grok extensions). No HTML shell cache —
 * a stale document would pin an old auth/session tree.
 */
const CACHE_NAME = "atman-static-v1";
const STATIC_EXT = /\.(?:js|css|png|svg|jpe?g|webp|woff2|webmanifest|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldBypass(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/auth/")) return true;
  if (url.pathname === "/sw.js") return true;
  return false;
}

function isStaticAsset(url) {
  return STATIC_EXT.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (shouldBypass(url)) return;
  if (request.mode === "navigate") return;
  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
      }),
    ),
  );
});
