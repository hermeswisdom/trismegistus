/** Same-origin static files the service worker may cache-first. */
export const PWA_STATIC_EXT = /\.(?:js|css|png|svg|jpe?g|webp|woff2|webmanifest|ico)$/i;

export function isPwaBypassedPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/auth/") || pathname === "/sw.js";
}

export function isPwaBypassedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "soundcloud.com" ||
    host.endsWith(".soundcloud.com") ||
    host === "sndcdn.com" ||
    host.endsWith(".sndcdn.com")
  );
}

export function isPwaStaticAssetPath(pathname: string): boolean {
  return PWA_STATIC_EXT.test(pathname);
}

export function shouldBypassPwaCache(input: {
  origin: string;
  pageOrigin: string;
  pathname: string;
  hostname: string;
  protocol: string;
}): boolean {
  if (input.protocol !== "http:" && input.protocol !== "https:") return true;
  if (input.origin !== input.pageOrigin) return true;
  if (isPwaBypassedHost(input.hostname)) return true;
  return isPwaBypassedPath(input.pathname);
}
