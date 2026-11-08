/**
 * Service worker policy for the offline-listening test build.
 *
 * Isolated from the native player: Range requests, stream bytes, paid
 * masters, auth, admin, Stripe and HTML documents are never cached. A
 * navigation that fails while offline gets the public /offline.html shell
 * only — not a stale signed-in document.
 *
 * Keep the prefix lists in sync with public/sw.js (tests check both).
 */

export const SW_STATIC_CACHE = "atman-offline-static-v1";
export const SW_SHELL_CACHE = "atman-offline-shell-v1";
export const SW_SHELL_URL = "/offline.html";
export const SW_SCRIPT_URL = "/sw.js";

export const SW_PRECACHE = [
  SW_SHELL_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon.svg",
  "/apple-touch-icon.png",
] as const;

/** Same-origin paths the SW must not intercept or cache. */
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

export type SwRequestKind = "bypass" | "navigate" | "static" | "ignore";

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
  if (input.hasRange) return "bypass";
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return "ignore";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "bypass";
  if (url.origin !== input.origin) return "bypass";
  if (swPathIsBypassed(url.pathname)) return "bypass";
  if (input.mode === "navigate" || input.destination === "document") return "navigate";
  if (SW_STATIC_EXT.test(url.pathname)) return "static";
  return "ignore";
}

/** True when this SW cache name belongs to an older generation we may delete. */
export function swCacheIsStale(name: string, live: readonly string[]): boolean {
  if (!name.startsWith("atman-offline-")) return false;
  return !live.includes(name);
}
